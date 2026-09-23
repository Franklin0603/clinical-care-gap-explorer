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
site stale. That is why run_all.py calls it as its last stage.

    python pipeline/export_web.py
"""

import json
import os
import shutil

import duckdb

from load_bronze import DB

OUT = "web/public/data"
TABLES = ["care_gap_a1c", "quarantine", "identity_review", "remediation_log"]
REPORTS = ["data/dq_report.json", "data/gold_report.json"]


def export(con):
    os.makedirs(OUT, exist_ok=True)
    manifest = {"tables": {}, "reports": []}

    for t in TABLES:
        con.sql(f"COPY {t} TO '{OUT}/{t}.parquet' (FORMAT parquet)")
        df = con.sql(f"SELECT * FROM {t}").df()
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
        shutil.copy(src, f"{OUT}/{os.path.basename(src)}")
        manifest["reports"].append(os.path.basename(src))
        print(f"  {os.path.basename(src):20}       copied")

    # the reconciliation, as its own small artefact - P2 shows it as a table
    recon = con.sql("""
        SELECT 'patients' AS name, (SELECT count(*) FROM bronze_patients) AS bronze,
               (SELECT count(*) FROM silver_patients) AS silver,
               (SELECT count(*) FROM quarantine WHERE source_table='bronze_patients') AS quarantined
        UNION ALL SELECT 'encounters', (SELECT count(*) FROM bronze_encounters), (SELECT count(*) FROM silver_encounters),
               (SELECT count(*) FROM quarantine WHERE source_table='bronze_encounters')
        UNION ALL SELECT 'conditions', (SELECT count(*) FROM bronze_conditions), (SELECT count(*) FROM silver_conditions),
               (SELECT count(*) FROM quarantine WHERE source_table='bronze_conditions')
        UNION ALL SELECT 'observations', (SELECT count(*) FROM bronze_observations), (SELECT count(*) FROM silver_observations),
               (SELECT count(*) FROM quarantine WHERE source_table='bronze_observations')
        UNION ALL SELECT 'medications', (SELECT count(*) FROM bronze_medications), (SELECT count(*) FROM silver_medications),
               (SELECT count(*) FROM quarantine WHERE source_table='bronze_medications')
    """).df().to_dict("records")
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
