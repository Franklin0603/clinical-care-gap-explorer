# Day 3 — The Validation Layer

**~3 hours · Tracker IDs 3.1 – 3.11**

## Why today exists

This is the actual subject of the project. The care-gap query is easy — you
could write it in ten minutes. What makes the resulting list *trustworthy* is
everything you build today.

Three principles from `DATA_QUALITY_SPEC.md` govern every line you write:

1. **Nothing is silently dropped.** Every rejected row lands in `quarantine`
   with a reason. Someone will eventually ask why a patient was missing from a
   report. You must be able to answer.
2. **Identity is never auto-resolved.** Suspected duplicate patients go to a
   human.
3. **Remediation is recorded, not overwritten.** Corrected rows keep the
   original value.

Build the three destination tables *first*, before any check. Then no check has
an excuse to drop a row quietly.

## Learning objectives

By tonight you should be able to say, without notes:

- How you'd answer "why is this patient missing from the report?"
- Why DQ6 routes to a human, and the specific harm of a wrong merge
- Why `original_value` is kept, and who would ever need it
- How SQL's three-valued logic can make a check silently skip rows

---

## Tasks

### 3.1 — Build the three output tables first

`quarantine`, `identity_review`, `remediation_log` — exact schemas are in
`DATA_QUALITY_SPEC.md`. Note that `identity_review.status` starts as `pending`.

### 3.2 — DQ1: encounter uniqueness

One row per (patient_id, encounter_id). Quarantine duplicates, keep the
earliest.

**Be ready to defend "earliest."** Why not the latest? There's a real argument
either way — the latest might carry corrections, the earliest is what the care
team actually saw first. Pick one and know your reasoning.

**Look this up:** window functions, `ROW_NUMBER() OVER (PARTITION BY ...)`,
DuckDB's `QUALIFY` clause

### 3.3 — DQ2: referential integrity

Every `observations.patient_id` must exist in patients. Quarantine those that
don't.

**Why it can't be a silent delete:** an observation with no resolvable patient
means a lab result exists that nobody will ever see. Dropping it means nobody
ever learns it arrived. Quarantining it means someone can go find out whose
result it was.

**Look this up:** anti-join, `LEFT JOIN ... WHERE ... IS NULL`, `NOT EXISTS`

### 3.4 — DQ3: A1c plausibility, and the remediation decision

Range is 3.0–20.0. The spec says "remediate if divisible pattern suggests unit
error, else quarantine" — that's a hint, not a rule. **Write your actual rule
down first, in Decision D4, then implement it.**

Questions your rule has to answer: what specifically identifies a unit error
versus an implausible-but-genuine value? What conversion do you apply? At what
point do you refuse to guess and quarantine instead?

**This is the most technically interesting decision of the week.** It's also the
one where "I chose not to guess" is a perfectly strong answer, if you can say
why.

Every correction writes a `remediation_log` row with the original value
preserved.

**Look this up:** A1c vs estimated average glucose conversion, defensive data
correction, why silent correction is dangerous in clinical data

### 3.5 — DQ4: birth date sanity

In the past, and implied age <= 120.

**Decide what "today" means** — run-time date, or a fixed as-of date stored with
the run. This is Decision D7 and it comes back on Day 4 for age and gap math.
A run-time date makes your README numbers drift; a fixed date is reproducible
but goes stale. Both are defensible; choose knowingly.

### 3.6 — DQ5: encounter chronology

Discharge >= admission.

**Watch the nulls.** An encounter with no discharge timestamp is an open
encounter — valid data. In SQL, `NULL >= something` is neither true nor false,
it's unknown, so a naive `WHERE discharge < admission` won't flag it, but a
naive `WHERE NOT (discharge >= admission)` won't keep it either. Know which
behaviour you're getting and make it deliberate.

**Look this up:** three-valued logic in SQL, `IS NOT DISTINCT FROM`

### 3.7 — DQ6: identity review

No two patients share name + birth date. Matches go to `identity_review` with
status `pending`, a confidence score, and the fields that matched.

**Nothing downstream merges these.** Both patient records continue to exist
independently in Silver. That's not a limitation you're apologising for — it's
the correct design, and you should say so on the page.

**Look this up:** master patient index, match confidence scoring,
human-in-the-loop review

### 3.8 — Build Silver

Surviving rows only, with real types: dates as dates, values as doubles,
timestamps as timestamps. Add `_dq_status` (clean / remediated).

**Look this up:** `CAST` vs `TRY_CAST`, and why `TRY_CAST` matters when you're
knowingly working with dirty input

### 3.9 — Compute the catch rate

Read `injected_defects.json`. For each entry, did it end up in `quarantine`,
`identity_review`, or `remediation_log` with the right check id? Fill the
**DQ Matrix** sheet — the catch rate calculates itself.

**If it's below 100%, that's fine.** Say which defect got through and why. A
known, explained gap reads better than a claimed perfect score, because the
second one invites someone to go looking.

**Look this up:** precision and recall, evaluating against ground truth

### 3.10 — Assert no silent drops

For every table: `bronze rows = silver rows + quarantined rows`. Make this run
as part of the pipeline and **fail loudly** if the arithmetic doesn't balance.

**Why this is the most important task today:** it turns your first principle
from an assertion into a test. Anyone can write "nothing is silently dropped" in
a README. This proves it, every run.

