"""Build Gold: care_gap_a1c, one row per diabetic patient (Day 4).

Ported from pipeline/day4_gold.ipynb after review. Sourced from Silver only -
quarantined data never reaches Gold.

Decision D5 - diabetic patient: any of the eight SNOMED codes in cohort.py ever
recorded, on a patient alive on the as-of date. 45 of the 161 people carrying
a diabetes code died before the as-of date; a care-gap list is a call list.

Decision D6 - open A1c gap: no A1c result (LOINC 4548-4, numeric, observed on
or before the as-of date) in the 365 days before it. Never tested is a gap.
Exactly 365 days is not; 366 is. Ordered-but-not-resulted is not observable
in this data and is counted the same as never ordered - stated, not hidden.

Beyond the seven dictionary columns, nine more that the care team asked for and
the data can honestly support: next_due_date, days_overdue, a1c_count_2y,
first_dx_date, last_a1c_controlled, last_encounter_date,
identity_review_pending, on_insulin, and priority (a rank over open gaps only:
never-tested, then most overdue, then highest last value, then insulin, then
oldest). Two were dropped because the answer is constant or impossible here:
lost_to_followup (0 of 116) and phone/email (not in Synthea).

Finding: all 21 never-tested patients are complication-only - none carries
44054006, every one carries diabetic kidney disease, none is on insulin. The
patients a single-code cohort misses, an inner join deletes, and nobody treats
are the same 21 people.

The one LEFT JOIN in build() is the whole of task 4.3. An inner join from
cohort to observations deletes every never-tested patient - 21 of the 25 open
gaps here - and nothing errors.

Run order: load_bronze.py -> corrupt.py -> validate.py -> gold.py

    python pipeline/gold.py
"""

import json

import duckdb

from cohort import DIABETES_CODES
from load_bronze import DB
from validate import ASOF, A1C

GAP_DAYS = 365
INSULIN = "'106892', '311034'"   # RxNorm: Humulin 70/30, regular human insulin
REPORT = "data/gold_report.json"
DX_CODES = ", ".join(f"'{c}'" for c in DIABETES_CODES)


