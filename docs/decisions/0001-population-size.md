# ADR-0001 · Generate 1,000 patients

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-23 |
| **Affects** | every row count in the project |

## Context

Synthea generates synthetic patients. More of them makes percentages steadier
and makes the dataset harder to dismiss as a toy; fewer makes every query
instant, which matters when the pipeline runs dozens of times a day for a week.

## Options considered

- **1,000** — sub-second queries, a cohort large enough for percentages to mean something
- **5,000+** — steadier numbers, but every iteration slower for seven days

## Decision

`-p 1000`, which produced **1,153 patient records**: 1,000 alive at the end of
the simulation plus 153 who died during it. Synthea's `-p` counts survivors, not
records — worth knowing before quoting a population figure.

## Consequences

Every query stays sub-second on a laptop. The cohort lands at 116 living
diabetic patients, large enough that a percentage is not noise.

Deceased patients are loaded into Bronze and Silver because they carry real
history; [ADR-0005](0005-cohort-definition.md) excludes them from the
care-gap denominator.

---

*Evidence: `notebooks/01_profile.ipynb` · row counts per file*
