# ADR-0012 · The question page ships no language model

| | |
|---|---|
| **Status** | Accepted, tested 2026-10-02 |
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

## Tested, 2026-10-02

The decision was made on deployment grounds and the capability question was
never asked. [`notebooks/05_text_to_sql.ipynb`](../../notebooks/05_text_to_sql.ipynb)
asks it: Claude gets the schema and the definitions, writes SQL for the same ten
questions, and the answers are compared against the hand-written queries.

Two of ten came back identical and one more returned the same figures in a
different shape. Most of the rest are defensible readings of an ambiguous
question rather than errors.

One was not. Asked which records are waiting on a human decision, it queried
`patients.identity_review_pending` instead of the `identity_review` table and
returned **zero rows** — not an error, not a refusal, an empty result that reads
as "nothing needs review" while six duplicate-patient pairs sit unadjudicated.

So the decision stands, and now for a tested reason: the preset page refuses
what it does not recognise, which is a worse experience and a safer failure. The
thing that would change the answer is better grounding rather than a better
model, and the notebook says what that would have to include.
