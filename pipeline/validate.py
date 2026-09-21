"""Validate Bronze into Silver: six checks, three output tables, one assertion (Day 3).

Ported from pipeline/index.ipynb after review. Three principles from
DATA_QUALITY_SPEC.md govern every check:

  1. Nothing is silently dropped - every rejected row lands in `quarantine`
     with a reason and the check that rejected it.
  2. Identity is never auto-resolved - suspected duplicate patients go to
     `identity_review` for a human. Both rows stay in Silver.
  3. Remediation is recorded, not overwritten - a corrected value keeps its
     original in `remediation_log` and the Silver row is flagged.

The assertion that makes principle 1 a test rather than a sentence:
for every table, bronze rows == silver rows + quarantined rows.

Run order: load_bronze.py -> corrupt.py -> validate.py. Run from the repo root:

    python pipeline/validate.py

Writes data/dq_report.json (reconciliation + catch rate) for the app and README.
"""

import json

import duckdb

from cohort import DIABETES_CODES
from load_bronze import DB, SOURCES

LOG = "data/injected_defects.json"
REPORT = "data/dq_report.json"

ASOF = "2026-08-23"           # Decision D7: a fixed "today". The data ends here;
                              # a wall-clock date would move the gap count daily.
A1C = "4548-4"
A1C_RANGE = (2.0, 20.0)       # DQ3. Floor revised from 3.0: 951 clean values sit below it.
GLUCOSE_RANGE = (40.0, 600.0) # Decision D4: an A1c in this band is a mis-keyed mg/dL glucose.
REMEDIATION_RULE = "A1C_MGDL_TO_PCT_EAG"
DX_CODES = ", ".join(f"'{c}'" for c in DIABETES_CODES)

OBS_KEY = "coalesce(ENCOUNTER, '') || '|' || CODE || '|' || DATE"  # observations have no id


def header(title):
    print(f"\n{title}\n{'-' * len(title)}")


# ------------------------------------------------------------ 3.1 output tables

def build_output_tables(con):
    """Built before any check exists, so no check has an excuse to drop a row quietly."""
    con.sql("""
        CREATE OR REPLACE TABLE quarantine (
            source_table VARCHAR, source_row_id VARCHAR, failure_reason VARCHAR,
            check_id VARCHAR, quarantined_at DATE, raw_payload JSON);
        CREATE OR REPLACE TABLE identity_review (
            candidate_a_mrn VARCHAR, candidate_b_mrn VARCHAR, match_fields VARCHAR,
            confidence DOUBLE, status VARCHAR, reviewed_by VARCHAR, reviewed_at DATE);
        CREATE OR REPLACE TABLE remediation_log (
            source_table VARCHAR, source_row_id VARCHAR, field VARCHAR,
            original_value VARCHAR, corrected_value VARCHAR, remediation_rule VARCHAR, applied_at DATE);
    """)


# ------------------------------------------------------------------- the checks
# Each check leaves a temp table of the rows it rejected (rej_*) or corrected
# (rem_*). Silver is then "Bronze minus rejects", so a row can only leave the
# pipeline through a table that names the reason.

def dq1_encounter_uniqueness(con):
    """One row per (patient, encounter). Duplicates are byte-identical replays;
    keep the earliest written (lowest rowid) - it is what the care team saw first."""
    con.sql(f"""
        CREATE OR REPLACE TEMP TABLE rej_dq1 AS
        SELECT rowid AS rid, e.* FROM bronze_encounters e
        QUALIFY row_number() OVER (PARTITION BY PATIENT, Id ORDER BY rowid) > 1;

        INSERT INTO quarantine
        SELECT 'bronze_encounters', Id,
               'Duplicate encounter row for the same patient and encounter id; earliest copy kept',
               'DQ1', '{ASOF}', to_json(r)
        FROM (SELECT * EXCLUDE (rid) FROM rej_dq1) r;
    """)


def dq2_referential_integrity(con):
    """Every observation must point at a patient that exists. An orphan is a lab
    result nobody will ever see - quarantine it so someone can find out whose it was."""
    con.sql(f"""
        CREATE OR REPLACE TEMP TABLE rej_dq2 AS
        SELECT o.* FROM bronze_observations o
        LEFT JOIN bronze_patients p ON p.Id = o.PATIENT
        WHERE o.PATIENT IS NULL OR p.Id IS NULL;

        INSERT INTO quarantine
        SELECT 'bronze_observations', {OBS_KEY},
               CASE WHEN PATIENT IS NULL THEN 'Observation has no patient identifier'
                    ELSE 'Observation patient identifier does not match any patient' END,
               'DQ2', '{ASOF}', to_json(r)
        FROM rej_dq2 r;
    """)


