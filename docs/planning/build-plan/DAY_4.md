# Day 4 — The Answer

**~3 hours · Tracker IDs 4.1 – 4.7**

## Why today exists

Today you produce `care_gap_a1c` — one row per diabetic patient, the product of
the entire pipeline. But first you have to lock two definitions, and those two
sentences are, per `DATA_DICTIONARY.md`, the most interview-relevant lines in
the whole repo.

You couldn't write them on Day 1 because you had no evidence. Now you do.

**Task 4.1 blocks everything else today.** Don't start building Gold with a
definition you intend to firm up later — the whole table changes shape when the
definition changes.

## Learning objectives

By tonight you should be able to say, without notes:

- Your definition of "diabetic patient" and what would change if you'd chosen
  the other one
- How a naive inner join silently deletes the highest-risk patients from a
  care-gap report
- What denominator and numerator mean in a quality measure

---

## Tasks

### 4.1 — Lock both cohort definitions (blocking)

Fill the two blanks at the bottom of `DATA_DICTIONARY.md`. Record in Decisions
D5 and D6, each with a one-line justification referencing what you found on
Day 1.

**Diabetic patient.** Any diabetes SNOMED code ever recorded, or only conditions
with no `resolved_date`? Task 1.11 gave you the resolved-date fill rate — use
it. If nothing ever resolves in Synthea, say that, and say what you'd do with
real data where it does.

**Open A1c gap.** No result in 365 days. But: does an *ordered but not resulted*
test count as a gap? What about a result that exists in a different lab system
you can't see?

That second question is worth thinking about properly, because it's the honest
one. In a real health system, "we ordered it and the patient never went" and
"we never ordered it" are completely different operational problems with
different interventions — but both look identical in a care-gap report that only
counts results. Most demos never notice. Saying it out loud, even if your v1
treats them the same, shows you understand what the number actually means.

**Look this up:** HEDIS comprehensive diabetes care specification, denominator
vs numerator in quality measures, care gap vs quality measure

### 4.2 — Build `care_gap_a1c`

Every column the data dictionary lists: `patient_id`, `age`, `last_a1c_date`,
`last_a1c_value`, `days_since_a1c`, `gap_flag`, `active_med_count`.

Source it from Silver only. Quarantined data must not appear in Gold.

**Look this up:** CTEs, getting the latest row per group (window function vs
`GROUP BY` + join)

### 4.3 — The never-tested patient

`days_since_a1c` must be null-safe. `gap_flag` must be TRUE for a patient who
has *never* had an A1c.

**This is the most likely serious bug in the entire build.** A diabetic patient
with no A1c on record is the highest-risk person on your list. An inner join
from patients to observations silently deletes exactly those people — the report
looks fine, the numbers look plausible, and the patients who most need
outreach are missing.

That's not a hypothetical. It's the class of bug that makes real care-gap
reports quietly useless, and being able to describe it is worth more than any
other single thing in this project.

**Look this up:** LEFT JOIN vs INNER JOIN, `COALESCE`, how arithmetic propagates
nulls

### 4.4 — Hand-verify three patients

Pick three and trace them from the raw CSVs all the way to their Gold row:

- one with a recent A1c (should NOT be flagged)
- one whose last A1c is over a year old (should be flagged)
- one who has never been tested (should be flagged, with a null date)

**Why:** there's no unit test that substitutes for this, and "I traced three
patients by hand" is a much better answer to "how did you know it was right?"
than "the query ran".

### 4.5 — One command, end to end

Generate -> load Bronze -> corrupt -> check -> build Silver -> build Gold.
FR1. This command goes in the README's "Run it" block.

**Look this up:** Makefile, shell script orchestration, `argparse` subcommands

### 4.6 — Record the numbers

Fill the Metrics sheet: bronze / silver / quarantined / gold counts, cohort
size, gap count, gap rate, never-tested count, pipeline runtime.

### 4.7 — Commit

---

## Validation

### V4.1 — Grain: one row per patient
**Check:** `SELECT count(*), count(DISTINCT patient_id) FROM care_gap_a1c`
**Expect:** the two numbers are equal
**If it fails:** a join fanned out. The usual culprit is a patient with multiple
condition rows, or the D6 duplicate patient. Gold's grain is one row per
patient, and if that's wrong every number on P1 is wrong.

