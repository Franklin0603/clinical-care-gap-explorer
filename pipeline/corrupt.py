"""Deliberately damage Bronze in six realistic ways, and log every change (Day 2).

Tomorrow's checks are scored against the log this writes. Without it, catch
rate is a claim; with it, a measurement.

Idempotent by construction: Bronze is reloaded from the clean CSVs first, so
running this twice gives one round of corruption, not two, and the JSON is
byte-identical between runs (no timestamps in it - V2.3 diffs the file).

Sampling is done in SQL with ORDER BY md5(key), which is deterministic
regardless of row order and needs no Python-side RNG state. Each defect
samples from a pool disjoint from the others, so no row carries two defects
and every log entry has one cause.

Run from the repo root:

    python pipeline/corrupt.py

Writes data/injected_defects.json - small, deterministic, and committed.
"""

import json

import duckdb

from cohort import DIABETES_CODES
from load_bronze import DB, SOURCES, load

OUT = "data/injected_defects.json"
SEED = 20260823  # recorded in the log; sampling itself is hash-based

# Decision D3. Nothing exceeds 1% of its table.
VOLUME = {
    "D1": 40,   # duplicate encounter rows
    "D2": 150,  # observations with no patient
    "D3": 20,   # A1c value of 250
    "D4": 8,    # birth date in the future
    "D5": 25,   # discharge before admission
    "D6": 6,    # same patient, two MRNs
}

A1C = "4548-4"
DX_CODES = ", ".join(f"'{c}'" for c in DIABETES_CODES)


def header(title):
    print(f"\n{title}\n{'-' * len(title)}")


def rows(con, sql):
    """Fetch as a list of dicts."""
    rel = con.sql(sql)
    cols = rel.columns
    return [dict(zip(cols, r)) for r in rel.fetchall()]


# --------------------------------------------------------------------------- D1

def d1_duplicate_encounters(con):
    """An HL7 interface replayed the message. The row is written again, unchanged.

    Logged key: encounter Id. After injection it identifies two rows - that is
    the defect.
    """
    con.sql(f"""
        CREATE TEMP TABLE d1 AS
        SELECT Id FROM bronze_encounters
        ORDER BY md5(Id) LIMIT {VOLUME['D1']}
    """)
    con.sql("INSERT INTO bronze_encounters SELECT * FROM bronze_encounters WHERE Id IN (SELECT Id FROM d1)")
    return [
        {"defect": "D1", "table": "bronze_encounters", "key": {"Id": r["Id"]},
         "field": None, "original": None, "injected": "row inserted a second time, unchanged"}
        for r in rows(con, "SELECT Id FROM d1 ORDER BY Id")
    ]


# --------------------------------------------------------------------------- D2

def d2_orphan_observations(con):
    """A result arrived with a patient identifier that did not resolve.

    Observations have no row id and (ENCOUNTER, CODE, DATE) is not unique
    table-wide, so sample only from rows where it is - then the logged key
    resolves to exactly one row after PATIENT is gone (V2.1). A1c rows are
    left for D3 so no row carries two defects. QALY/DALY rows have no
    ENCOUNTER and are excluded.
    """
    con.sql(f"""
        CREATE TEMP TABLE d2 AS
        SELECT ENCOUNTER, CODE, DATE, PATIENT
        FROM bronze_observations
        WHERE ENCOUNTER IS NOT NULL AND CODE <> '{A1C}'
        QUALIFY count(*) OVER (PARTITION BY ENCOUNTER, CODE, DATE) = 1
        ORDER BY md5(ENCOUNTER || CODE || DATE) LIMIT {VOLUME['D2']}
    """)
    con.sql("""
        UPDATE bronze_observations SET PATIENT = NULL
        WHERE (ENCOUNTER, CODE, DATE) IN (SELECT ENCOUNTER, CODE, DATE FROM d2)
    """)
    return [
        {"defect": "D2", "table": "bronze_observations",
         "key": {"ENCOUNTER": r["ENCOUNTER"], "CODE": r["CODE"], "DATE": r["DATE"]},
         "field": "PATIENT", "original": r["PATIENT"], "injected": None}
        for r in rows(con, "SELECT * FROM d2 ORDER BY ENCOUNTER, CODE, DATE")
    ]


# --------------------------------------------------------------------------- D3

