# ADR-0009 · The web app reads a build-time snapshot

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-05 |
| **Affects** | deployment, and what the question page can do |

## Context

The site needs the pipeline's output. A server could query the DuckDB file per
request; a build step could export it.

## Options considered

- **Query DuckDB at request time** — genuinely live, but the native library is
  heavy for serverless and the filesystem is ephemeral and read-only
- **Static export** — deploys anywhere, but the site reads a snapshot

## Decision

**Static export.** The pipeline writes **JSON** for the pages to render at build
time and **Parquet** for in-browser querying — 458 KB total.

## Consequences

The site deploys as static files with no server runtime, and the deploy worked
on day five rather than being discovered broken on day seven.

**The trade-off accepted:** re-running the pipeline without re-exporting leaves
the site stale. That is why the export is the last stage of the pipeline rather
than a step somebody has to remember.

Shipping both formats enables [ADR-0012](0012-no-language-model.md): the pages
render instantly from JSON, and the question page queries the Parquet in the
browser.

---

*Evidence: `src/caregap/stages/publish.py`*