def dq3_a1c_plausibility(con):
    """A1c must be within A1C_RANGE percent.

    Decision D4: a value above the range but inside GLUCOSE_RANGE is treated as a
    mg/dL glucose keyed into a percent field and converted with the ADA eAG
    mapping, A1c = (value + 46.7) / 28.7. The original is kept in remediation_log
    and the Silver row is flagged 'remediated', so the correction is reversible in
    one WHERE clause. Anything else out of range is quarantined, not guessed.
    """
    lo, hi = A1C_RANGE
    glo, ghi = GLUCOSE_RANGE
    con.sql(f"""
        CREATE OR REPLACE TEMP TABLE a1c AS
        SELECT o.*, TRY_CAST(VALUE AS DOUBLE) AS v, {OBS_KEY} AS row_key
        FROM bronze_observations o WHERE CODE = '{A1C}';

        CREATE OR REPLACE TEMP TABLE rem_dq3 AS
        SELECT row_key, VALUE AS original, round((v + 46.7) / 28.7, 1) AS corrected
        FROM a1c WHERE v > {hi} AND v BETWEEN {glo} AND {ghi};

        CREATE OR REPLACE TEMP TABLE rej_dq3 AS
        SELECT * EXCLUDE (v, row_key) FROM a1c
        WHERE v IS NULL OR v < {lo} OR (v > {hi} AND v NOT BETWEEN {glo} AND {ghi});

        INSERT INTO remediation_log
        SELECT 'bronze_observations', row_key, 'VALUE', original, corrected::VARCHAR,
               '{REMEDIATION_RULE}: value in glucose range keyed into a percent field; A1c = (value + 46.7) / 28.7',
               '{ASOF}'
        FROM rem_dq3;

        INSERT INTO quarantine
        SELECT 'bronze_observations', {OBS_KEY},
               CASE WHEN TRY_CAST(VALUE AS DOUBLE) IS NULL THEN 'A1c value is not numeric'
                    WHEN TRY_CAST(VALUE AS DOUBLE) < {lo}   THEN 'A1c below plausible floor of {lo} %'
                    ELSE 'A1c above {hi} % and not in a glucose range; cannot infer intended value' END,
               'DQ3', '{ASOF}', to_json(r)
        FROM rej_dq3 r;
    """)


def dq4_birth_date_sanity(con):
    """Birth date must parse, be on or before ASOF, and imply an age of 120 or less."""
    con.sql(f"""
        CREATE OR REPLACE TEMP TABLE rej_dq4 AS
        SELECT * FROM bronze_patients
        WHERE TRY_CAST(BIRTHDATE AS DATE) IS NULL
           OR BIRTHDATE::DATE > DATE '{ASOF}'
           OR date_diff('year', BIRTHDATE::DATE, DATE '{ASOF}') > 120;

        INSERT INTO quarantine
        SELECT 'bronze_patients', Id,
               CASE WHEN TRY_CAST(BIRTHDATE AS DATE) IS NULL THEN 'Birth date is not a valid date'
                    WHEN BIRTHDATE::DATE > DATE '{ASOF}'    THEN 'Birth date is after the as-of date'
                    ELSE 'Implied age exceeds 120 years' END,
               'DQ4', '{ASOF}', to_json(r)
        FROM rej_dq4 r;
    """)


def dq5_encounter_chronology(con):
    """Discharge must not precede admission. An open encounter (no STOP) is valid
    data and is kept explicitly - NULL < START is unknown, not true, and the
    condition is written so that is deliberate rather than accidental."""
    con.sql(f"""
        CREATE OR REPLACE TEMP TABLE rej_dq5 AS
        SELECT * FROM bronze_encounters
        WHERE STOP IS NOT NULL AND STOP <> ''
          AND TRY_CAST(STOP AS TIMESTAMP) < TRY_CAST(START AS TIMESTAMP)
          AND rowid NOT IN (SELECT rid FROM rej_dq1);   -- a row is rejected once

        INSERT INTO quarantine
        SELECT 'bronze_encounters', Id, 'Discharge timestamp is before admission timestamp',
               'DQ5', '{ASOF}', to_json(r)
        FROM rej_dq5 r;
    """)


