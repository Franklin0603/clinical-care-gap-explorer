# ADR-0010 · Load the most restricted role first

| | |
|---|---|
| **Status** | Superseded by [0016](0016-patient-detail-over-role-views.md) |
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

## Superseded

The patient page no longer has a role switcher, so there is no first-loaded role
to choose. [ADR-0016](0016-patient-detail-over-role-views.md) records why the
control came out and what the page shows instead. The reasoning below still
stands for anything that does present a role chooser: open on the most
restricted view, so the first thing a reader meets is a restriction.
