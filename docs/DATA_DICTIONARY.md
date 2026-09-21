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
| `127013003` | Disorder of kidney due to diabetes mellitus | 102 |
| `44054006` | Diabetes mellitus type 2 | 88 |
| `90781000119102` | Microalbuminuria due to type 2 diabetes mellitus | 89 |
| `157141000119108` | Proteinuria due to type 2 diabetes mellitus | 64 |
| `368581000119106` | Neuropathy due to type 2 diabetes mellitus | 25 |
| `1551000119108` | Nonproliferative diabetic retinopathy due to type II DM | 24 |
| `97331000119101` | Macular edema and retinopathy due to type 2 diabetes mellitus | 3 |
| `1501000119109` | Proliferative diabetic retinopathy due to type II DM | 1 |

**161 distinct patients carry at least one; 116 of them are alive on the as-of date (the Gold denominator, D5).**

Excluded on purpose:

| Code | Description | Why excluded |
|------|-------------|--------------|
| `714628002` | Prediabetes (finding) | Not diabetes. 439 patients — would roughly triple the denominator, and does not qualify for the measure. |
| `80394007` | Hyperglycemia (disorder) | A finding, not a diagnosis. Occurs without diabetes. |

No type 1 diabetes code appears in this extract. Re-run `profile.py` before
trusting this list if the seed, state, or Synthea version changes.

### Lab observations — LOINC

| Code | Description | Units | Rows | Role |
|------|-------------|-------|-----:|------|
| `4548-4` | Hemoglobin A1c/Hemoglobin.total in Blood | `%` | 8,941 | **Defines the care gap.** DQ3 range check |
| `2339-0` | Glucose [Mass/volume] in Blood | `mg/dL` | 10,439 | Context only — never a gap definition |
| `2345-7` | Glucose [Mass/volume] in Serum or Plasma | `mg/dL` | 6,364 | Context only |

A1c is reported in **percent**, not mmol/mol — so DQ3's bounds are in the right
units. Observed range in this extract: **2.3 / 4.1 / 8.8** (min / median / max).

> **DQ3 needs revising.** The spec's floor of 3.0 flags **951 of 8,941** clean
> values — an 11% false-positive rate before any defect is injected. Proposed
> floor: 2.0. Nothing here exceeds 8.8, so the ceiling is untested.

Why A1c and not glucose: full reasoning in `DAY_1_DECISIONS.md` (D13). Short
version — A1c integrates ~3 months and varies 6.7% within a patient-year against
glucose's 21.3%; and glucose is drawn on everyone incidentally, so its absence
carries no signal.

### Diabetes medications — RxNorm

| Code | Description | Patients |
|------|-------------|---------:|
| `106892` | Insulin isophane 70 / insulin regular 30 [Humulin] | 69 |
| `860975` | 24 HR Metformin hydrochloride 500 MG ER Oral Tablet | 42 |
| `311034` | Insulin regular human 100 UNT/ML Injectable Solution | 14 |

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
| `bronze_patients` | `patients.csv` | 1,153 |
| `bronze_encounters` | `encounters.csv` | 67,755 |
| `bronze_conditions` | `conditions.csv` | 40,811 |
| `bronze_observations` | `observations.csv` | 870,510 |
| `bronze_medications` | `medications.csv` | 59,273 |

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
  results, and appears under two different unit strings — `{nominal}` (7,284
  rows) and `{presence}` (167). One code, two units, in uncorrupted data.
- **252 observations are generator metadata, not clinical data.** Codes `QALY`,
  `DALY` and `QOLS` — Synthea's quality-of-life scores. No LOINC code, no
  encounter, no category, and dated at generation time rather than within the
  simulation. They cannot join to anything and drop out of Silver on their own.
  Every clinical row ends at the pinned end date, 2026-08-23.
- **153 of 1,153 patients are deceased** and carry a `DEATHDATE`. They belong in
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
| resolved_date | date | Null = active. **Always null in this dataset** — 0 of 835 diabetes rows carry one |

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
| age | int | On the as-of date, not the wall clock |
| last_a1c_date | date | Null = never tested |
| last_a1c_value | double | |
| days_since_a1c | int | Null-safe |
| gap_flag | boolean | True if > 365 days or never |
| active_med_count | int | Medications active on the as-of date |
| asof_date | date | Decision D7; every row carries the date it was computed for |

## Cohort definition

**Diabetic patient** — *decided, D5:* any of the 8 SNOMED codes above, ever
recorded, on a patient **alive on the as-of date**. Justified because 0 of 835
diabetes condition rows carry a `STOP` date, so a diagnosis is permanent in this
dataset (and clinically, type 2 diabetes is managed rather than cured); and
because a care-gap list is a call list — 45 of the 161 people carrying a diabetes
code died before 2026-08-23, and HEDIS excludes deceased members from the
denominator. Anchoring on `44054006` alone would drop 73 patients (45%) who
carry a complication with no underlying diagnosis code.

**Denominator: 116 patients.**

**Open A1c gap** — *decided, D6:* no A1c result (LOINC `4548-4`, numeric value,
observed on or before the as-of date) in the 365 days before the as-of date. A
patient who has never been tested is a gap. Exactly 365 days is not a gap; 366
is. Remediated values (Decision D4) count as results.

Two things the number cannot see, stated rather than hidden:

- *Ordered but not resulted.* Synthea has no orders table and no procedure row
  mentions A1c, so "we ordered it and the patient never went" and "we never
  ordered it" are indistinguishable here. On real data they are different
  problems with different fixes; v1 counts them the same.
- *Results in another lab system.* Invisible. The measure is "no result we can
  see", which is what every care-gap report actually measures.

**Result as of 2026-08-23: 25 of 116 (21.6%) have an open gap; 21 of those 25
have never had an A1c at all.** On the full 161 including the deceased the count
is 69 — which is why the deceased are excluded.

Your answers to these two are the most interview-relevant lines in the whole
repo. Defend them in the README.