def dq6_identity_review(con):
    """Two patients with the same first name, last name and birth date go to a
    human as 'pending'. Nothing is merged: a wrong merge combines two people's
    medication lists. Confidence: 0.70 name+DOB, +0.25 SSN, +0.05 address."""
    con.sql("""
        INSERT INTO identity_review
        SELECT a.Id, b.Id,
               'first_name,last_name,birth_date'
                 || CASE WHEN a.SSN = b.SSN THEN ',ssn' ELSE '' END
                 || CASE WHEN a.ADDRESS = b.ADDRESS THEN ',address' ELSE '' END,
               0.70 + CASE WHEN a.SSN = b.SSN THEN 0.25 ELSE 0 END
                    + CASE WHEN a.ADDRESS = b.ADDRESS THEN 0.05 ELSE 0 END,
               'pending', NULL, NULL
        FROM bronze_patients a
        JOIN bronze_patients b
          ON a.FIRST = b.FIRST AND a.LAST = b.LAST AND a.BIRTHDATE = b.BIRTHDATE AND a.Id < b.Id;
    """)


# ------------------------------------------------------------------ 3.8 Silver

def build_silver(con):
    """Surviving rows only, with real types. Column names per DATA_DICTIONARY.md.

    observations.value is DOUBLE, but 315,450 observations carry text results
    (smoking status, survey answers). TRY_CAST would null them while the row sat
    in Silver looking clean, so value_text keeps the original for every row.
    """
    con.sql(f"""
        CREATE OR REPLACE TABLE silver_patients AS
        SELECT Id AS patient_id, Id AS mrn,                       -- Synthea has no MRN
               BIRTHDATE::DATE AS birth_date, TRY_CAST(DEATHDATE AS DATE) AS death_date,
               GENDER AS sex, FIRST AS first_name, LAST AS last_name, 'clean' AS _dq_status
        FROM bronze_patients WHERE Id NOT IN (SELECT Id FROM rej_dq4);

        CREATE OR REPLACE TABLE silver_encounters AS
        SELECT Id AS encounter_id, PATIENT AS patient_id,
               START::TIMESTAMP AS admission_ts, TRY_CAST(STOP AS TIMESTAMP) AS discharge_ts,
               ENCOUNTERCLASS AS encounter_type, CODE AS snomed_code, DESCRIPTION AS description,
               'clean' AS _dq_status
        FROM bronze_encounters
        WHERE rowid NOT IN (SELECT rid FROM rej_dq1) AND rowid NOT IN (SELECT rowid FROM rej_dq5);

        CREATE OR REPLACE TABLE silver_conditions AS
        SELECT PATIENT AS patient_id, ENCOUNTER AS encounter_id, CODE AS snomed_code,
               DESCRIPTION AS description, START::DATE AS onset_date, TRY_CAST(STOP AS DATE) AS resolved_date,
               'clean' AS _dq_status
        FROM bronze_conditions;

        CREATE OR REPLACE TABLE silver_observations AS
        SELECT o.PATIENT AS patient_id, o.ENCOUNTER AS encounter_id, o.CODE AS loinc_code,
               o.DESCRIPTION AS description,
               coalesce(m.corrected, TRY_CAST(o.VALUE AS DOUBLE)) AS value,
               o.VALUE AS value_text, o.UNITS AS unit, o.DATE::TIMESTAMP AS observed_at,
               CASE WHEN m.row_key IS NOT NULL THEN 'remediated' ELSE 'clean' END AS _dq_status
        FROM bronze_observations o
        LEFT JOIN rem_dq3 m ON m.row_key = coalesce(o.ENCOUNTER, '') || '|' || o.CODE || '|' || o.DATE
        WHERE o.rowid NOT IN (SELECT rowid FROM rej_dq2) AND o.rowid NOT IN (SELECT rowid FROM rej_dq3);

        CREATE OR REPLACE TABLE silver_medications AS
        SELECT PATIENT AS patient_id, ENCOUNTER AS encounter_id, CODE AS rxnorm_code,
               DESCRIPTION AS description, START::DATE AS start_date, TRY_CAST(STOP AS DATE) AS end_date,
               'clean' AS _dq_status
        FROM bronze_medications;
    """)


# ------------------------------------------------------- 3.10 reconciliation

def reconcile(con):
    """bronze == silver + quarantine, every table. Fails loudly otherwise."""
    header("V3.1  Reconciliation: bronze = silver + quarantine")
    rows, ok = [], True
    for t in SOURCES:
        b = con.sql(f"SELECT count(*) FROM bronze_{t}").fetchone()[0]
        s = con.sql(f"SELECT count(*) FROM silver_{t}").fetchone()[0]
        q = con.sql(f"SELECT count(*) FROM quarantine WHERE source_table = 'bronze_{t}'").fetchone()[0]
        good = b == s + q
        ok &= good
        rows.append({"table": t, "bronze": b, "silver": s, "quarantined": q, "balances": good})
        print(f"  {t:13} {b:>9,} = {s:>9,} + {q:>5,}   {'ok' if good else '<-- DOES NOT BALANCE'}")
    return rows, ok