def build(con):
    con.sql(f"""
        CREATE OR REPLACE TABLE care_gap_a1c AS
        WITH cohort AS (                                          -- D5
            SELECT DISTINCT c.patient_id, p.birth_date
            FROM silver_conditions c
            JOIN silver_patients p USING (patient_id)
            WHERE c.snomed_code IN ({DX_CODES})
              AND (p.death_date IS NULL OR p.death_date > DATE '{ASOF}')
        ),
        a1c AS (                                                  -- numeric results on or before as-of
            SELECT patient_id, observed_at, value
            FROM silver_observations
            WHERE loinc_code = '{A1C}' AND value IS NOT NULL AND observed_at <= TIMESTAMP '{ASOF}'
        ),
        latest_a1c AS (
            SELECT patient_id, observed_at::DATE AS last_a1c_date, value AS last_a1c_value
            FROM a1c QUALIFY row_number() OVER (PARTITION BY patient_id ORDER BY observed_at DESC) = 1
        ),
        a1c_2y AS (
            SELECT patient_id, count(*) AS a1c_count_2y FROM a1c
            WHERE observed_at >= TIMESTAMP '{ASOF}' - INTERVAL 730 DAY GROUP BY 1
        ),
        first_dx AS (
            SELECT patient_id, min(onset_date) AS first_dx_date FROM silver_conditions
            WHERE snomed_code IN ({DX_CODES}) GROUP BY 1
        ),
        last_enc AS (
            SELECT patient_id, max(admission_ts)::DATE AS last_encounter_date FROM silver_encounters
            WHERE admission_ts <= TIMESTAMP '{ASOF}' GROUP BY 1
        ),
        active_meds AS (                                          -- active on the as-of date
            SELECT patient_id, count(*) AS active_med_count,
                   bool_or(rxnorm_code IN ({INSULIN})) AS on_insulin
            FROM silver_medications
            WHERE start_date <= DATE '{ASOF}' AND (end_date IS NULL OR end_date > DATE '{ASOF}')
            GROUP BY 1
        ),
        under_review AS (
            SELECT candidate_a_mrn AS patient_id FROM identity_review WHERE status = 'pending'
            UNION SELECT candidate_b_mrn FROM identity_review WHERE status = 'pending'
        ),
        base AS (
            SELECT c.patient_id,
                   date_part('year', age(DATE '{ASOF}', c.birth_date))::INT     AS age,
                   a.last_a1c_date,
                   a.last_a1c_value,
                   date_diff('day', a.last_a1c_date, DATE '{ASOF}')              AS days_since_a1c,  -- NULL when never tested
                   (a.last_a1c_date IS NULL
                    OR date_diff('day', a.last_a1c_date, DATE '{ASOF}') > {GAP_DAYS}) AS gap_flag,
                   coalesce(m.active_med_count, 0)                               AS active_med_count,
                   DATE '{ASOF}'                                                 AS asof_date,
                   (a.last_a1c_date + INTERVAL {GAP_DAYS} DAY)::DATE             AS next_due_date,   -- NULL when never tested: due now
                   CASE WHEN date_diff('day', a.last_a1c_date, DATE '{ASOF}') > {GAP_DAYS}
                        THEN date_diff('day', a.last_a1c_date, DATE '{ASOF}') - {GAP_DAYS} END AS days_overdue,
                   coalesce(y.a1c_count_2y, 0)                                   AS a1c_count_2y,
                   f.first_dx_date,
                   a.last_a1c_value < 7.0                                        AS last_a1c_controlled,  -- ADA target; NULL when never tested
                   e.last_encounter_date,
                   c.patient_id IN (SELECT patient_id FROM under_review)         AS identity_review_pending,
                   coalesce(m.on_insulin, false)                                 AS on_insulin
            FROM cohort c
            LEFT JOIN latest_a1c  a USING (patient_id)   -- LEFT, never INNER: never-tested patients must survive
            LEFT JOIN a1c_2y      y USING (patient_id)
            LEFT JOIN first_dx    f USING (patient_id)
            LEFT JOIN last_enc    e USING (patient_id)
            LEFT JOIN active_meds m USING (patient_id)
        )
        SELECT *,
               CASE WHEN gap_flag THEN row_number() OVER (                       -- worklist rank, open gaps only
                    PARTITION BY gap_flag
                    ORDER BY last_a1c_date IS NULL DESC, days_overdue DESC NULLS LAST,
                             last_a1c_value DESC NULLS LAST, on_insulin DESC, age DESC) END AS priority
        FROM base
    """)