Note the subtlety: for tables where you remediated rather than rejected, the
remediated rows are in Silver *and* in `remediation_log`. Your arithmetic has to
account for that without double-counting.

**Look this up:** reconciliation counts, assertions in data pipelines

### 3.11 — Commit

---

## Validation

### V3.1 — The reconciliation balances (the big one)
**Check:** for every table, `bronze count` vs `silver count + quarantined count`
**Expect:** exactly equal, every table, no exceptions
**If it fails:**
- Silver **too low** and quarantine didn't grow -> a check dropped rows silently.
  This is the failure the whole day exists to prevent. Find it.
- Silver **too high** -> a check ran but its rejects never got written.
- Counts off by exactly your remediated-row count -> you're double-counting
  remediated rows. Decide whether they belong in the Silver side (they do) and
  fix the arithmetic, not the data.

### V3.2 — Every quarantined row has a reason and a check id
**Check:** `SELECT check_id, failure_reason, count(*) FROM quarantine GROUP BY 1,2`
**Expect:** no nulls in either column; check ids only from DQ1–DQ6; every reason
is a readable sentence, not an exception message
**If it fails:** a check writes rejects without labelling them. On Day 5 this
table goes on screen — a column of nulls or stack-trace text undoes the
argument.

### V3.3 — Every quarantined row can be traced back
**Check:** pick five quarantine rows at random, use `source_table` +
`source_row_id` to find the original in Bronze
**Expect:** all five resolve, and `raw_payload` matches what's in Bronze
**If it fails:** you can't answer "why was this patient missing?", which is the
entire justification for the table existing.

### V3.4 — Catch rate is measured, not asserted
**Check:** confirm your catch-rate number came from comparing
`injected_defects.json` against the three output tables — not from counting
quarantine rows
**Expect:** a per-defect breakdown in the DQ Matrix sheet, with escapes named
**If it fails:** you're reporting how much you caught, with no denominator. That
number means nothing.

### V3.5 — No defect was caught by accident
**Check:** for each defect type, confirm it was caught by the check that was
*supposed* to catch it (check_id matches the DQ Matrix column)
**Expect:** D1->DQ1, D2->DQ2, D3->DQ3, D4->DQ4, D5->DQ5, D6->DQ6
**If it fails:** e.g. if D6's duplicate patient got quarantined by DQ4 for a bad
birth date, you have a coincidence, not a working check. Worth knowing before
someone asks.

### V3.6 — DQ5 left open encounters alone
**Check:** count encounters with a null discharge timestamp in Silver
**Expect:** they're all still there — none quarantined
**If it fails:** your null handling is wrong, and you're quarantining every
currently-admitted patient. This is the classic three-valued-logic bug.

### V3.7 — DQ6 did not merge anything
**Check:** confirm both patients from D6 exist independently in `silver_patients`
**Expect:** two separate rows, both present, plus one `pending` row in
`identity_review`
**If it fails:** you auto-merged. This violates the second principle in the spec
and it's the single worst outcome of the day.

### V3.8 — Remediation preserved the original
**Check:** `SELECT * FROM remediation_log`
**Expect:** every row has `original_value` populated, `corrected_value`
populated, and a named `remediation_rule`. The corrected value is also visible
in Silver, and that Silver row's `_dq_status` is `remediated`.
**If it fails:** if `original_value` is null you overwrote history. The whole
point is that a reviewer can see what changed and disagree with you.

### V3.9 — Silver is actually typed
**Check:** inspect column types on the Silver tables
**Expect:** dates are DATE, timestamps are TIMESTAMP, A1c values are DOUBLE —
not text
**If it fails:** Day 4's date arithmetic will either error or silently do string
comparison, which produces wrong answers rather than errors. Worse.

### V3.10 — Type casting didn't quietly eat rows
**Check:** count nulls in every column you cast in Silver, and compare against
the same column's null count in Bronze
**Expect:** the same, or a difference you can explain by a specific quarantine
**If it fails:** `TRY_CAST` turned unparseable values into nulls and the row
stayed in Silver looking clean. That's a silent drop wearing a disguise — those
rows should have been quarantined.

### V3.11 — Nothing invented itself
**Check:** confirm no Silver table has *more* rows than its Bronze source
**Expect:** Silver <= Bronze, always
**If it fails:** a join fanned out. Very common with the D6 duplicate patient —
if a patient exists twice, joining observations to patients can duplicate every
observation.

---

## Ship gate

- [ ] V3.1 passes for every table — this one is non-negotiable
- [ ] All six checks implemented and each catches its own defect (V3.5)
- [ ] `identity_review` has a pending row; nothing was merged (V3.7)
- [ ] Catch rate computed against `injected_defects.json` and in the DQ Matrix
- [ ] Decisions D4 and D7 recorded
- [ ] Day 3 committed

## Common ways Day 3 goes wrong

**A check quietly drops rows** and you don't notice because you never
reconciled. V3.1 exists for exactly this. Run it after every check, not once at
the end.

**Null handling in DQ5** quarantines every open encounter. Then Day 4's
encounter counts are mysteriously low.

**The D6 duplicate patient fans out a join** and observation counts explode.
V3.11 catches it.

**You auto-merge the duplicate identity** because it seemed obviously correct.
It reads as not having understood the risk.

**You chase 100% catch rate** by loosening a check until it catches the last
defect. Now the check has false positives and you've made the pipeline worse to
make one number nicer. Report the honest number.
