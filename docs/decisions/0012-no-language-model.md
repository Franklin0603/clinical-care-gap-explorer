# ADR-0012 · The question page ships no language model

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-27 |
| **Affects** | what the question page can honestly claim |

## Context

The plan called for natural-language-to-SQL over the Gold tables. That needs a
model behind an API key, and [ADR-0009](0009-static-export.md) made the site a
static export — a key shipped to the browser is a public key.

## Options considered

- **A serverless function holding the key** — genuine NL-to-SQL, but moves the
  deploy off static hosting and costs money per query on a public demo
- **Preset questions with hand-written SQL** — no model, but every statement is
  real

## Decision

**No model.** Ten preset questions carry hand-written SQL, executed in the
browser with DuckDB-WASM against the same files the site ships. A matcher maps
free text onto those questions and refuses anything it does not recognise.

The page says it is a query builder, not a language model.

## Consequences

**The SQL displayed is the SQL that ran.** Copy any statement off the page and
run it against the warehouse; you get the same rows. A hosted model could not
offer that without the same execution path.

Refusals are honest: an unrecognised question names what the page *can* answer
rather than guessing. Two confidently-wrong answers were found and fixed during
testing — a clinical-advice question that matched on a drug name, and a question
about a different lab that matched on the phrase "how many".

---

*Evidence: `web/lib/chips.test.ts` · 37 cases*
