# ADR-0013 · HbA1c defines the gap, not blood glucose

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-23 |
| **Affects** | the measure itself |

## Context

Two blood tests could plausibly measure diabetes control.

**Blood glucose** is sugar in the blood right now; it swings hour to hour — a
meal takes it from 90 to 140 mg/dL and back.

**HbA1c** measures the fraction of haemoglobin with sugar permanently attached.
Red blood cells live about 120 days, so it averages roughly three months.

## Options considered

- **Glucose** — the larger table (10,439 results), more patients have one
- **A1c** — fewer results, but a different kind of measurement

## Decision

**HbA1c, LOINC `4548-4`.** Glucose (`2339-0`, `2345-7`) stays in the warehouse
as patient context and is never a gap definition.

## Consequences

Three reasons, two of them measurable in this data.

**Glucose is three times noisier.** For the same patient in the same year, the
spread between their highest and lowest result is 6.7% of the mean for A1c
against 21.3% for glucose. A control flag built on glucose would largely detect
what time of day someone visited.

**Its absence carries no signal.** Glucose rides along on routine blood panels,
so it is ordered whether or not anyone is thinking about diabetes — 387
non-diabetics have one. Within the cohort 159 of 161 have a glucose but only 133
have ever had an A1c. A gap report built on glucose would find almost nobody.

**It is not the measure that exists.** HEDIS specifies A1c. No published measure
requires an annual glucose, so using it would discard the claim that this
implements a real quality measure.

---

*Evidence: `notebooks/01_profile.ipynb` § A1c or glucose*
