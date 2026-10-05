# Redesign backlog

Things noticed during the redesign phases and left on purpose, so each phase
stayed inside its brief. Nothing here is broken. Review the list once every
phase is built and decide what to do with each item.

Each phase adds what it leaves behind to its own section.

## From phase 2 (Home)

**"Ask AI" label vs the Ask page.** Resolved in phase 8: the page is now
Ask AI throughout, and says under its input how answers are produced.

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

**Four cohort figures now appear nowhere.** Partly resolved in phase 6.
Analytics now states "seen, not tested" (24 of the 25 open gaps had an
encounter in the six months before the data date) and the longest overdue
result (2,175 days). Median last A1c and "last result at or over 7%" were left
out on purpose: they describe results, not monitoring, and the phase 6 brief
rules out turning 7% into a population target.

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

## From phase 6 (Analytics)

**The Overview page now overlaps Analytics.** /overview still has its own
filters, cards and charts, computed inline rather than through lib/cohort.ts.
Its one unique view is "how the gap count would grow as the reporting date
moves". Since the phase 6 QA pass, Analytics no longer links to it; the only
way in is a button on the Introduction page (IntroView), plus the Phase 1 nav
mapping that keeps its breadcrumb under Analytics. Either move that chart into
Analytics, retire Overview and point the Introduction button at Analytics, or
keep Overview as an engineering view linked from Data & Quality.

**Tests per year cannot be filtered.** The testing-history chart covers the
whole cohort. Splitting it by age band or setting would need the per-patient
history joined to the cohort rows on the client, which is easy, but was not
asked for.

**Care Gaps cannot filter by age or setting from a link.** Analytics links age
bands and care settings to Patients (?status=gap&age=...), because only
Patients reads those from the URL. Once Care Gaps reads its full filter state
from the URL, those links could go to Care Gaps instead.

**Patients' "View patients" lands on a paged list.** /patients?status=current
shows 25 of 91 per page. Fine for browsing; worth knowing.

## From phase 7 (Tasks)

**Tasks live in one browser.** The site is a static export with no server, so
task state is saved in localStorage: it survives reloads and is shared between
tabs, but another person or device sees its own. A real deployment needs a
server-side store, real users, and an audit trail that cannot be edited from
the browser.

**There is one assignee.** With no sign-in, "Assigned to" offers Unassigned or
Demo user. Real assignment needs real accounts.

**Tasks only exist for open gaps.** A patient who is current has no task and
cannot be given one; the patient workspace says so. If the data ever moves a
patient from gap to current, any task already recorded for them is kept and
still listed.

**Task filters are not in the URL.** Only the open task is (?open=<patient
id>), which is what the patient workspace's "View task" link uses.

**No task figures on Home or in the sidebar.** The brief made Home optional.
A sidebar count was left out because the static HTML cannot know what a
browser has saved, so the number would change on load.

**No task column on Care Gaps.** Deliberate, to keep that table clean: the way
from a care gap to its task is Review, then the Follow-up card.

## From phase 8 (Ask AI)

**There is no language model behind Ask AI.** The site is a static export on
GitHub Pages: no server to hold an API key, and a key shipped to the browser
would be public. So questions are interpreted by rules (lib/ask/engine.ts) over
the same cohort functions every page uses, and the page says so under its
input. It understands the questions it has rules for - counts, lists and
shares of the cohort by gap status, age band, care setting, insulin and recent
encounters; group comparisons; testing over time; a patient by MRN; follow-ups
on all of these; method and SQL on request; the known limitations - and says
plainly when it cannot answer anything else. To put a model in front of it,
add a small server function (or let a user supply their own key) and expose
the engine's answer functions to the model as tools, so the numbers still come
from one place.

**Conversations live in one browser**, like tasks: localStorage, a separate
key, never mixed with clinical data or tasks.

**The SQL for testing over time is illustrative.** Population answers show SQL
that runs against the patients view and was checked against DuckDB for 17
populations. The per-year testing answer comes from the per-patient history
export, which the in-browser query engine does not load, so its SQL names an
a1c_observations table that does not exist there. The SQL says so in a comment.
Loading the history into DuckDB would make it runnable.

**The SQL check is not in CI.** The comparison of answer counts with the SQL
run in DuckDB was a one-off script. Making it a pipeline test would need Node
and Python in the same CI job.

**A typed SELECT still runs.** The earlier Ask page's read-only query engine
and its guard are kept: a message that is a SELECT statement runs in the
browser and returns a table. Anything that would change data is refused.

## From phase 9 (Learn)

**Media is waiting.** Three videos (no file, duration or thumbnail yet: each
card says "Coming soon" with a disabled play button), four illustrations (each
slot shows the brief for the image it will hold), and six screenshot slots on
Using Care Gap Explorer. Adding any of them is a field in lib/learn.ts - a src,
a duration, a poster - and no page changes. Illustration briefs are written to
hand to whoever produces the images.

**The Introduction page overlaps Learn.** "/" still holds the project
introduction and its clinical-concepts section, and is mapped under Learn in
the nav. Learn now links to it from "About the project and its data". Decide
whether its clinical background should move into the Understanding Diabetes
module and the Introduction stay as the project story only.

**Spelling.** The new Learn copy uses British spelling (haemoglobin, anaemia)
to match the rest of the app; "A1c" follows the app's own casing rather than
the brief's "A1C". Worth one consistent decision before the landing page.
