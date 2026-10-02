"""Export what the web app reads (Decision D9).

Two formats, on purpose:

  *.json     - P1 and P2 render from these at build time. No client-side query
               engine, no loading spinner, works with JavaScript disabled.
  *.parquet  - the same tables, for DuckDB-WASM to query in the browser. P4's
               text-to-SQL on Day 7 runs against these, so the SQL it shows is
               genuinely executed rather than a canned answer.

Everything here is small - 365 rows across four tables - so shipping both costs
almost nothing and each format does the job it is good at.

The trade-off D9 accepts: the app reads a snapshot taken at build time, not the
live warehouse. Re-running the pipeline without re-running this script leaves the
site stale. That is why the CLI calls it as its last stage.

    caregap run
"""

import json
import os
import shutil

import duckdb

from caregap.domain.access import ROLES, DEFAULT_ROLE, restricted_for
from caregap.config import (
    ASOF, A1C, DQ_REPORT, GOLD_REPORT, DB, INSULIN, SOURCES, sql_list,
    WEB_DATA as OUT,
)
# Each exported table with the key that fixes its row order.
#
# Without an ORDER BY, DuckDB returns rows in whatever order the scan produced,
# so re-running the pipeline with the same seed rewrote these files with
# identical content in a different sequence. These artefacts are committed, so
# that showed up as a diff on every run and buried any change that mattered.
# Same reason as the patient_id tiebreaker in gold/care_gap_a1c.sql.
TABLES = {
    "care_gap_a1c": "patient_id",
    "quarantine": "source_table, check_id, source_row_id",
    "identity_review": "candidate_a_mrn, candidate_b_mrn",
    "remediation_log": "source_row_id, field",
}
REPORTS = [DQ_REPORT, GOLD_REPORT]


def export_by_role(con, manifest):
    """One payload per role (Day 6).

    The restricted columns are never SELECTed and the out-of-unit rows are never
    returned, so the file a PCT's page loads has no A1c in it at all - absent,
    not blank. With a static site there is no request-time server to filter, so
    the filtering happens here, in the query layer, at build time.
    """
    con.sql("""
        CREATE OR REPLACE TEMP VIEW patient_unit AS
        SELECT g.patient_id,
               arg_max(e.encounter_type, e.admission_ts) AS unit   -- care setting of the most recent encounter
        FROM care_gap_a1c g
        JOIN silver_encounters e USING (patient_id)
        WHERE e.admission_ts <= g.asof_date
        GROUP BY g.patient_id
    """)
    con.sql("""
        CREATE OR REPLACE TEMP VIEW gold_scoped AS
        SELECT g.*, p.mrn, p.sex, u.unit
        FROM care_gap_a1c g
        JOIN silver_patients p USING (patient_id)
        JOIN patient_unit u USING (patient_id)
    """)

    manifest["roles"] = {}
    for role, cfg in ROLES.items():
        cols = ", ".join(f'"{c}"' for c in cfg["columns"])
        where = ""
        if cfg["units"]:
            units = ", ".join(f"'{u}'" for u in cfg["units"])
            where = f"WHERE unit IN ({units})"
        # patient_id last, so a tie on (gap_flag, age) does not reorder the
        # file between runs. The parquet used no ORDER BY at all and so did not
        # even match the json beside it.
        role_order = "ORDER BY gap_flag DESC, age DESC, patient_id"
        df = con.sql(f"SELECT {cols} FROM gold_scoped {where} {role_order}").df()
        df = df.astype(object).where(df.notna(), None)
        rows = df.to_dict("records")
        for r in rows:
            for k, v in r.items():
                if hasattr(v, "isoformat"):
                    r[k] = v.isoformat()[:10]
                elif v is not None and not isinstance(v, (str, int, float, bool)):
                    r[k] = str(v)
        con.sql(f"COPY (SELECT {cols} FROM gold_scoped {where} {role_order}) "
                f"TO '{OUT}/care_gap_{role}.parquet' (FORMAT parquet)")
        with open(f"{OUT}/care_gap_{role}.json", "w") as fh:
            json.dump(rows, fh, indent=1, default=str, allow_nan=False)
        manifest["roles"][role] = {
            "label": cfg["label"], "scope": cfg["scope"], "rationale": cfg["rationale"],
            "units": cfg["units"], "columns": cfg["columns"],
            "restricted": restricted_for(role),
            "parquet": f"care_gap_{role}.parquet",
            "patients": len(rows),
            "gaps": sum(1 for r in rows if r["gap_flag"]),
        }
        print(f"  care_gap_{role:10} {len(rows):>5} rows  {len(cfg['columns']):>2} cols"
              f"  {len(restricted_for(role)):>2} restricted")
    manifest["default_role"] = DEFAULT_ROLE

    # The same table with nothing withheld, under a name that carries no role.
    # The web app reads this one. It used to read care_gap_physician, which made
    # every page that wanted the full cohort look like it was taking a clinical
    # role's point of view, and left "physician" in the UI after the role
    # switcher came out. The per-role exports above stay: they are what the
    # access-control argument and its tests are built on.
    full_cols = ", ".join(f'"{c}"' for c in ROLES["physician"]["columns"])
    order = "ORDER BY gap_flag DESC, days_overdue DESC NULLS LAST, age DESC, patient_id"
    df = con.sql(f"SELECT {full_cols} FROM gold_scoped {order}").df()
    df = df.astype(object).where(df.notna(), None)
    rows = df.to_dict("records")
    for r in rows:
        for k, v in r.items():
            if hasattr(v, "isoformat"):
                r[k] = v.isoformat()[:10]
            elif v is not None and not isinstance(v, (str, int, float, bool)):
                r[k] = str(v)
    con.sql(f"COPY (SELECT {full_cols} FROM gold_scoped {order}) "
            f"TO '{OUT}/care_gap_full.parquet' (FORMAT parquet)")
    with open(f"{OUT}/care_gap_full.json", "w") as fh:
        json.dump(rows, fh, indent=1, default=str, allow_nan=False)
    manifest["full"] = {
        "json": "care_gap_full.json", "parquet": "care_gap_full.parquet",
        "patients": len(rows), "gaps": sum(1 for r in rows if r["gap_flag"]),
        "columns": ROLES["physician"]["columns"],
    }
    print(f"  {'care_gap_full':20} {len(rows):>5} rows  "
          f"{len(ROLES['physician']['columns']):>2} cols   no role scoping")

    # Age bands - Decision D11. HEDIS diabetes measures apply to members 18-75 and
    # stratify 18-64 / 65-75, so the boundaries are the measure's, not round numbers.
    bands = con.sql("""
        SELECT CASE WHEN age < 45 THEN '18-44' WHEN age < 65 THEN '45-64'
                    WHEN age <= 75 THEN '65-75' ELSE '76+' END AS band,
               count(*) AS patients, count(*) FILTER (WHERE gap_flag) AS gaps, min(age) AS lo
        FROM care_gap_a1c GROUP BY 1 ORDER BY lo
    """).df().drop(columns=["lo"]).to_dict("records")
    with open(f"{OUT}/age_bands.json", "w") as fh:
        json.dump(bands, fh, indent=1, default=str)
    print(f"  {'age_bands.json':20} {len(bands):>5} bands")


