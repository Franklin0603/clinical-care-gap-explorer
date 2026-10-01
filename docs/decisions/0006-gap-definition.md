# ADR-0006 · What counts as an open gap

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-26 |
| **Affects** | the numerator |

## Context

Given a cohort, the measure needs a rule for who is overdue. HEDIS — the
quality-measure standard US health plans are scored against — specifies an A1c
within twelve months.

## Options considered

- **Count only results we can see** — what the data supports
- **Distinguish "ordered but not resulted"** — clinically meaningful, but there
  is no orders table in this data to distinguish it with

## Decision

**No A1c result (LOINC `4548-4`, numeric, on or before the as-of date) in the
365 days before it. Never tested counts as a gap. Exactly 365 days is not a gap;
366 is.**

Corrected values ([ADR-0004](0004-remediate-unit-errors.md)) count as results.

## Consequences

**25 of 116 patients have an open gap. 21 have never been tested at all.**

Two things the number cannot see, stated here rather than discovered by a
reader:

- **Ordered but not resulted.** Synthea has no orders table, so "we ordered it
  and the patient never went" is indistinguishable from "we never ordered it".
  On real data those are different failures with different interventions — one
  is follow-up, the other is ordering. This counts them the same.
- **Results held in another lab system.** Invisible. The measure is really "no
  result *we can see*", which is what every care-gap report measures.

---

*Evidence: `notebooks/03_gold.ipynb` § 4.1 · `tests/test_gold.py`*
