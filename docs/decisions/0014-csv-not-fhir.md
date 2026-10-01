# ADR-0014 · Export CSV rather than FHIR

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-23 |
| **Affects** | how much of the week goes on parsing |

## Context

Synthea can export FHIR — healthcare's standard interchange format, nested JSON
documents, one bundle per patient — or flat CSV.

## Options considered

- **FHIR** — more realistic interchange, and an explicit non-goal for this project
- **CSV** — loads into DuckDB in one line

## Decision

**CSV.** `--exporter.csv.export true`, with all three FHIR exporters off.

## Consequences

The subject of this project is data quality, not parsing nested resources, so
CSV spends the week on the subject.

Worth knowing: `--exporter.fhir.export false` alone is not enough — hospital and
practitioner bundles have their own flags and will still be written.

---

*Evidence: `src/caregap/cli.py` · the generation command*
