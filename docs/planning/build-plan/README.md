# The seven-day build plan

Working material. This is how the project was planned and paced, kept because
the decisions log and the validation gates are evidence of process — not because
it is written for a reader.

**If you are reviewing the project, you want [`docs/`](../../) instead.**

## What is here

| | |
|---|---|
| `Clinical_Care_Gap_Build_Plan.xlsx` | The live workbook: task tracker, decisions log, DQ matrix, metrics, learning log |
| `DAY_1.md` … `DAY_7.md` | One file per day: tasks, why each matters, validation gates, and the ship gate that had to pass before moving on |
| `VALIDATION.md` | Every validation gate, V1.1 through V7.14, in one list |
| `DAY_1_GUIDE.md` | A worked walkthrough of day one — the only day that needed one |
| `LOAD_BRONZE_GUIDE.md` | An extended walkthrough of the Bronze loader |

## The shape of it

Seven days, about three hours each, each ending in a **ship gate** — a short
list of things that had to be true before the next day could start.

| Day | Theme | Ship gate |
|---|---|---|
| 1 | Ground truth | Bronze loaded, row counts matching the CSVs exactly |
| 2 | Break it on purpose | 249 defects injected and logged |
| 3 | The validation layer | `bronze = silver + quarantine` on every table |
| 4 | The answer | One command runs Synthea to Gold |
| 5 | Make it visible | A public URL with real data |
| 6 | Access by role | Restricted fields absent from the payload, not hidden |
| 7 | Ask it anything, then ship | Five hostile questions return five clean sentences |

The ordering is the part worth keeping: **the data quality work is built before
the thing it validates is made visible.** P2 before P3, injection before checks,
checks before Gold. Every day depends on the one before it having actually
worked, rather than having been declared finished.

## What the gates caught

The validation gates were not ceremony. Four found real problems:

- **V1.3** — regenerating with the same seed produced different data. Three
  more flags needed pinning ([ADR-0002](../../decisions/0002-pinned-seed.md)).
- **V4.2** — the never-tested patients must survive the join. This is the
  inner-join bug, caught as a gate rather than in production.
- **V7.11** — cloning the repo and following the README exactly surfaced two
  steps the README never mentioned.
- **V5.1** — four prose figures in the web copy were hardcoded and would have
  gone stale silently on a new seed.

Most of these gates are now tests in [`tests/`](../../../tests/), which is where
they belong — a gate you have to remember to run is a gate you eventually skip.

## Status

All seven days are complete. What remains is in
[`../REMAINING.md`](../REMAINING.md): four tasks that need a person rather than
code — the role matrix from floor experience, the learning log, a ninety-second
walkthrough, and the three-minute test.
