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

**Patients sorts in a different order from Home and Care Gaps.** Home and Care
Gaps use the pipeline's priority: never tested first, then most overdue. The
Patients table sorts by days overdue, which puts the never tested last because
they have no days-overdue figure. A care team seeing the same patient at the
top of one list and the bottom of another will ask why. Pick one order, most
likely priority, when Patients is redesigned.

**Filters are only partly in the URL.** Phase 4 made Care Gaps read
?status= (Home's "Review 21 patients" uses /care-gaps?status=never). Search,
setting, age, insulin and sort still live only in the page, so those views
cannot be bookmarked or shared yet.

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

**Patients page still has its own status badges.** Its A1c gap column uses the
older badge styles (orange "overdue", plain "current") rather than the shared
GapStatusBadge. Left for the Patients redesign.
