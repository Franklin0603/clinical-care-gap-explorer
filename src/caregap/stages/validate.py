"""Validate Bronze into Silver: six checks, three output tables, one assertion (Day 3).

Ported from notebooks/02_validate.ipynb after review. Three principles from
DATA_QUALITY_SPEC.md govern every check:

  1. Nothing is silently dropped - every rejected row lands in `quarantine`
     with a reason and the check that rejected it.
  2. Identity is never auto-resolved - suspected duplicate patients go to
     `identity_review` for a human. Both rows stay in Silver.
  3. Remediation is recorded, not overwritten - a corrected value keeps its
     original in `remediation_log` and the Silver row is flagged.

The assertion that makes principle 1 a test rather than a sentence:
for every table, bronze rows == silver rows + quarantined rows.

Run order: ingest -> corrupt -> validate. Run the whole pipeline with:

    caregap run

Writes data/dq_report.json (reconciliation + catch rate) for the app and README.
"""

import json

import duckdb

from caregap import sql
from caregap.domain.checks import CHECKS, DEFECT_FOR, OBS_KEY, REVIEW
from caregap.domain.cohort import DIABETES_CODES
from caregap.config import (
    A1C, A1C_RANGE, ASOF, DB, DEFECT_LOG as LOG, DQ_REPORT as REPORT,
    REMEDIATION_RULE, SOURCES, sql_list,
)

DX_CODES = sql_list(DIABETES_CODES)

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


# ------------------------------------------------------------------- the runner
# The six checks are defined in checks.py. Each states what it reads, which rows
# fail, why in a sentence, and what happens to them; this runs any of them.
#
# Every check leaves a temp table of the rows it rejected (rej_DQn) or corrected
# (rem_DQn). Silver is then "Bronze minus rejects", so a row can only leave the
# pipeline through a table that records the reason.


def run_check(con, check):
    """Execute one check, writing its rejects, reviews or corrections."""
    if check["action"] == REVIEW:
        return _run_review(con, check)

    table, cid = check["table"], check["id"]
    scope = check.get("scope", "")
    # A row is rejected once. DQ5 defers to DQ1 on duplicates, so the rows DQ1
    # already took are excluded here rather than counted twice.
    excludes = ""
    if check.get("excludes"):
        excludes = f"AND rowid NOT IN (SELECT rid FROM rej_{check['excludes']})"

    predicate = check["predicate"]
    if excludes:
        predicate = (f"{predicate} {excludes}" if predicate.strip().upper().startswith("WHERE")
                     else f"WHERE TRUE {excludes} {predicate}")

    con.sql(f"""
        CREATE OR REPLACE TEMP TABLE rej_{cid} AS
        SELECT rowid AS rid, * FROM {table} {scope and scope + ' AND TRUE'} {predicate}
    """ if not scope else f"""
        CREATE OR REPLACE TEMP TABLE rej_{cid} AS
        SELECT rowid AS rid, * FROM {table}
        {scope} AND rowid IN (SELECT rowid FROM {table} {predicate})
    """)

    con.sql(f"""
        INSERT INTO quarantine
        SELECT '{table}', {check['key']}, {check['reason']}, '{cid}', '{ASOF}', to_json(r)
        FROM (SELECT * EXCLUDE (rid) FROM rej_{cid}) r
    """)

    if "remediate" in check:
        _run_remediation(con, check)


def _run_remediation(con, check):
    """Correct a value in place, keeping the original (principle 3)."""
    rem, cid, table = check["remediate"], check["id"], check["table"]
    scope = check.get("scope", "")
    con.sql(f"""
        CREATE OR REPLACE TEMP TABLE rem_{cid} AS
        SELECT {check['key']} AS row_key, {rem['field']} AS original,
               {rem['corrected']} AS corrected
        FROM {table} {scope} AND rowid IN (SELECT rowid FROM {table} {rem['predicate']})
    """)
    con.sql(f"""
        INSERT INTO remediation_log
        SELECT '{table}', row_key, '{rem['field']}', original, corrected::VARCHAR,
               '{rem['rule_text']}', '{ASOF}'
        FROM rem_{cid}
    """)


def _run_review(con, check):
    """Route candidate pairs to a human. Nothing is merged."""
    con.sql(f"""
        INSERT INTO identity_review
        SELECT candidate_a, candidate_b, match_fields, confidence, 'pending', NULL, NULL
        FROM ({check['pairs']})
    """)


# ------------------------------------------------------------------ 3.8 Silver

def build_silver(con):
    """Bronze minus the rejected rows, typed. The query is in sql/silver/build.sql."""
    con.sql(sql.load("silver/build.sql"))


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
    for check in CHECKS:
        run_check(con, check)
        print(f"  {check['id']}  {check['name']:24} {check['rule']}")
    build_silver(con)

    q = con.sql("SELECT check_id, count(*) FROM quarantine GROUP BY 1 ORDER BY 1").fetchall()
    print(f"\n  quarantine: {dict(q)}   identity_review: {con.sql('SELECT count(*) FROM identity_review').fetchone()[0]}"
          f"   remediation_log: {con.sql('SELECT count(*) FROM remediation_log').fetchone()[0]}")

    recon, balanced = reconcile(con)
    catches, types, caught, injected = catch_rate(con)

    report = {
        "asof": ASOF,
        # The matrix the Pipeline page renders is generated from the definitions
        # rather than maintained alongside them.
        "checks": [
            {"id": c["id"], "name": c["name"], "rule": c["rule"],
             "cause": c["cause"], "catches": DEFECT_FOR[c["id"]], "action": c["action"]}
            for c in CHECKS
        ],
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
