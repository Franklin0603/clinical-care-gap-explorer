# How it fits together

```
Synthea CSVs ──▶ Bronze ──▶ Silver ──▶ Gold ──▶ static export ──▶ web app
                   │          │                       │
                   │          ├─▶ quarantine          └─▶ JSON + Parquet
                   │          ├─▶ identity_review
                   │          └─▶ remediation_log
                   └─▶ 249 defects injected on purpose
```

Five stages, 13 seconds end to end, each re-runnable and each verifying its own
work.

## The layers

**Bronze — a photocopy.** Every column loaded as text, nothing cast, deduped or
filtered. The only additions are `_loaded_at` and `_source_file`.

Loading as text is deliberate. Let the loader infer types and it will quietly
null whatever does not fit — a smaller row count, no error. A third of
observations here carry text results, so type inference would be a coin flip
about which rows survive.

**Silver — typed and validated.** Six checks run against Bronze. Surviving rows
are cast to real types; rejected rows land in `quarantine` with a reason.

**Gold — the answer.** `care_gap_a1c`, one row per diabetic patient, sourced
from Silver only. If Gold ever read Bronze, the validation layer would be
decorative.

## The guarantee

For every table, on every run:

```
bronze rows = silver rows + quarantined rows
```

The pipeline asserts this and stops when it fails. It is the difference between
"nothing is silently dropped" as a claim in a README and as a property somebody
can check.

A row leaves the pipeline in exactly two ways: it reaches Silver, or it is in
`quarantine` with a reason attached. Any third way is a silent drop, which is the
failure this project exists to prevent.

## Why the data is broken on purpose

Stage 2 damages 249 rows in six realistic ways and logs exactly what it damaged.

Without that log, a catch rate is a claim — "I found 12 problems" says nothing
about whether that was 12 of 12 or 12 of 400. With it, the checks are scored
against a known answer: **6 of 6 defect types, 249 of 249 rows, each caught by
the check meant for it.**

A defect found by the wrong check is a coincidence, not a working check, and the
score counts it as a miss.

## Where things live

| | |
|---|---|
| `src/caregap/domain/` | What the pipeline believes, as data: cohort codes, check definitions, the role matrix, source contracts. No plumbing — readable without following any SQL. |
| `src/caregap/stages/` | The five stages |
| `src/caregap/sql/` | The three statements long enough to deserve their own file |
| `src/caregap/config.py` | Every path, date, code and threshold, defined once |
| `src/caregap/manifest.py` | What each run did: commit, timings, row counts, what moved |
| `tests/` | 84 tests against the built warehouse — the properties worth guarding are properties of the data |
| `notebooks/` | Where the decisions were made, with the queries that made them |

## What it is not

Five stages running in 13 seconds on one machine. There is no scheduler, no
partitioning, no incremental load, and adding any of them would be ceremony
rather than engineering at this size.

What would change at scale — and what the trade-offs would be — is in
[data-quality.md](../reference/data-quality.md#what-id-do-differently-at-scale).
