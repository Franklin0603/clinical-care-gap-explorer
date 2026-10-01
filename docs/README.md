# Documentation

**No healthcare background assumed.** Terms are explained where they first
matter. The one piece of vocabulary worth having up front:

> A **care gap** is a patient who qualifies for a routine piece of care and
> hasn't received it. This project finds diabetic patients overdue for a blood
> test called an **A1c**, which measures average blood sugar over about three
> months.

## Where to start

**New to the project** → [findings](explanation/findings.md), then
[clinical concepts](explanation/clinical-concepts.md). Twenty minutes, and you
will understand both what was found and the domain it sits in.

**Reviewing the engineering** → [architecture](explanation/architecture.md),
then [decisions](decisions/), then [data quality](reference/data-quality.md).

**Trying to use it** → [run the pipeline](how-to/run-the-pipeline.md).

**Looking something up** → [reference/](reference/).

## Layout

Organised by what each document is *for*, following
[Diátaxis](https://diataxis.fr/): explanation discusses, how-to guides perform a
task, reference states facts.

```
docs/
├── explanation/        understanding-oriented — why things are as they are
│   ├── findings.md         seven things building this turned up  ← start here
│   ├── clinical-concepts.md  the domain, in plain English
│   └── architecture.md     how the pipeline fits together
│
├── how-to/             task-oriented — how do I do X
│   ├── run-the-pipeline.md
│   ├── add-a-quality-check.md
│   └── answer-a-clinical-question.md
│
├── reference/          information-oriented — facts to look up
│   ├── data-dictionary.md    every table, column and code system
│   ├── data-quality.md       the six defects, the six checks, scale notes
│   └── access-control.md     role-based access, and its limits
│
├── decisions/          fifteen ADRs, one per decision
├── html/               shareable self-contained pages — open in any browser
├── img/                the six charts
└── planning/           working material, not written for a reader
```

## The three documents that carry the project

**[explanation/findings.md](explanation/findings.md)** — seven findings with
their numbers. It opens with the one the project turns on: 21 patients that
three separate ordinary mistakes would each have hidden.

**[decisions/0005](decisions/0005-cohort-definition.md) and
[0006](decisions/0006-gap-definition.md)** — who appears on the care-gap list
and why. Every number depends on these two.

**[reference/data-quality.md](reference/data-quality.md)** — 249 defects
injected deliberately so the catch rate is a measurement rather than a claim.

## If you would rather see it run

| | |
|---|---|
| **The site** | https://franklin0603.github.io/clinical-care-gap-explorer/ |
| **Offline pages** | [`html/`](html/) — findings, the primer and the architecture as standalone files |
| **The notebooks** | [`../notebooks/`](../notebooks/) — decisions with the queries that made them still attached |
| **The pipeline** | [how-to/run-the-pipeline.md](how-to/run-the-pipeline.md) |

`notebooks/01_profile.ipynb` is the single best artifact for understanding *why*
the cohort is defined as it is: each section asks one question of the raw data,
shows the answer, and names the decision it settled.
