-- Silver: Bronze minus the rejected rows, with real types.
--
-- A row can leave the pipeline in exactly two ways - it reaches a table here,
-- or it lands in quarantine with a reason. The rej_* temp tables are what each
-- check rejected; excluding them here is the only subtraction that happens.
-- `bronze = silver + quarantine` is asserted after this runs.
--
-- The column names are the dictionary's, not Synthea's: START and STOP mean
-- different things on encounters (admission, discharge) and on conditions
-- (onset, resolved), so the rename puts the meaning in the name.

CREATE OR REPLACE TABLE silver_patients AS
SELECT Id                            AS patient_id,
       Id                            AS mrn,          -- Synthea has no MRN; Id plays the role
       BIRTHDATE::DATE               AS birth_date,
       TRY_CAST(DEATHDATE AS DATE)   AS death_date,   -- null means alive
       GENDER                        AS sex,
       FIRST                         AS first_name,
       LAST                          AS last_name,
       'clean'                       AS _dq_status
FROM bronze_patients
WHERE Id NOT IN (SELECT Id FROM rej_DQ4);

CREATE OR REPLACE TABLE silver_encounters AS
SELECT Id                              AS encounter_id,
       PATIENT                         AS patient_id,
       START::TIMESTAMP                AS admission_ts,
       TRY_CAST(STOP AS TIMESTAMP)     AS discharge_ts,   -- null means still open
       ENCOUNTERCLASS                  AS encounter_type,
       CODE                            AS snomed_code,
       DESCRIPTION                     AS description,
       'clean'                         AS _dq_status
FROM bronze_encounters
WHERE rowid NOT IN (SELECT rid FROM rej_DQ1)
  AND rowid NOT IN (SELECT rid FROM rej_DQ5);

CREATE OR REPLACE TABLE silver_conditions AS
SELECT PATIENT                      AS patient_id,
       ENCOUNTER                    AS encounter_id,
       CODE                         AS snomed_code,
       DESCRIPTION                  AS description,
       START::DATE                  AS onset_date,
       TRY_CAST(STOP AS DATE)       AS resolved_date,  -- always null here; see D5
       'clean'                      AS _dq_status
FROM bronze_conditions;

-- value is DOUBLE, but 315,450 observations carry text results - smoking
-- status, survey answers. TRY_CAST alone would null every one of them while
-- the row sat in Silver looking clean, which is a silent drop wearing a
-- disguise. value_text keeps the original for every row; value is populated
-- only where the source was numeric.
CREATE OR REPLACE TABLE silver_observations AS
SELECT o.PATIENT                                              AS patient_id,
       o.ENCOUNTER                                            AS encounter_id,
       o.CODE                                                 AS loinc_code,
       o.DESCRIPTION                                          AS description,
       coalesce(m.corrected, TRY_CAST(o.VALUE AS DOUBLE))     AS value,
       o.VALUE                                                AS value_text,
       o.UNITS                                                AS unit,
       o.DATE::TIMESTAMP                                      AS observed_at,
       CASE WHEN m.row_key IS NOT NULL THEN 'remediated'
            ELSE 'clean' END                                  AS _dq_status
FROM bronze_observations o
LEFT JOIN rem_DQ3 m
       ON m.row_key = coalesce(o.ENCOUNTER, '') || '|' || o.CODE || '|' || o.DATE
WHERE o.rowid NOT IN (SELECT rid FROM rej_DQ2)
  AND o.rowid NOT IN (SELECT rid FROM rej_DQ3);

CREATE OR REPLACE TABLE silver_medications AS
SELECT PATIENT                      AS patient_id,
       ENCOUNTER                    AS encounter_id,
       CODE                         AS rxnorm_code,
       DESCRIPTION                  AS description,
       START::DATE                  AS start_date,
       TRY_CAST(STOP AS DATE)       AS end_date,       -- null means still active
       'clean'                      AS _dq_status
FROM bronze_medications;
