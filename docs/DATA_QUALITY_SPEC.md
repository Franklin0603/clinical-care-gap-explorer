# Data Quality Specification

Governs what happens to every row between Bronze and Silver.

## Principles

1. **Nothing is silently dropped.** Every rejected row lands in
   `quarantine` with a `failure_reason` and its source row identifier.
   In a clinical setting, someone will eventually ask why a patient was
   missing from a report. You must be able to answer.
2. **Identity is never auto-resolved.** Suspected duplicate patients go
   to a human. A wrong merge combines two people's medication lists.
3. **Remediation is recorded, not overwritten.** Corrected rows keep the
   original value in `original_value` and carry a `remediation_rule`.

## Injected defects (Day 2)

Written by `corrupt.py`, logged to `injected_defects.json` so catch rate
is measurable.

| # | Defect | Table | Realistic cause |
|---|--------|-------|-----------------|
| D1 | Duplicate encounter rows | encounters | Interface replay / double post |
| D2 | Null `patient_id` | observations | Failed foreign key on ingest |
| D3 | A1c value of 250 | observations | Unit error — mg/dL entered in a % field |
| D4 | Birth date in the future | patients | Registration typo |
| D5 | Discharge before admission | encounters | Timezone or clock error |
| D6 | Same patient, two MRNs | patients | Registered twice at different sites |

## Checks (Day 3)

| ID | Check | Rule | Action on failure |
|----|-------|------|-------------------|
| DQ1 | Encounter uniqueness | one row per (patient_id, encounter_id) | Quarantine dupes, keep earliest |
| DQ2 | Referential integrity | observations.patient_id exists in patients | Quarantine |
| DQ3 | A1c plausibility | **2.0** ≤ value ≤ 20.0 (%) — floor revised Day 1: 951 clean values sit below 3.0 | Value > 20 and 40–600 → treated as mg/dL glucose in a % field, converted A1c = (v + 46.7) / 28.7 (rule `A1C_MGDL_TO_PCT_EAG`), original kept; anything else out of range → quarantine (Decision D4) |
| DQ4 | Birth date sanity | birth_date < today AND age ≤ 120 | Quarantine |
| DQ5 | Encounter chronology | discharge ≥ admission | Quarantine |
| DQ6 | Patient identity | no two patients share name + birth date | Route to `identity_review` |

## Tables produced

**`quarantine`**
`source_table, source_row_id, failure_reason, check_id, quarantined_at, raw_payload`

**`identity_review`**
`candidate_a_mrn, candidate_b_mrn, match_fields, confidence, status, reviewed_by, reviewed_at`
Status starts as `pending`. Nothing downstream merges these.

**`remediation_log`**
`source_table, source_row_id, field, original_value, corrected_value, remediation_rule, applied_at`

## Catch rate

`detected defects / injected defects`. Report it on the Pipeline page
and in the README. If it is below 100%, say which defect got through and
why — a known, explained gap reads better than a claimed perfect score.

Result: **6 of 6** defect types detected (100%); 249 of 249 injected rows, each by the
check meant to catch it. Measured by `validate.py` against `injected_defects.json`
and written to `data/dq_report.json`. Reconciliation `bronze = silver + quarantine`
balances on all five tables.

## What I'd do differently at scale

Fill this in before shipping. Candidates: run checks as a
Great Expectations / dbt test suite instead of hand-rolled Python;
partition by load date; alert on catch-rate drift rather than absolute
counts; make quarantine reprocessable.
