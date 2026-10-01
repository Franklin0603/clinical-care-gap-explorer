# ADR-0004 · Correct impossible lab values rather than discard them

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-25 |
| **Affects** | 20 observations, and the project's stance on correction |

## Context

An A1c is a percentage. Nothing biological produces a value of 250.

Blood glucose measured in mg/dL lands at 250 routinely. So a 250 in an A1c field
is almost certainly a mis-keyed glucose reading — a unit error, not nonsense.
A human looking at it can see what was meant.

## Options considered

- **Quarantine it.** A single glucose reading is not an A1c; converting one
  invents a lab result that nobody measured.
- **Convert it.** The American Diabetes Association publishes a mapping between
  A1c and estimated average glucose. Inverted, 250 mg/dL is an A1c of 10.3% — a
  plausible, poorly-controlled diabetic.

## Decision

**Convert, and make the correction reversible.**

- `value > 20` and `40 ≤ value ≤ 600` → treated as mg/dL, converted with
  `A1c = (value + 46.7) / 28.7`, rule name `A1C_MGDL_TO_PCT_EAG`
- anything else out of range → quarantined, not guessed at

The original is kept in `remediation_log` and the Silver row is flagged
`remediated`.

## Consequences

A reviewer who disagrees excludes every corrected row with one `WHERE` clause.
That reversibility is the whole argument — quarantining throws the row away for
everyone, including people who would have trusted the conversion.

On this data both options produce the same gap count, so the choice was made on
principle rather than outcome. On real data a clinician should sign off on the
rule before it runs.

---

*Evidence: `notebooks/02_validate.ipynb` § DQ3 · both options costed before choosing*
