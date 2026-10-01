# Documentation

**No healthcare background assumed.** Every clinical term is explained where it
first matters, and the one unavoidable piece of vocabulary is this:

> A **care gap** is a patient who qualifies for a routine piece of care and
> hasn't received it. This project finds diabetic patients overdue for a blood
> test called an **A1c**, which measures average blood sugar over about three
> months.

## Read in this order

**1 · [FINDINGS.md](FINDINGS.md)** — seven things building this turned up, with
the numbers. If you read one file, read this one. It opens with the finding the
project turns on: 21 patients who three separate ordinary mistakes would each
have hidden.

**2 · [CLINICAL_CONCEPTS.md](CLINICAL_CONCEPTS.md)** — the domain primer. What an
A1c is, why healthcare stores codes instead of words, what SNOMED and LOINC are
for, and where the twelve-month threshold comes from. Written for someone who
has never worked in healthcare.

**3 · [DECISIONS.md](DECISIONS.md)** — the fifteen judgment calls, each with the
evidence that settled it. **D5** and **D6** define who appears on the list and
why; every number in the project depends on those two.

**4 · [DATA_QUALITY_SPEC.md](DATA_QUALITY_SPEC.md)** — the six defects injected
on purpose, the six checks that catch them, and what I would do differently at
scale.

**5 · [DATA_DICTIONARY.md](DATA_DICTIONARY.md)** — every table and column, the
code systems, and the quirks of the raw data. Reference rather than narrative;
reach for it when a column name is unclear.

**6 · [ACCESS_CONTROL.md](ACCESS_CONTROL.md)** — how the role-based views work,
and why this models a principle rather than claiming compliance with anything.

## If you would rather see it run

| | |
|---|---|
| **The site** | https://franklin0603.github.io/clinical-care-gap-explorer/ |
| **The notebooks** | [`../notebooks/`](../notebooks/) — where the decisions were made, with the queries that made them still attached |
| **The pipeline** | `make generate` then `make test` |

`notebooks/01_profile.ipynb` is the best single artifact for understanding *why*
the cohort is defined the way it is: each section asks one question of the raw
data, shows the answer, and names the decision it settled.

## What's in here

```
docs/
├── FINDINGS.md             what building it revealed      ← start here
├── CLINICAL_CONCEPTS.md    the domain, in plain English
├── DECISIONS.md            fifteen calls, with evidence
├── DATA_QUALITY_SPEC.md    the defects, the checks, the catch rate
├── DATA_DICTIONARY.md      tables, columns, code systems
├── ACCESS_CONTROL.md       role-based access, and its limits
├── img/                    the six charts
└── planning/               mine, not reference material
    ├── PRD.md              what this was meant to be
    ├── REMAINING.md        what is still outstanding
    ├── VISUALS.md          charts specified but not built
    └── build-plan/         the seven-day plan and its spreadsheet
```

Everything under `planning/` is working material: a plan, a spreadsheet, a list
of what is left. It is kept because the decisions log and the validation gates
are real evidence of how this was built — but it is not written for a reader.
