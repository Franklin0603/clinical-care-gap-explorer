# Data Dictionary

Source: Synthea synthetic patient generator. No real patient data.

## Code systems used

| System | Used for | Example |
|--------|----------|---------|
| SNOMED CT | Conditions / problem list | `44054006` — Diabetes mellitus type 2 |
| LOINC | Lab observations | `4548-4` — Hemoglobin A1c/Hemoglobin.total in Blood |
| RxNorm | Medications | `860975` — Metformin hydrochloride 500 MG ER |

**Join on codes. Never join on display names.** One system writes
`Diabetes mellitus type 2`, another `T2DM`, another `NIDDM`. A vendor can reword
a display string in a routine upgrade and break a report without erroring.

### Diabetes cohort — SNOMED CT

Confirmed present in this extract (`pipeline/profile.py`). A patient qualifies on
**any** of these. Authoritative list lives in `pipeline/cohort.py`.

| Code | Description | Patients |
|------|-------------|---------:|
| `127013003` | Disorder of kidney due to diabetes mellitus | 96 |
| `44054006` | Diabetes mellitus type 2 | 89 |
| `90781000119102` | Microalbuminuria due to type 2 diabetes mellitus | 83 |
| `157141000119108` | Proteinuria due to type 2 diabetes mellitus | 60 |
| `368581000119106` | Neuropathy due to type 2 diabetes mellitus | 31 |
| `1551000119108` | Nonproliferative diabetic retinopathy due to type II DM | 27 |
| `97331000119101` | Macular edema and retinopathy due to type 2 diabetes mellitus | 2 |
| `1501000119109` | Proliferative diabetic retinopathy due to type II DM | 1 |

**Cohort: 161 distinct patients.**

Excluded on purpose:

| Code | Description | Why excluded |
|------|-------------|--------------|
| `714628002` | Prediabetes (finding) | Not diabetes. 430 patients — would roughly triple the denominator, and does not qualify for the measure. |
| `80394007` | Hyperglycemia (disorder) | A finding, not a diagnosis. Occurs without diabetes. |

No type 1 diabetes code appears in this extract. Re-run `profile.py` before
trusting this list if the seed, state, or Synthea version changes.

### Lab observations — LOINC

| Code | Description | Units | Rows | Role |
|------|-------------|-------|-----:|------|
| `4548-4` | Hemoglobin A1c/Hemoglobin.total in Blood | `%` | 8,749 | **Defines the care gap.** DQ3 range check |
| `2339-0` | Glucose [Mass/volume] in Blood | `mg/dL` | 9,879 | Context only — never a gap definition |
| `2345-7` | Glucose [Mass/volume] in Serum or Plasma | `mg/dL` | 5,917 | Context only |

A1c is reported in **percent**, not mmol/mol — so DQ3's bounds are in the right
units. Observed range in this extract: **2.3 / 5.2 / 8.8** (min / median / max).

> **DQ3 needs revising.** The spec's floor of 3.0 flags **993 of 8,749** clean
> values — an 11% false-positive rate before any defect is injected. Proposed
> floor: 2.0. Nothing here exceeds 8.8, so the ceiling is untested.

Why A1c and not glucose: full reasoning in `DAY_1_DECISIONS.md` (D13). Short
version — A1c integrates ~3 months and varies 6.2% within a patient-year against
glucose's 21%; and glucose is drawn on everyone incidentally, so its absence
carries no signal.

### Diabetes medications — RxNorm

| Code | Description | Patients |
|------|-------------|---------:|
| `106892` | Insulin isophane 70 / insulin regular 30 [Humulin] | 59 |
| `860975` | 24 HR Metformin hydrochloride 500 MG ER Oral Tablet | 38 |
| `311034` | Insulin regular human 100 UNT/ML Injectable Solution | 13 |

Feeds `active_med_count` on the Gold table. Not part of the cohort definition —
a patient on metformin without a diagnosis code is a data quality question, not a
cohort member.

## Bronze (raw, as-loaded)

Straight from Synthea CSVs plus `_loaded_at` and `_source_file`.
No typing, no validation, no dedupe. **All columns load as `VARCHAR`** — if the
loader infers a type and meets a value it can't parse, it nulls or drops the row,
and V1.5 fails.