### V4.2 — The never-tested patient survived
**Check:** `SELECT count(*) FROM care_gap_a1c WHERE last_a1c_date IS NULL`
**Expect:** greater than zero, and every one of those rows has `gap_flag = true`
**If it fails — zero rows:** you used an inner join and deleted your
highest-risk patients. This is the bug. Fix it before anything else.
**If it fails — `gap_flag` is false or null:** your gap logic doesn't handle
nulls. Null arithmetic yields null, and null is not true.

### V4.3 — `days_since_a1c` is null-safe
**Check:** `SELECT count(*) FROM care_gap_a1c WHERE last_a1c_date IS NULL AND days_since_a1c IS NOT NULL`
**Expect:** zero — no date means no day count
**Also check:** no negative values, and nothing implausibly large (a value over
~40,000 days means you're subtracting from the wrong date)

### V4.4 — `gap_flag` matches its own definition
**Check:** `SELECT gap_flag, min(days_since_a1c), max(days_since_a1c) FROM care_gap_a1c GROUP BY 1`
**Expect:** for `gap_flag = false`, max is at or below your threshold (365). For
`gap_flag = true`, min is above it — plus the null-date rows.
**If it fails:** an off-by-one or a boundary you never decided. Is exactly 365
days a gap? Pick one and be consistent.

### V4.5 — The cohort matches your locked definition
**Check:** count distinct patients matching your written D5 definition directly
against Silver, and compare with `count(*)` from `care_gap_a1c`
**Expect:** identical
**If it fails:** Gold is built on a different definition than the one you wrote
down. That's the kind of gap someone finds by reading your README and running
one query.

### V4.6 — No quarantined data leaked into Gold
**Check:** join Gold's patient ids against `quarantine` where source_table is
patients
**Expect:** no matches
**If it fails:** you sourced from Bronze somewhere. Gold must come from Silver
only — otherwise the entire validation layer was decorative.

### V4.7 — Three patients verified by hand
**Check:** you personally traced three patient ids from raw CSV to Gold row
**Expect:** all three agree, including the never-tested one
**If it fails:** don't move on. A discrepancy here means one of the earlier
checks is wrong in a way no automated test caught.

### V4.8 — Age is plausible
**Check:** `SELECT min(age), max(age) FROM care_gap_a1c`
**Expect:** nothing negative, nothing above 120 (DQ4 should have caught those),
and a distribution that skews older for a diabetic cohort
**If it fails — negative ages:** the future-birth-date defect reached Gold, so
DQ4 isn't working or Gold isn't sourced from Silver.

### V4.9 — The gap rate is believable
**Check:** gap count / cohort count
**Expect:** a number you can explain. Synthea generates fairly diligent care, so
a low gap rate is plausible. But 0% means your logic never fires, and 100% means
you're not finding A1c results at all — most likely your LOINC filter is wrong,
or the observation-to-patient join is failing.
**If it fails:** check that A1c observations actually join to cohort patients
before assuming the gap logic is wrong.

### V4.10 — End to end, from nothing
**Check:** delete the warehouse file, run your single command, then re-run every
Day 3 and Day 4 validation
**Expect:** all pass, and the numbers match the Metrics sheet
**If it fails:** you have manual steps you've forgotten about. Find them now —
this same command is what a reviewer runs, and what you'll depend on all week.

---

## Ship gate

- [ ] Both cohort definitions written into `DATA_DICTIONARY.md` and Decisions
- [ ] V4.1, V4.2, V4.6 and V4.10 all pass
- [ ] Three patients hand-verified
- [ ] One command runs the whole pipeline from a clean state
- [ ] Metrics sheet fully populated
- [ ] Day 4 committed

## Common ways Day 4 goes wrong

**The inner join.** Never-tested patients vanish. Everything looks fine. This is
the one to be paranoid about — V4.2 is your guard.

**You start building before locking the definition** and rewrite Gold twice.

**Duplicate patients fan out the grain** and your cohort count is inflated.

**You quietly change the definition to make the number look better.** If the gap
rate comes out at 3% and feels unimpressive, the fix is to report 3% and explain
why Synthea's synthetic care patterns are diligent — not to widen the window
until the number looks good. That instinct, stated out loud, is worth more than
a bigger number.
