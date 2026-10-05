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

**Filters are not in the URL.** Care Gaps keeps its filters in the page only.
So Home's "Never tested 21" card cannot link straight to that filtered list,
and a filtered view cannot be bookmarked or shared. Adding it means reading
the filters from the address, for example /care-gaps?status=never. With a
static export this needs a Suspense boundary around the part that reads them.
It is a small change.
