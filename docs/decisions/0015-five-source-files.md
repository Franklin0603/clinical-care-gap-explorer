# ADR-0015 · Load five of eighteen source files

| | |
|---|---|
| **Status** | Accepted |
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