def verify(con):
    """V4.1 - V4.9 as assertions. Any failure stops the pipeline."""
    one = lambda sql: con.sql(sql).fetchone()[0]
    checks = {
        "V4.1 one row per patient":
            one("SELECT count(*) = count(DISTINCT patient_id) FROM care_gap_a1c"),
        "V4.2 never-tested patients present and all flagged":
            one("SELECT count(*) > 0 AND bool_and(gap_flag) FROM care_gap_a1c WHERE last_a1c_date IS NULL"),
        "V4.3 days_since_a1c null-safe and plausible":
            one("SELECT count(*) = 0 FROM care_gap_a1c WHERE (last_a1c_date IS NULL AND days_since_a1c IS NOT NULL) "
                "OR days_since_a1c < 0 OR days_since_a1c > 40000"),
        "V4.4 gap_flag matches its definition":
            one(f"SELECT bool_and(CASE WHEN gap_flag THEN days_since_a1c IS NULL OR days_since_a1c > {GAP_DAYS} "
                f"ELSE days_since_a1c <= {GAP_DAYS} END) FROM care_gap_a1c"),
        "V4.5 cohort equals the written D5 definition":
            one(f"SELECT (SELECT count(*) FROM care_gap_a1c) = (SELECT count(DISTINCT c.patient_id) "
                f"FROM silver_conditions c JOIN silver_patients p USING (patient_id) WHERE c.snomed_code IN ({DX_CODES}) "
                f"AND (p.death_date IS NULL OR p.death_date > DATE '{ASOF}'))"),
        "V4.6 no quarantined patient in Gold":
            one("SELECT count(*) = 0 FROM care_gap_a1c g JOIN quarantine x "
                "ON x.source_row_id = g.patient_id AND x.source_table = 'bronze_patients'"),
        "V4.8 ages between 0 and 120":
            one("SELECT min(age) >= 0 AND max(age) <= 120 FROM care_gap_a1c"),
        "V4.11 priority set exactly for open gaps":
            one("SELECT bool_and((priority IS NOT NULL) = gap_flag) FROM care_gap_a1c"),
        "V4.12 next_due_date and days_overdue consistent with gap_flag":
            one("SELECT bool_and((next_due_date IS NULL) = (last_a1c_date IS NULL) "
                "AND (days_overdue IS NOT NULL) = (gap_flag AND last_a1c_date IS NOT NULL)) FROM care_gap_a1c"),
        "V4.9 gap rate neither 0% nor 100%":
            one("SELECT avg(gap_flag::INT) BETWEEN 0.01 AND 0.99 FROM care_gap_a1c"),
    }
    print("\nGold checks\n-----------")
    for name, ok in checks.items():
        print(f"  {'ok  ' if ok else 'FAIL'} {name}")
    return all(checks.values())


def summary(con):
    cohort, gaps, never, min_age, max_age, uncontrolled, insulin, review, due90, never_comp_only = con.sql("""
        SELECT count(*), count(*) FILTER (WHERE gap_flag), count(*) FILTER (WHERE last_a1c_date IS NULL),
               min(age), max(age),
               count(*) FILTER (WHERE last_a1c_controlled = false),
               count(*) FILTER (WHERE on_insulin),
               count(*) FILTER (WHERE identity_review_pending),
               count(*) FILTER (WHERE NOT gap_flag AND date_diff('day', asof_date, next_due_date) <= 90),
               count(*) FILTER (WHERE last_a1c_date IS NULL AND patient_id NOT IN
                                (SELECT patient_id FROM silver_conditions WHERE snomed_code = '44054006'))
        FROM care_gap_a1c""").fetchone()
    by_decade = con.sql("""
        SELECT (age // 10) * 10 AS decade, count(*) AS patients, count(*) FILTER (WHERE gap_flag) AS gaps
        FROM care_gap_a1c GROUP BY 1 ORDER BY 1""").fetchall()
    return {
        "asof": ASOF, "gap_days": GAP_DAYS,
        "cohort": cohort, "open_gaps": gaps, "gap_rate_pct": round(100 * gaps / cohort, 1),
        "never_tested": never, "never_tested_complication_only": never_comp_only,
        "uncontrolled_last_a1c": uncontrolled, "on_insulin": insulin,
        "identity_review_pending": review, "due_within_90_days": due90,
        "age_min": min_age, "age_max": max_age,
        "gaps_by_decade": [{"decade": d, "patients": p, "gaps": g} for d, p, g in by_decade],
    }


def main():
    con = duckdb.connect(DB)
    build(con)
    ok = verify(con)
    s = summary(con)
    con.close()

    print(f"\n  care_gap_a1c: {s['cohort']} patients, {s['open_gaps']} open gaps ({s['gap_rate_pct']}%), "
          f"{s['never_tested']} never tested, as of {ASOF}")
    with open(REPORT, "w") as fh:
        json.dump(s, fh, indent=1)
    print(f"  -> {REPORT}")
    if not ok:
        raise SystemExit("Gold failed a check - see FAIL above.")


if __name__ == "__main__":
    main()
