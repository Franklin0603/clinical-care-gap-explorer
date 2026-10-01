# ADR-0003 · Corrupt 249 rows, under 1% of any table

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-24 |
| **Affects** | the catch rate's denominator |

## Context

The pipeline deliberately damages data so the quality checks can be scored
against a known answer. How much to damage is a trade-off: too little and the
quarantine table looks contrived, too much and the cohort being reported on is
gutted.

## Options considered

- **A few rows per defect** — honest but unconvincing on screen
- **Hundreds per defect** — a convincing work queue, but it eats the cohort

## Decision

249 rows across six defect classes:

| Defect | Rows | Of | % |
|---|---:|---:|---:|
| Duplicate encounters | 40 | 67,755 | 0.06 |
| Observations with no patient | 150 | 870,510 | 0.02 |
| Impossible A1c values | 20 | 8,941 | 0.22 |
| Future birth dates | 8 | 1,153 | 0.69 |
| Discharge before admission | 25 | 67,755 | 0.04 |
| Duplicate registrations | 6 | 1,153 | 0.52 |

## Consequences

Nothing exceeds 1% of its table. The quarantine reads as a real work queue, and
the cohort survives intact at 116 patients.

The A1c corruptions are sampled from cohort patients specifically so that
[ADR-0004](0004-remediate-unit-errors.md) has a visible effect on the result.

---

*Evidence: `src/caregap/stages/corrupt.py` · `data/injected_defects.json`*
