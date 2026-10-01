# ADR-0007 · Freeze "today" at the simulation end date

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-26 |
| **Affects** | every date calculation |

## Context

Ages and the twelve-month window both need a definition of "now". Using the
wall clock is the obvious default.

## Options considered

- **Run-time date** — always current, but the published numbers drift daily
- **Fixed as-of date** — reproducible, but goes stale as a claim about the present

## Decision

**Frozen at 2026-08-23**, the date the simulated data ends. It is a constant in
`src/caregap/config.py` and is stamped on every row of the Gold table, so a
result always carries the date it was computed for.

## Consequences

The data stops on that date; no patient ever gets another result. With a
wall-clock "today" every patient becomes a gap eventually:

| If "today" were | Open gaps |
|---|---:|
| the as-of date | 25 |
| +3 months | 37 |
| +6 months | 50 |
| +12 months | **116 of 116** |

Freezing it makes the report describe the data rather than the calendar. Same
lesson as [ADR-0002](0002-pinned-seed.md), one layer up.

---

*Evidence: `docs/img/06_asof_drift.png`*
