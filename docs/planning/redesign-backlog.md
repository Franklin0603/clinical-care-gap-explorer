# Redesign backlog

Things noticed during the redesign phases and left on purpose, so each phase
stayed inside its brief. Nothing here is broken. Review the list once every
phase is built and decide what to do with each item.

Each phase adds what it leaves behind to its own section.

## From phase 2 (Home)

**"Ask AI" label vs the Ask page.** The sidebar says "Ask AI", as the brief
asked. The page it opens still has the heading "Ask the Data", and its footer
says it is not a language model. One of them should change when the Ask page
is redesigned.

**Two links land on placeholder pages.** "View analytics" on Home goes to
/analytics, which is still the phase 1 placeholder pointing at Overview. (Care
Gaps was a placeholder too and is now built in phase 3.)

**Every row on Home's short list is a never-tested patient.** The pipeline's
priority puts never tested first, and there are 21 of them, so the first five
are always never tested and "Days overdue" shows a dash on each row. This is
correct for the data. Worth a look if the list feels repetitive.

## From phase 3 (Care Gaps)

**Patients sorts in a different order from Home and Care Gaps.** Resolved in
phase 5: Patients is now a directory sorted by MRN, and its "Gap status" and
"Days overdue" sorts are choices a reader makes, not a competing queue.

**Care Gaps filters are only partly in the URL.** Care Gaps reads ?status=
(Home's "Review 21 patients" uses /care-gaps?status=never), but search,
setting, age, insulin and sort live only in the page. Patients keeps all of
its state in the URL as of phase 5 (readDirectory / writeDirectory in
lib/cohort.ts); Care Gaps could use the same approach.

## From phase 4 (Patient workspace)

**Tests per year shares one axis between A1c tests and insulin fills.** A
patient with 280 insulin fills in one year flattens every A1c bar to a sliver
(MRN 64b7b8b0 shows it). Two axes, or two small charts, would keep both
readable. The chart was moved into the workspace unchanged, so it still does
this.

**The cohort box plot draws no median line.** Its own comment says the median
is a reference line per box, but the code never draws one, so each box shows
the quartiles without the middle. Its "this patient" label can also sit on top
of a box.

**Insulin fills are counted in the year the prescription started.** A
prescription filled every month for five years puts all sixty fills in its
first year. The chart caption now says so, but the shaping in
lib/patientDetail.ts (insulinPerYear) could spread fills across years if the
source carries per-fill dates.

**The workspace opens on Overview every time.** The tab is not in the URL, so
a link to a patient cannot point at their A1c tab.

**Patients page still has its own status badges.** Resolved in phase 5:
Patients uses the shared GapStatusBadge and the shared cells.

## From phase 5 (Patients)

**Four cohort figures now appear nowhere.** The old Patients page opened with
eight metric cards. Four duplicated Home (cohort, open gaps, never tested,
insulin). The other four did not: median last A1c, last result at or over 7%,
longest overdue (2,175 days), and "seen, not tested" (open gap, in clinic
within six months - 24 of the 25). The last one is the most actionable figure
in the project. They belong on the Analytics redesign. "At or over 7%" should
come back with the careful reference-point wording, not as "above target".

**The column picker is gone.** The old table could show sex, diagnosis date,
tests in 2 years, active medication count and priority as extra columns. All
of these are in the patient workspace now; none is in the directory table.

**The old data-table components are unused.** components/data-table/* and the
@tanstack/react-table dependency have no callers after phase 5. Delete them, or
reuse them if Analytics wants sortable column headers.

**No sticky table header.** The directory pages at 25 rows, so the header is
rarely far away, but a sticky header was not added.

**Search matches the start of the MRN only.** Typing a fragment from the
middle of an MRN finds nothing. Deliberate (prefix search is how MRNs are
read aloud), but worth confirming.