Five of the 18 CSVs are loaded (see `DAY_1_DECISIONS.md` D15):

| Bronze table | Source file | Rows |
|--------------|-------------|-----:|
| `bronze_patients` | `patients.csv` | 1,142 |
| `bronze_encounters` | `encounters.csv` | 65,350 |
| `bronze_conditions` | `conditions.csv` | 40,105 |
| `bronze_observations` | `observations.csv` | 836,111 |
| `bronze_medications` | `medications.csv` | 56,228 |

### Source column names

Synthea's column names are not the Silver names. The mapping is where Bronze→Silver
work actually happens:

| Silver column | Synthea source | Notes |
|---------------|----------------|-------|
| `patient_id` | `patients.Id`, or `PATIENT` on child tables | |
| `mrn` | **does not exist** | See below |
| `birth_date` | `patients.BIRTHDATE` | |
| `sex` | `patients.GENDER` | |
| `encounter_id` | `encounters.Id`, or `ENCOUNTER` on child tables | |
| `admission_ts` / `discharge_ts` | `encounters.START` / `STOP` | |
| `snomed_code` | `conditions.CODE` | |
| `onset_date` / `resolved_date` | `conditions.START` / `STOP` | |
| `loinc_code` | `observations.CODE` | |
| `value` / `unit` | `observations.VALUE` / `UNITS` | |
| `observed_at` | `observations.DATE` | |
| `rxnorm_code` | `medications.CODE` | |
| `start_date` / `end_date` | `medications.START` / `STOP` | |

> **Synthea emits no MRN.** `patients.csv` carries `Id`, `SSN`, `DRIVERS` and
> `PASSPORT` — no medical record number. Silver's `mrn` and defect D6 ("same
> patient, two MRNs") both assume one. Either derive an MRN in Silver or assign
> one at load. This is a Day 2 blocker, not a Day 1 one, but decide it before
> writing `corrupt.py`.

### Known quirks in the raw data

- **`observations.VALUE` is not always numeric.** LOINC `25428-4` carries text
  results, and appears under two different unit strings — `{nominal}` (6,662
  rows) and `{presence}` (175). One code, two units, in uncorrupted data.
- **Some rows are legitimately dated in the future.** Synthea simulates a few
  days past the reference time: 70 observations and 8 encounters fall after
  2026-08-23, max 2026-08-28. DQ4 is scoped to birth dates and is unaffected, but
  a naive "no future dates" check would flag 78 good rows.
- **142 of 1,142 patients are deceased** and carry a `DEATHDATE`. They belong in
  Bronze and Silver; they are excluded from the Gold care-gap denominator.

## Silver (typed, validated)

### `patients`
| Column | Type | Notes |
|--------|------|-------|
| patient_id | string | PK |
| mrn | string | Medical record number — not in source, must be derived |
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
| resolved_date | date | Null = active. **Always null in this dataset** — 0 of 819 diabetes rows carry one |

### `observations`
| Column | Type | Notes |
|--------|------|-------|
| patient_id | string | FK, DQ2 enforced |
| loinc_code | string | |
| value | double | DQ3 range check. Source is text and not always numeric |
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

## Cohort definition

**Diabetic patient** — *decided, D5:* any of the 8 SNOMED codes above, ever
recorded, with no active-as-of filter. Justified because 0 of 819 diabetes
condition rows carry a `STOP` date, so a diagnosis is permanent in this dataset;
and clinically, type 2 diabetes is managed rather than cured. Anchoring on
`44054006` alone would drop 72 patients (45% of the cohort) who carry a
complication with no underlying diagnosis code.

**Cohort: 161 patients.**

**Open A1c gap** — *open, D6, decide Day 4:* no `4548-4` result in 365 days.
Two questions still unanswered:

- Does an ordered-but-no-result count as a gap? (Clinically yes — the patient
  still has no number. Operationally it is a different work queue.)
- What is "today"? A run-time date makes README numbers drift daily. Recommend
  freezing at `2026-08-23` (D7).

For reference, at 365 days as of 2026-08-23: **73 of 161 (45%)** have an open
gap, and **30 have never had an A1c at all**.

Your answers to these two are the most interview-relevant lines in the whole
repo. Defend them in the README.