def export_patient_detail(con, manifest):
    """One record per cohort patient, for the detail panel behind a table row.

    This is the "so what do I do about this person" view: the A1c series that
    shows whether they were ever controlled, what they are on, and what has
    actually been done. Three things worth knowing about the shape:

    Medications are rolled up per drug, not per prescription. The raw table has
    20,339 rows for 116 patients, almost all repeat fills of the same handful of
    drugs, which is a dispensing ledger rather than a medication list. Collapsed
    to one row per drug with a first start, a last end and a fill count, it
    becomes the list a clinician would actually read, and the payload drops by
    roughly a factor of five.

    Procedures are rolled up the same way, and they are completed procedures.
    Nothing here is an order, so nothing in the panel may imply a test was
    requested and missed.

    The A1c series is shipped whole - 3,392 points across the cohort, up to 275
    for one patient - because thinning it would be inventing a trend line.
    """
    detail = {}
    a1c = con.sql(f"""
        SELECT o.patient_id, o.observed_at::DATE AS d, o.value AS v
        FROM silver_observations o
        JOIN care_gap_a1c g USING (patient_id)
        WHERE o.loinc_code = '{A1C}' AND o.value IS NOT NULL
        ORDER BY o.patient_id, d
    """).fetchall()
    for pid, d, v in a1c:
        detail.setdefault(pid, {"a1c": [], "meds": [], "procs": []})
        detail[pid]["a1c"].append({"d": d.isoformat(), "v": round(float(v), 1)})

    meds = con.sql(f"""
        SELECT m.patient_id, m.description AS name, m.rxnorm_code AS code,
               min(m.start_date) AS started,
               CASE WHEN bool_or(m.end_date IS NULL) THEN NULL
                    ELSE max(m.end_date) END AS ended,     -- null means still active
               count(*) AS prescriptions,
               coalesce(sum(m.dispenses), 0) AS fills,
               m.rxnorm_code IN ({sql_list(INSULIN)}) AS insulin
        FROM silver_medications m
        JOIN care_gap_a1c g USING (patient_id)
        GROUP BY m.patient_id, m.description, m.rxnorm_code
        -- description last: insulin and start date tie often, and without a
        -- total order the rolled-up list came out shuffled between runs.
        ORDER BY m.patient_id, insulin DESC, started, m.description
    """).fetchall()
    for pid, name, code, started, ended, presc, fills, insulin in meds:
        detail.setdefault(pid, {"a1c": [], "meds": [], "procs": []})
        detail[pid]["meds"].append({
            "name": name, "code": code,
            "started": started.isoformat() if started else None,
            "ended": ended.isoformat() if ended else None,
            "prescriptions": int(presc), "fills": int(fills), "insulin": bool(insulin),
        })

    procs = con.sql("""
        SELECT p.patient_id, p.description AS name, p.snomed_code AS code,
               count(*) AS times, max(p.performed_date) AS last_done
        FROM silver_procedures p
        JOIN care_gap_a1c g USING (patient_id)
        GROUP BY p.patient_id, p.description, p.snomed_code
        ORDER BY p.patient_id, last_done DESC, p.description
    """).fetchall()
    for pid, name, code, times, last_done in procs:
        detail.setdefault(pid, {"a1c": [], "meds": [], "procs": []})
        detail[pid]["procs"].append({
            "name": name, "code": code, "times": int(times),
            "last": last_done.isoformat() if last_done else None,
        })

    # Every cohort patient gets a key, including the 21 with no A1c at all. An
    # absent key would make the panel look broken for exactly the patients the
    # report is about.
    for (pid,) in con.sql("SELECT patient_id FROM care_gap_a1c ORDER BY patient_id").fetchall():
        detail.setdefault(pid, {"a1c": [], "meds": [], "procs": []})

    with open(f"{OUT}/patient_detail.json", "w") as fh:
        json.dump(detail, fh, separators=(",", ":"), default=str, allow_nan=False)

    manifest["patient_detail"] = {
        "patients": len(detail),
        "a1c_points": sum(len(d["a1c"]) for d in detail.values()),
        "med_rows": sum(len(d["meds"]) for d in detail.values()),
        "procedure_rows": sum(len(d["procs"]) for d in detail.values()),
        "json": "patient_detail.json",
    }
    m = manifest["patient_detail"]
    print(f"  {'patient_detail.json':20} {m['patients']:>5} patients"
          f"  {m['a1c_points']:>6} a1c  {m['med_rows']:>5} meds  {m['procedure_rows']:>5} procs")


