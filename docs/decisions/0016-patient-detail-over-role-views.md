# ADR-0016 · A patient detail view instead of role views in the UI

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-01 |
| **Supersedes** | [0010](0010-default-role.md) |
| **Amends** | [0015](0015-five-source-files.md) |
| **Affects** | the patient page, the question page, one new source file |

## Context

The patient page shipped as a demonstration of role-based access: a switcher
between a patient care technician, a nurse and a physician, each loading a
separate export built by a query that never selected the restricted columns.

Watching it get read, two things were true. The restriction mechanism is a good
argument and it is worth making. And almost nobody found it by using the page.
A reader arrived on the most restricted view by [0010](0010-default-role.md),
saw a short table, and had no reason to suspect a fuller record existed behind a
control that looked like an account menu. The nurse and physician views differed
from each other by two columns and ten patients, which is invisible in the first
twenty rows.

Meanwhile the question a clinician actually has about a care-gap list is not
"which fields may I see". It is "what is going on with this person". The list
said a patient was 400 days overdue and stopped there.

## Options considered

- **Keep the role switcher and explain it harder.** The explaining was already
  the problem: the page needed a paragraph to justify a control nobody asked for.
- **Remove role scoping entirely**, including the matrix, the exports and the
  nine tests. Smallest surface, but it deletes the derived-column leak finding,
  which is the sharpest thing on the subject: `next_due_date` is
  `last_a1c_date + 365`, so withholding the value while keeping either derived
  column reconstructs the restricted date exactly.
- **Keep the pipeline, drop the UI control**, and spend the page on patient
  detail instead.

## Decision

**Keep the pipeline, drop the UI control.**

`domain/access.py`, the three role-scoped exports, `tests/test_access.py` and
[the access-control reference](../reference/access-control.md) all stay. That
argument is now made in prose and in tests, where it is read deliberately,
rather than in a dropdown where it was read by accident or not at all.

The web app reads one new export, `care_gap_full`, which is the same table with
nothing withheld under a name that carries no role. The page previously read
`care_gap_physician`, which left "physician" in the UI after the switcher came
out and made every page wanting the whole cohort look like it was adopting a
clinical point of view.

A row now opens a panel: every A1c on file as a line against the 7% control
target, tests per year so a lapse in testing looks like one, that patient's
latest value against the cohort's spread by age band, the medication list, and
the procedures performed.

## Loading a sixth source file

`procedures.csv` is now ingested, which amends [0015](0015-five-source-files.md)
from five files to six. 187,126 rows, and it reconciles like the rest.

It is **not** an orders table, and the panel says so in as many words.
Synthea exports procedures that happened; there is no requisition anywhere in
the dataset. So "we ordered an A1c and the patient never went" remains
indistinguishable from "nobody ever ordered one", which is the limitation
already recorded on the introduction page. The Silver column is called
`performed_date` rather than `ordered_date` so that nobody reads it the wrong
way later.

`DISPENSES` joins the medications contract for the same reason in reverse: it is
the only supply quantity Synthea exports, so a rising insulin burden can be
shown as fills and must never be presented as a dose, because there is no dose.

## Consequences

- The first thing a reader sees on the patient page is all 116 patients, not 70.
- The access-control argument is now only as discoverable as the documentation.
  That is a real loss, accepted on the grounds that a control nobody operates
  teaches nobody anything.
- 812 KB of patient detail, fetched when a row is first opened rather than
  imported, so the table does not wait on data most visitors never ask for.
- One more source file to re-ingest on every run, and about four extra seconds.
