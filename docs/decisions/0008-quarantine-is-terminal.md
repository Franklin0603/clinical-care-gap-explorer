# ADR-0008 · Quarantined rows do not re-enter the pipeline

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-25 |
| **Affects** | the reconciliation guarantee |

## Context

Rejected rows land in a `quarantine` table with a reason rather than being
dropped. The question is whether anything ever brings them back — in a real
system somebody fixes the upstream interface and those rows become resolvable.

## Options considered

- **Reprocessable queue** — closer to production, but needs a replay path, a
  `resolved_at` column, and a rule for which load date a replayed row belongs to
- **Dead-letter queue** — terminal in v1, with the replay path named as scale work

## Decision

**Terminal.** Rows go in and nothing comes out.

## Consequences

A half-built replay path would make `bronze = silver + quarantine` ambiguous,
and that assertion is the one guarantee in this project worth keeping exact — it
is asserted on every run and fails the build.

Named explicitly as scale work in `docs/reference/data-quality.md` rather than
left as an unexplained absence.

---

*Evidence: `src/caregap/stages/validate.py` · `tests/test_reconciliation.py`*