# ------------------------------------------------------------ 3.9 catch rate

def catch_rate(con):
    """Score the three output tables against injected_defects.json. A defect counts
    as caught only if the *right* check caught it - a coincidence is not a check."""
    header("V3.4 / V3.5  Catch rate against ground truth")
    log = json.load(open(LOG))
    keyed = [
        {"defect": e["defect"],
         "key": "|".join(str(v) for v in e["key"].values()) if e["defect"] in ("D2", "D3") else e["key"]["Id"]}
        for e in log["entries"]
    ]
    con.sql("CREATE OR REPLACE TEMP TABLE injected (defect VARCHAR, key VARCHAR)")
    con.executemany("INSERT INTO injected VALUES (?, ?)", [(k["defect"], k["key"]) for k in keyed])

    rows = con.sql("""
        WITH found AS (
            SELECT source_row_id AS key, check_id AS caught_by FROM quarantine
            UNION ALL SELECT source_row_id, 'DQ3' FROM remediation_log
            UNION ALL SELECT candidate_a_mrn, 'DQ6' FROM identity_review  -- derived Id can sort either side
            UNION ALL SELECT candidate_b_mrn, 'DQ6' FROM identity_review
        )
        SELECT i.defect, 'DQ' || i.defect[2] AS expected_check, count(*) AS injected,
               count(f.key) FILTER (WHERE f.caught_by = 'DQ' || i.defect[2]) AS caught,
               count(f.key) FILTER (WHERE f.caught_by <> 'DQ' || i.defect[2]) AS caught_by_other
        FROM injected i LEFT JOIN found f ON f.key = i.key
        GROUP BY 1, 2 ORDER BY 1
    """).fetchall()
    out = []
    for defect, check, inj, caught, other in rows:
        out.append({"defect": defect, "check": check, "injected": inj, "caught": caught, "caught_by_other": other})
        flag = "" if caught == inj and other == 0 else "   <-- CHECK"
        print(f"  {defect} -> {check}   injected {inj:>4}   caught {caught:>4}   by other check {other:>3}{flag}")
    types = sum(1 for r in out if r["caught"] > 0)
    total_inj = sum(r["injected"] for r in out)
    total_caught = sum(r["caught"] for r in out)
    print(f"\n  catch rate: {types} of 6 defect types   |   {total_caught} of {total_inj} rows")
    return out, types, total_caught, total_inj


# --------------------------------------------------------------------- main

def main():
    con = duckdb.connect(DB)

    build_output_tables(con)
    header("Checks")
    for fn in (dq1_encounter_uniqueness, dq2_referential_integrity, dq3_a1c_plausibility,
               dq4_birth_date_sanity, dq5_encounter_chronology, dq6_identity_review):
        fn(con)
        print(f"  {fn.__name__:26} {fn.__doc__.splitlines()[0]}")
    build_silver(con)

    q = con.sql("SELECT check_id, count(*) FROM quarantine GROUP BY 1 ORDER BY 1").fetchall()
    print(f"\n  quarantine: {dict(q)}   identity_review: {con.sql('SELECT count(*) FROM identity_review').fetchone()[0]}"
          f"   remediation_log: {con.sql('SELECT count(*) FROM remediation_log').fetchone()[0]}")

    recon, balanced = reconcile(con)
    catches, types, caught, injected = catch_rate(con)

    report = {
        "asof": ASOF,
        "a1c_range": A1C_RANGE,
        "remediation_rule": REMEDIATION_RULE,
        "reconciliation": recon,
        "quarantine_by_check": dict(q),
        "identity_review_pending": con.sql("SELECT count(*) FROM identity_review WHERE status='pending'").fetchone()[0],
        "remediated": con.sql("SELECT count(*) FROM remediation_log").fetchone()[0],
        "catch": catches,
        "catch_rate_types": f"{types} of 6",
        "catch_rate_rows": f"{caught} of {injected}",
    }
    with open(REPORT, "w") as fh:
        json.dump(report, fh, indent=1)
    print(f"\n  -> {REPORT}")
    con.close()

    if not balanced:
        raise SystemExit("Reconciliation failed: a check dropped rows silently.")


if __name__ == "__main__":
    main()