def d3_a1c_unit_error(con):
    """A glucose in mg/dL keyed into a field expecting percent.

    Sampled from cohort patients on purpose: Decision D4 tomorrow (remediate
    vs quarantine) should visibly move the Day 4 gap count. (ENCOUNTER, CODE,
    DATE) is unique for A1c rows, checked on Day 1.
    """
    con.sql(f"""
        CREATE TEMP TABLE d3 AS
        SELECT ENCOUNTER, CODE, DATE, VALUE
        FROM bronze_observations
        WHERE CODE = '{A1C}'
          AND PATIENT IN (SELECT DISTINCT PATIENT FROM bronze_conditions WHERE CODE IN ({DX_CODES}))
        ORDER BY md5(ENCOUNTER || DATE) LIMIT {VOLUME['D3']}
    """)
    con.sql("""
        UPDATE bronze_observations SET VALUE = '250'
        WHERE (ENCOUNTER, CODE, DATE) IN (SELECT ENCOUNTER, CODE, DATE FROM d3)
    """)
    return [
        {"defect": "D3", "table": "bronze_observations",
         "key": {"ENCOUNTER": r["ENCOUNTER"], "CODE": r["CODE"], "DATE": r["DATE"]},
         "field": "VALUE", "original": r["VALUE"], "injected": "250"}
        for r in rows(con, "SELECT * FROM d3 ORDER BY ENCOUNTER, DATE")
    ]


# --------------------------------------------------------------------------- D4

def d4_future_birth_date(con):
    """Registration typo: a clerk types the wrong century. Year + 100."""
    con.sql(f"""
        CREATE TEMP TABLE d4 AS
        SELECT Id, BIRTHDATE,
               (CAST(substr(BIRTHDATE, 1, 4) AS INT) + 100)::VARCHAR || substr(BIRTHDATE, 5) AS injected
        FROM bronze_patients
        ORDER BY md5(Id) LIMIT {VOLUME['D4']}
    """)
    con.sql("UPDATE bronze_patients SET BIRTHDATE = d4.injected FROM d4 WHERE bronze_patients.Id = d4.Id")
    return [
        {"defect": "D4", "table": "bronze_patients", "key": {"Id": r["Id"]},
         "field": "BIRTHDATE", "original": r["BIRTHDATE"], "injected": r["injected"]}
        for r in rows(con, "SELECT * FROM d4 ORDER BY Id")
    ]


# --------------------------------------------------------------------------- D5

def d5_discharge_before_admission(con):
    """Clock drift between two systems feeding one encounter. START and STOP swap.

    Only encounters that HAVE a discharge and where it differs from admission -
    an open encounter is valid data, and a zero-length one would swap to
    itself and leave no defect to find. Disjoint from D1.
    """
    con.sql(f"""
        CREATE TEMP TABLE d5 AS
        SELECT Id, START, STOP
        FROM bronze_encounters
        WHERE STOP IS NOT NULL AND STOP <> '' AND STOP > START
          AND Id NOT IN (SELECT Id FROM d1)
        ORDER BY md5(Id || 'd5') LIMIT {VOLUME['D5']}
    """)
    con.sql("""
        UPDATE bronze_encounters SET START = d5.STOP, STOP = d5.START
        FROM d5 WHERE bronze_encounters.Id = d5.Id
    """)
    return [
        {"defect": "D5", "table": "bronze_encounters", "key": {"Id": r["Id"]},
         "field": "START,STOP", "original": f"{r['START']},{r['STOP']}",
         "injected": f"{r['STOP']},{r['START']}"}
        for r in rows(con, "SELECT * FROM d5 ORDER BY Id")
    ]


# --------------------------------------------------------------------------- D6

