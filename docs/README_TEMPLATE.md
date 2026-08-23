# Clinical Care Gap Explorer

Finds diabetic patients overdue for an A1c test — and shows the data
quality work required before that list can be trusted.

**Live demo:** ___
**Synthetic data only (Synthea). No PHI.**

---

## The question

Which diabetic patients have not had an A1c result in the last 12
months? This mirrors a real quality measure (HEDIS-style comprehensive
diabetes care) and is the kind of list a care team acts on directly.

**Result: ___ of ___ diabetic patients have an open A1c gap.**

## Why the middle matters

The query is easy. Trusting it is not. I deliberately injected six
classes of defect that occur in real clinical data — duplicate
encounters from interface replays, unit errors where mg/dL lands in a
percentage field, patients registered twice under different MRNs — and
built the validation layer that catches them.

**Catch rate: ___ of 6 defect types (___%).**

Rejected rows are quarantined with a reason, never dropped. Suspected
duplicate patients are flagged for human review, never auto-merged —
a wrong merge combines two people's medication lists.

## Architecture

Synthea → DuckDB → Bronze → Silver (validated) → Gold (`care_gap_a1c`) → Next.js

| Layer | Rows |
|-------|------|
| Bronze | ___ |
| Silver | ___ |
| Quarantined | ___ |
| Gold cohort | ___ |

## Pages

1. **Overview** — what this is, headline number
2. **Pipeline & Data Quality** — layer counts, six checks, quarantine, identity review queue
3. **Patient Care** — the cohort, with role-based access (PCT / Nurse / Physician)
4. **Ask the Data** — natural language → SQL, generated SQL always shown

## Access by role

Access is scoped to the **minimum necessary** for each clinical role.
This is not HIPAA compliance — it is a model of the access-scoping
principle, filtered server-side. There is no authentication; the role
selector is a demonstration control.

The matrix is based on my own experience as a patient care technician:
a PCT sees vitals and care tasks, a nurse adds labs and active
medications, a physician sees full history.

## Cohort definitions

**Diabetic patient:** ___
**Open A1c gap:** ___

## What I'd do differently at scale

___

## Not in scope

Clinical notes and NLP extraction, insurance claims, FHIR/OMOP
conformance, real authentication, cloud deployment. Each is a separate
project rather than a thin addition to this one.

## Run it

```bash
___
```
