# ADR-0005 · Who counts as a diabetic patient

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-23 |
| **Affects** | every number in the project |

## Context

The care-gap report needs a denominator: the set of patients the measure
applies to. Get it wrong and every percentage downstream is wrong.

*SNOMED is the international vocabulary for diagnoses — a number per condition,
because free text does not survive contact with reality: one system writes
"Diabetes mellitus type 2", another "T2DM", another "NIDDM".*

## Options considered

- **The type 2 code alone** (`44054006`) — obvious, and gives 88 patients
- **A value set** — several codes, the way published quality measures define
  their populations

## Decision

**Any of eight SNOMED codes ever recorded, on a patient alive on the as-of
date. Denominator: 116.**

Prediabetes (`714628002`) and hyperglycaemia (`80394007`) are explicitly
excluded; the full list with reasons is in `src/caregap/domain/cohort.py`.

## Consequences

**Anchoring on the obvious code would have dropped 45% of the cohort.** 73
patients carry a *complication* of diabetes — diabetic kidney disease,
retinopathy, neuropathy — with no diabetes diagnosis code anywhere on their
record. Their chart says, in effect: complication of a disease nobody wrote
down. They are also the sicker half.

**Prediabetes would have tripled the denominator.** 439 patients carry it. It
means blood sugar above normal but below the diagnostic threshold, and those
patients do not qualify for the measure.

**Excluding the deceased changed the headline from 69 of 161 to 25 of 116.** 45
code-carriers died before the as-of date, and the deceased accumulate stale
results because nobody orders tests for them — the report was partly measuring
mortality. A care-gap list is a call list.

No "still active" filter is needed: 0 of 835 diabetes condition rows carry an end
date, and clinically type 2 diabetes is managed rather than cured.

---

*Evidence: `notebooks/01_profile.ipynb` § cohort · `tests/test_cohort.py`*
