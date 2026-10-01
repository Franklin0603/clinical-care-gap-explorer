# Access Control Design

## Framing — read this before writing anything public

This demo **models the minimum necessary standard**. That is the HIPAA
principle that a workforce member should access only the information
required to do their job.

This demo is **not HIPAA compliant** and must never be described that
way. Compliance covers BAAs, audit infrastructure, breach procedures,
training, physical safeguards, and a real covered entity. A portfolio
app has none of that. Claiming it is the fastest way to lose credibility
with someone who works in health tech.

Correct phrasing:
> "Models minimum-necessary access by clinical role."

## Role matrix

| Data | PCT | Nurse | Physician |
|------|-----|-------|-----------|
| Patient name, MRN | ✔ | ✔ | ✔ |
| Age / sex | ✔ | ✔ | ✔ |
| Vitals | ✔ | ✔ | ✔ |
| Encounter schedule | ✔ | ✔ | ✔ |
| Care-gap flag | ✔ | ✔ | ✔ |
| A1c values | — | ✔ | ✔ |
| Active medications | — | ✔ | ✔ |
| Full condition history | — | partial | ✔ |
| Full medication history | — | — | ✔ |
| Cross-unit patient list | — | — | ✔ |

Adjust from your own floor experience — this matrix is a starting point,
and your version is more credible than mine. Note in the README that it
reflects how access is scoped on a real unit, not a textbook.

## Implementation

- Role is a UI selector. There is no authentication, and the README says so.
- Filtering happens **server-side, in the query layer** — not by hiding
  columns in the browser. A reviewer may open dev tools. If restricted
  data is in the payload, the demo argues against itself.
- Row-level and column-level filtering both apply: a PCT sees fewer
  columns *and* only patients on their assigned unit.
- When a role cannot see a field, show a labeled placeholder
  ("Not available for this role") rather than omitting the column
  silently. The restriction should be visible — that's the point.

## Audit log

Every query records: `role, question, generated_sql, row_count, run_at`.
Surface it on the Pipeline page. Access logging is a real requirement in
clinical systems, and showing it costs you almost nothing.

## Talking point

If asked why you built this: on the floor as a PCT you could see what
you needed for care tasks and nothing more, and that scoping is a
data architecture decision someone made upstream. This demo is that
decision, implemented.
