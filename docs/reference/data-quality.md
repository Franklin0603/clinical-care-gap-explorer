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
balances on all six tables.

## What I'd do differently at scale

Written from what this build actually ran into, not from a list of tools.

**Orchestration.** `run_all.py` is a linear script: no retries, no partial reruns,
no memory of what succeeded. `corrupt.py` reloads Bronze at the top to guarantee
idempotency, which is correct and costs four seconds — at a hundred times the
data it is indefensible. This wants Dagster or Airflow, with each stage an asset
that knows its own dependencies, so a failed check re-runs validation rather than
regenerating the source data.

**Checks as a test suite, not hand-rolled Python.** DQ1–DQ6 are functions I wrote.
They work, and they will rot: a check that lives away from the model it validates
does not get updated when the model changes. dbt tests or Great Expectations fix
that by putting the assertion beside the thing asserted. The trade-off I would be
accepting is real, though — neither framework routes failing rows anywhere. They
fail the build. The quarantine-with-a-reason pattern, which is the part of this
project I would least want to lose, would have to be rebuilt on top.

**Alert on drift, not absolutes.** The catch rate is 6 of 6 today. The number worth
paging someone about is not "quarantine exceeded 500 rows" — that either fires
every day or never — but "the quarantine rate moved more than two standard
deviations from its trailing thirty-day mean". Absolute thresholds are how alerting
gets muted.

**Partition Bronze by load date.** Every run is a full reload. At a million rows
that is four seconds and partitioning would have been a day spent for nothing; at
a hundred million it is the whole problem. The trigger to change is when a reload
stops fitting in the window between one day's extract and the next.

**Make quarantine reprocessable.** Right now it is a dead-letter queue: rows go in
and nothing comes out. In a real system somebody fixes the upstream interface and
those 150 orphan observations become resolvable. That needs a replay path, a
`resolved_at` column, and a decision about whether a replayed row re-enters Silver
under its original load date or today's.

**DuckDB is a single-node engine, and I hit its edge.** It allows one writer. A
notebook kernel holding the database blocks every script, which cost me two
interruptions this week — a papercut here, a hard constraint with more than one
person. It is an excellent analytical engine and a poor shared warehouse. Every
transform in this repo is SQL rather than pandas specifically so that the
migration to Snowflake, BigQuery or Databricks is a connection string and a
dialect pass, not a rewrite.

**Pin every source of nondeterminism, then assert on it.** Setting the random seed
was not enough: the generator's clinician seed, reference date and simulation end
date all defaulted to the wall clock, and the same command produced different data
four weeks later. At scale the fix is not only pinning them but asserting a content
hash in CI, so the next drift is caught by a build rather than by someone checking.

**The limit the catch rate cannot see.** It scores my checks against defects I
designed, so it measures coverage of my own imagination. Real data fails in ways
nobody wrote a rule for. The complement is distribution monitoring — alerting when
the A1c distribution shifts or a code's frequency halves — which catches the class
of problem a rule-based check structurally cannot.
