# ADR-0010 · Load the most restricted role first

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-10 |
| **Affects** | the patient page's first impression |

## Context

The patient page demonstrates role-based access. Something has to be selected
when it loads.

## Options considered

- **Physician** — the fullest view, shows the most data
- **Patient care technician** — the most restricted view

## Decision

**Patient care technician.**

## Consequences

The first thing a viewer sees is a restriction — twelve columns reading "not
available for this role" — rather than a full table they then have to be told is
sometimes narrower. The restriction is the argument the page is making, so it
should not require a click to find.

---

*Evidence: `src/caregap/domain/access.py`*