def d6_duplicate_patient(con):
    """The same person registered twice. Synthea has no MRN column, so Id plays
    that role: a second registration is a new Id with the same name and DOB.

    The new Id is md5-derived from the old one so it is stable across runs.
    Disjoint from D4.
    """
    con.sql(f"""
        CREATE TEMP TABLE d6 AS
        SELECT Id AS source_id,
               (SELECT h[1:8] || '-' || h[9:12] || '-' || h[13:16] || '-' || h[17:20] || '-' || h[21:32]
                FROM (SELECT md5(Id || 'duplicate-registration') AS h)) AS new_id
        FROM bronze_patients
        WHERE Id NOT IN (SELECT Id FROM d4)
        ORDER BY md5(Id || 'd6') LIMIT {VOLUME['D6']}
    """)
    cols = [c for c in con.sql("SELECT * FROM bronze_patients LIMIT 0").columns if c != "Id"]
    col_list = ", ".join(f'p."{c}"' for c in cols)
    con.sql(f"""
        INSERT INTO bronze_patients
        SELECT d6.new_id AS Id, {col_list}
        FROM bronze_patients p JOIN d6 ON p.Id = d6.source_id
    """)
    return [
        {"defect": "D6", "table": "bronze_patients", "key": {"Id": r["new_id"]},
         "field": "Id", "original": r["source_id"], "injected": r["new_id"]}
        for r in rows(con, "SELECT * FROM d6 ORDER BY source_id")
    ]


# ----------------------------------------------------------------- verification

def verify(con, entries):
    """V2.5 each defect present, V2.7 cohort survived, V2.8 counts as expected."""
    header("V2.5  Each defect present in Bronze")
    checks = {
        "D1": "SELECT count(*) FROM (SELECT Id FROM bronze_encounters GROUP BY Id HAVING count(*) > 1)",
        "D2": "SELECT count(*) FROM bronze_observations WHERE PATIENT IS NULL OR PATIENT = ''",
        # > 20.0, not outside 3.0-20.0: 951 clean values already sit below 3.0
        "D3": f"SELECT count(*) FROM bronze_observations WHERE CODE = '{A1C}' AND TRY_CAST(VALUE AS DOUBLE) > 20.0",
        "D4": "SELECT count(*) FROM bronze_patients WHERE BIRTHDATE > '2026-08-23'",
        "D5": "SELECT count(*) FROM bronze_encounters WHERE STOP < START",
        "D6": "SELECT count(*) FROM (SELECT FIRST, LAST, BIRTHDATE FROM bronze_patients GROUP BY 1,2,3 HAVING count(*) > 1)",
    }
    ok = True
    for d, sql in checks.items():
        found = con.sql(sql).fetchone()[0]
        logged = sum(1 for e in entries if e["defect"] == d)
        good = found == VOLUME[d] == logged
        ok &= good
        print(f"  {d}  injected {VOLUME[d]:>4}  logged {logged:>4}  found in bronze {found:>4}  {'ok' if good else '<-- CHECK'}")

    header("V2.7  Cohort survived")
    cohort = con.sql(f"SELECT count(DISTINCT PATIENT) FROM bronze_conditions WHERE CODE IN ({DX_CODES})").fetchone()[0]
    a1c_ok = con.sql(f"SELECT count(*) FROM bronze_observations WHERE CODE='{A1C}' AND TRY_CAST(VALUE AS DOUBLE) <= 20").fetchone()[0]
    print(f"  diabetic patients {cohort}   valid A1c rows {a1c_ok:,}   (Day 1: 161 code-carriers / 8,941)")

    header("V2.8  Row counts vs clean Bronze")
    for name, delta in [("patients", VOLUME["D6"]), ("encounters", VOLUME["D1"]),
                        ("conditions", 0), ("observations", 0), ("medications", 0)]:
        n = con.sql(f"SELECT count(*) FROM bronze_{name}").fetchone()[0]
        print(f"  bronze_{name:13} {n:>9,}   expected clean {'+' + str(delta) if delta else '+0':>4}")
    return ok


def main():
    con = duckdb.connect(DB)

    header("Reload clean Bronze")
    for name in SOURCES:
        load(con, name)
    print("  reloaded", ", ".join(SOURCES))

    header("Inject")
    entries = []
    for fn in (d1_duplicate_encounters, d2_orphan_observations, d3_a1c_unit_error,
               d4_future_birth_date, d5_discharge_before_admission, d6_duplicate_patient):
        new = fn(con)
        entries += new
        print(f"  {new[0]['defect']}  {len(new):>4} rows  {fn.__doc__.splitlines()[0]}")

    log = {
        "seed": SEED,
        "volume": VOLUME,
        "total": len(entries),
        "entries": entries,
    }
    with open(OUT, "w") as fh:
        json.dump(log, fh, indent=1)
    print(f"\n  {len(entries)} entries -> {OUT}")

    ok = verify(con, entries)
    con.close()
    if not ok:
        raise SystemExit("Injection failed a check - see rows marked CHECK above.")


if __name__ == "__main__":
    main()
