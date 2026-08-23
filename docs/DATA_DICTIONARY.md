# Data Dictionary

Source: Synthea synthetic patient generator. No real patient data.

## Code systems used

| System | Used for | Example |
|--------|----------|---------|
| SNOMED CT | Conditions / problem list | Type 2 diabetes mellitus |
| LOINC | Lab observations | 4548-4 — Hemoglobin A1c/Hemoglobin.total in Blood |
| RxNorm | Medications | metformin |

Record the exact codes you filter on here once you confirm them in the
Synthea output. Do not hardcode display names — join on codes.

## Bronze (raw, as-loaded)

Straight from Synthea CSVs plus `_loaded_at` and `_source_file`.
No typing, no validation, no dedupe.

## Silver (typed, validated)

### `patients`
| Column | Type | Notes |
|--------|------|-------|
| patient_id | string | PK |
| mrn | string | Medical record number |
| birth_date | date | DQ4 enforced |
| sex | string | |
| _dq_status | string | clean / remediated |

### `encounters`
| Column | Type | Notes |
|--------|------|-------|
| encounter_id | string | PK |
| patient_id | string | FK |
| admission_ts | timestamp | |
| discharge_ts | timestamp | DQ5: ≥ admission_ts |
| encounter_type | string | |

### `conditions`
| Column | Type | Notes |
|--------|------|-------|
| patient_id | string | FK |
| snomed_code | string | Diabetes cohort defined here |
| onset_date | date | |
| resolved_date | date | Null = active |

### `observations`
| Column | Type | Notes |
|--------|------|-------|
| patient_id | string | FK, DQ2 enforced |
| loinc_code | string | |
| value | double | DQ3 range check |
| unit | string | |
| observed_at | timestamp | Drives the 12-month window |

### `medications`
| Column | Type | Notes |
|--------|------|-------|
| patient_id | string | FK |
| rxnorm_code | string | |
| start_date | date | |
| end_date | date | Null = active |

## Gold

### `care_gap_a1c`
One row per diabetic patient. The product of the whole pipeline.

| Column | Type | Notes |
|--------|------|-------|
| patient_id | string | |
| age | int | Derived at run time |
| last_a1c_date | date | Null = never tested |
| last_a1c_value | double | |
| days_since_a1c | int | Null-safe |
| gap_flag | boolean | True if > 365 days or never |
| active_med_count | int | |

## Cohort definition — write this down before you build

**Diabetic patient:** ______________________________________
(any diabetes SNOMED code ever recorded? or only unresolved?)

**Open A1c gap:** ______________________________________
(no result in 365 days — what about ordered-but-no-result?)

Your answers to these two are the most interview-relevant lines in the
whole repo. Defend them in the README.
