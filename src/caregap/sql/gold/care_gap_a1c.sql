-- Gold: care_gap_a1c, one row per diabetic patient.
--
-- The product of the whole pipeline, and the only table the report reads.
-- Sourced from Silver only: quarantined data must never reach Gold, or the
-- validation layer was decorative.
--
-- The LEFT JOIN to latest_a1c is the single most important word in this file.
-- A diabetic with no A1c on record is the highest-risk person on a care-gap
-- list. An inner join drops exactly those people - 21 of the 25 open gaps -
-- and nothing errors: the query runs in milliseconds and the numbers look
-- plausible. gold.py asserts on every run that they survived.
--
-- gap_flag tests `last_a1c_date IS NULL` explicitly rather than relying on
-- `days > 365`. With a null, that comparison is unknown rather than true, so
-- the flag would come out null - and null is not true.

CREATE OR REPLACE TABLE care_gap_a1c AS
WITH cohort AS (                                          -- D5
    SELECT DISTINCT c.patient_id, p.birth_date
    FROM silver_conditions c
    JOIN silver_patients p USING (patient_id)
    WHERE c.snomed_code IN ({dx_codes})
      AND (p.death_date IS NULL OR p.death_date > DATE '{asof}')
),
a1c AS (                                                  -- numeric results on or before as-of
    SELECT patient_id, observed_at, value
    FROM silver_observations
    WHERE loinc_code = '{a1c}' AND value IS NOT NULL AND observed_at <= TIMESTAMP '{asof}'
),
latest_a1c AS (
    SELECT patient_id, observed_at::DATE AS last_a1c_date, value AS last_a1c_value
    FROM a1c QUALIFY row_number() OVER (PARTITION BY patient_id ORDER BY observed_at DESC) = 1
),
a1c_2y AS (
    SELECT patient_id, count(*) AS a1c_count_2y FROM a1c
    WHERE observed_at >= TIMESTAMP '{asof}' - INTERVAL 730 DAY GROUP BY 1
),
first_dx AS (
    SELECT patient_id, min(onset_date) AS first_dx_date FROM silver_conditions
    WHERE snomed_code IN ({dx_codes}) GROUP BY 1
),
last_enc AS (
    SELECT patient_id, max(admission_ts)::DATE AS last_encounter_date FROM silver_encounters
    WHERE admission_ts <= TIMESTAMP '{asof}' GROUP BY 1
),
active_meds AS (                                          -- active on the as-of date
    SELECT patient_id, count(*) AS active_med_count,
           bool_or(rxnorm_code IN ({insulin})) AS on_insulin
    FROM silver_medications
    WHERE start_date <= DATE '{asof}' AND (end_date IS NULL OR end_date > DATE '{asof}')
    GROUP BY 1
),
under_review AS (
    SELECT candidate_a_mrn AS patient_id FROM identity_review WHERE status = 'pending'
    UNION SELECT candidate_b_mrn FROM identity_review WHERE status = 'pending'
),
base AS (
    SELECT c.patient_id,
           date_part('year', age(DATE '{asof}', c.birth_date))::INT     AS age,
           a.last_a1c_date,
           a.last_a1c_value,
           date_diff('day', a.last_a1c_date, DATE '{asof}')              AS days_since_a1c,  -- NULL when never tested
           (a.last_a1c_date IS NULL
            OR date_diff('day', a.last_a1c_date, DATE '{asof}') > {gap_days}) AS gap_flag,
           coalesce(m.active_med_count, 0)                               AS active_med_count,
           DATE '{asof}'                                                 AS asof_date,
           (a.last_a1c_date + INTERVAL {gap_days} DAY)::DATE             AS next_due_date,   -- NULL when never tested: due now
           CASE WHEN date_diff('day', a.last_a1c_date, DATE '{asof}') > {gap_days}
                THEN date_diff('day', a.last_a1c_date, DATE '{asof}') - {gap_days} END AS days_overdue,
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
