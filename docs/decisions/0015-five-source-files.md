# ADR-0015 · Load five of eighteen source files

| | |
|---|---|
| **Status** | Accepted, amended by [0016](0016-patient-detail-over-role-views.md) |
| **Date** | 2026-08-23 |
| **Affects** | pipeline runtime |

## Context

Synthea writes 18 files totalling 811 MB. Loading everything is the path of
least thought.

## Options considered

- **All eighteen** — nothing to decide, nothing missing later
- **Only what the measure needs** — faster, but a judgement call to defend

## Decision

**Five:** `patients`, `encounters`, `conditions`, `observations`, `medications`.

## Consequences

Left out deliberately:

- **`claims_transactions.csv` — 1,094,500 rows**, the single largest file, and a
  billing ledger with no bearing on a clinical care gap
- **`claims`, `payers`, `payer_transitions`** — insurance, a separate subject
- **`imaging_studies`, `procedures`, `devices`, `supplies`, `allergies`,
  `careplans`, `immunizations`** — real clinical data, no bearing on whether a
  diabetic patient had a blood test

The difference is a 13-second pipeline instead of a 3-minute one, run dozens of
times a week.

---

*Evidence: `notebooks/01_profile.ipynb` § what arrived*

## Amended, 2026-10-01

Six, not five. `procedures` was added for the patient detail view: it answers
"what has actually been done for this person", which is the question that
follows seeing a gap. 187,126 rows, and it reconciles like the others.

The reasoning below is unchanged and is why the other twelve files are still
out. `procedures` qualified on the same test the others failed: a stated
question that cannot be answered without it.