def export(con):
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"tables": {}, "reports": []}

    for t, order in TABLES.items():
        con.sql(f"COPY (SELECT * FROM {t} ORDER BY {order}) "
                f"TO '{OUT}/{t}.parquet' (FORMAT parquet)")
        df = con.sql(f"SELECT * FROM {t} ORDER BY {order}").df()
        # Pandas NaN and NaT are not JSON. Convert to object dtype first so
        # missing values become None, then serialise dates as plain strings -
        # the app formats them, and JSON has no date type.
        df = df.astype(object).where(df.notna(), None)
        rows = df.to_dict("records")
        for r in rows:
            for k, v in r.items():
                if hasattr(v, "isoformat"):
                    r[k] = v.isoformat()[:10]
                elif v is not None and not isinstance(v, (str, int, float, bool)):
                    r[k] = str(v)
        with open(f"{OUT}/{t}.json", "w") as fh:
            json.dump(rows, fh, indent=1, default=str, allow_nan=False)
        n = len(rows)
        manifest["tables"][t] = {"rows": n, "parquet": f"{t}.parquet", "json": f"{t}.json"}
        print(f"  {t:20} {n:>5} rows")

    for src in REPORTS:
        shutil.copy(src, OUT / src.name)
        manifest["reports"].append(src.name)
        print(f"  {src.name:20}       copied")

    export_by_role(con, manifest)
    export_patient_detail(con, manifest)

    # The reconciliation, as its own small artefact - P2 shows it as a table.
    # Built from SOURCES rather than a UNION per table: this was five hand-written
    # branches, so adding a source silently left it out of the published
    # reconciliation while the pipeline's own check still covered it.
    recon = []
    for t in SOURCES:
        recon.append({
            "name": t,
            "bronze": con.sql(f"SELECT count(*) FROM bronze_{t}").fetchone()[0],
            "silver": con.sql(f"SELECT count(*) FROM silver_{t}").fetchone()[0],
            "quarantined": con.sql(
                f"SELECT count(*) FROM quarantine WHERE source_table = 'bronze_{t}'"
            ).fetchone()[0],
        })
    for r in recon:
        r["balances"] = r["bronze"] == r["silver"] + r["quarantined"]
    with open(f"{OUT}/reconciliation.json", "w") as fh:
        json.dump(recon, fh, indent=1, default=str)
    manifest["reports"].append("reconciliation.json")
    print(f"  {'reconciliation.json':20} {len(recon):>5} rows")

    with open(f"{OUT}/manifest.json", "w") as fh:
        json.dump(manifest, fh, indent=1)
    return manifest


def main():
    con = duckdb.connect(DB, read_only=True)
    print("\nExport for web\n--------------")
    m = export(con)
    con.close()
    total = sum(os.path.getsize(f"{OUT}/{f}") for f in os.listdir(OUT))
    print(f"\n  {len(os.listdir(OUT))} files, {total/1024:.0f} KB -> {OUT}")


if __name__ == "__main__":
    main()
