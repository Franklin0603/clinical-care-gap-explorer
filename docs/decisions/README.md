# Decision records

Sixteen decisions, one file each, in the [ADR](https://adr.github.io/) format:
context, the options that were on the table, the call, and what it cost.

Borrowed format, for a reason that applies even to a project this size —
decisions outlive the code that implements them. The *why* is the part that is
expensive to reconstruct six months later, and the part an interviewer asks
about.

**Start with [0005](0005-cohort-definition.md) and [0006](0006-gap-definition.md).**
Together they define who appears on the care-gap list and why. Every number in
the project rests on those two.

## The decisions

| | Decision | Call | Affects |
|---|---|---|---|
| [0001](0001-population-size.md) | Population size | 1,000 alive → 1,153 records | every row count |
| [0002](0002-pinned-seed.md) | Pin four time flags, not just the seed | `-s -cs -r -e` | reproducibility |
| [0003](0003-corruption-volume.md) | How much data to corrupt | 249 rows, <1% of any table | the catch rate |
| [0004](0004-remediate-unit-errors.md) | Impossible lab values | correct, reversibly | 20 observations |
| [0005](0005-cohort-definition.md) | **Who counts as diabetic** | 8 codes, alive → 116 | **everything** |
| [0006](0006-gap-definition.md) | **What counts as a gap** | no A1c in 365 days | **everything** |
| [0007](0007-fixed-as-of-date.md) | What "today" means | frozen at 2026-08-23 | every date |
| [0008](0008-quarantine-is-terminal.md) | Can rejected rows return | no, not in v1 | the reconciliation |
| [0009](0009-static-export.md) | How the app reads data | build-time snapshot | deployment |
| [0010](0010-default-role.md) | Which role loads first | the most restricted | ~~first impression~~ superseded |
| [0011](0011-age-bands.md) | How to band ages | the measure's boundaries | one chart |
| [0012](0012-no-language-model.md) | What powers the question page | no model | its claims |
| [0013](0013-a1c-not-glucose.md) | Which lab defines the gap | HbA1c | the measure |
| [0014](0014-csv-not-fhir.md) | Export format | CSV | the week's budget |
| [0015](0015-five-source-files.md) | Which files to load | 5 of 18, now 6 | runtime |
| [0016](0016-patient-detail-over-role-views.md) | Role views, or patient detail | patient detail | the patient page |

## The three worth reading if you only read three

**[0002 · Pin four time flags](0002-pinned-seed.md)** — the README claimed the
numbers were reproducible. Testing that claim four weeks later found it false,
in three separate ways.

**[0005 · Who counts as diabetic](0005-cohort-definition.md)** — the obvious
definition drops 45% of the cohort, specifically the sicker half.

**[0004 · Correct impossible values](0004-remediate-unit-errors.md)** — the one
where both options were defensible, both were costed, and the choice came down
to which failure a reviewer could undo.
