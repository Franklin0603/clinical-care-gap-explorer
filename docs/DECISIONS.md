# Decisions

Fifteen judgment calls, each with the evidence that settled it. Where a decision
rests on a clinical term, the term is explained in place — no healthcare
background assumed.

They are grouped by what they affect. The two that matter most are **D5** and
**D6**: together they define who appears on the care-gap list and why, and every
number in the project depends on them.

| | Decision | Call |
|---|---|---|
| **D1** | How many patients to generate | 1,000 alive → 1,153 records |
| **D2** | Seed and state | Massachusetts, four pinned time flags |
| **D14** | Export format | CSV, not FHIR |
| **D15** | Which files to load | 5 of 18 |
| **D13** | Which lab defines the gap | HbA1c, not glucose |
| **D5** | Who counts as diabetic | 8 codes, alive on the as-of date → 116 |
| **D6** | What counts as a gap | No A1c in 365 days; never tested counts |
| **D7** | What "today" means | Frozen at 2026-08-23 |
| **D3** | How much data to corrupt | 249 rows, under 1% of any table |
| **D4** | What to do with an impossible lab value | Correct it, reversibly |
| **D8** | Can quarantined rows come back | No, not in v1 |
| **D9** | How the app reads data | Static export at build time |
| **D12** | What powers the question page | No model; hand-written SQL in the browser |
| **D10** | Which role loads first | The most restricted one |
| **D11** | How to band ages | The measure's own boundaries |

---

## Generating the data

### D1 · Population size — 1,000

`-p 1000` produced **1,153 patient records**: 1,000 alive at the end of the
simulation plus 153 who died during it. Synthea's `-p` counts survivors, not
records.

Both are loaded. The deceased carry real history and belong in Bronze and
Silver; they are excluded from the care-gap denominator by D5.

1,000 keeps every query sub-second on a laptop while still producing a
116-patient cohort — large enough that percentages mean something.

### D2 · Seed and state — Massachusetts, four pinned flags

```bash
-s 20260823   # patient generator
-cs 20260823  # clinician assignment
-r 20260823   # the simulation's idea of "now"
-e 20260823   # when the simulation stops
```

**The Day 1 command had only `-s`, and it was not reproducible.** Re-running it
four weeks later gave 1,151 patients instead of 1,142, every table 4–6% larger.

The seed controls which patients are generated. It does not control what the
simulator thinks "now" is — run it a month later and it simulates a month more
of medical history. The clinician seed, reference date and end date all default
to the wall clock. Each was found by pinning one and seeing what still moved.

Two lessons worth carrying past this project:

- **The seed controls the data, not the calendar.** Any generator with a notion
  of "now" needs "now" pinned too.
- **"Reproducible" means same content, not same bytes.** Synthea exports from
  several threads, so row order varies between runs. Comparing checksums said
  the files differed when the data did not. The right check is a sorted diff.

Massachusetts is Synthea's best-calibrated state and costs nothing to prefer.

### D14 · CSV, not FHIR

FHIR is healthcare's standard interchange format — nested JSON documents, one
per patient. It is more realistic and it is an explicit non-goal here.

Flat CSV loads into DuckDB in one line. The subject of this project is data
quality, not parsing nested resources, so CSV spends the time on the subject.

### D15 · Five files of eighteen

Synthea writes 18 files totalling 811 MB. Bronze loads five: `patients`,
`encounters`, `conditions`, `observations`, `medications`.

Left out deliberately:

- **`claims_transactions.csv` — 1,094,500 rows**, the single largest file. It is
  a billing ledger. It contributes nothing to a clinical care gap and would slow
  every run for no page in the app.
- **`claims`, `payers`, `payer_transitions`** — insurance, a separate subject.
- **`imaging_studies`, `procedures`, `devices`, `supplies`, `allergies`,
  `careplans`, `immunizations`** — real clinical data with no bearing on whether
  a diabetic patient had a blood test.

Scoping this up front rather than "load everything and see" is the difference
between a 13-second pipeline and a 3-minute one, run dozens of times a week.

---

## Defining the measure

### D13 · HbA1c, not blood glucose

Two blood tests could plausibly measure diabetes control.

**Blood glucose** is sugar in the blood right now. It swings hour to hour — a
meal takes it from 90 to 140 mg/dL and back.

**HbA1c** measures the fraction of haemoglobin that has sugar permanently
attached. Red blood cells live about 120 days, so it averages roughly three
months of exposure. A patient cannot fast the morning of the test and produce a
good one.

Glucose was the obvious candidate: bigger table, more patients have one. Three
reasons it was rejected, two of them measurable in this data.

**It is three times noisier.** For the same patient in the same year, the spread
between their highest and lowest result:

| Test | Patient-years | Spread as % of mean |
|------|--------------:|--------------------:|
| A1c | 882 | **6.7%** |
| Glucose | 1,427 | **21.3%** |

**Its absence carries no signal.** Glucose rides along on routine blood panels,
so it is ordered whether or not anyone is thinking about diabetes — 387
non-diabetics have one. Within the cohort, 159 of 161 have a glucose result but
only 133 have ever had an A1c. A gap report built on glucose would find almost
nobody, because almost everybody gets one incidentally.

**It is not the measure that exists.** HEDIS — the quality-measure standard US
health plans are scored against — specifies A1c. No measure anywhere requires an
annual glucose test. Using glucose would discard the claim that this implements
a real published measure.

Glucose stays in the warehouse as patient context. It is never a gap definition.

### D5 · Who counts as a diabetic patient

**Any of eight SNOMED codes ever recorded, on a patient alive on the as-of date.
Denominator: 116.**

*SNOMED is the international vocabulary for diagnoses — a number per condition,
because free text does not survive contact with reality: one system writes
"Diabetes mellitus type 2", another "T2DM", another "NIDDM".*

Three parts to this decision.

**Eight codes, not one.** The obvious approach is the type 2 code, `44054006`.
That gives 88 patients. Another **73 carry a complication of diabetes** —
diabetic kidney disease, retinopathy, neuropathy — **with no diabetes diagnosis
code anywhere on their record**. Their chart says, in effect: complication of a
disease nobody wrote down.

Anchor on the obvious code and 45% of the cohort disappears, specifically the
sicker half. This is why HEDIS and every serious quality measure is defined by a
*value set* — a list of dozens of codes — rather than one code.

**Prediabetes excluded.** 439 patients carry it. It means blood sugar above
normal but below the diagnostic threshold; those patients do not qualify for the
measure. Including them would roughly triple the denominator and make every
percentage wrong.

**Alive on the as-of date.** 45 of the 161 code-carriers died before 2026-08-23.
A care-gap list is a call list — somebody phones these people — and the deceased
accumulate stale results because nobody orders tests for them. Including them
made the report partly a measurement of mortality: 69 of 161 instead of 25 of
116. HEDIS excludes deceased members for the same reason.

*Ever recorded, with no "still active" filter:* 0 of 835 diabetes condition rows
carry an end date, so "ever" and "currently" are the same set here. Clinically
that is right too — type 2 diabetes is managed, not cured.

### D6 · What counts as an open gap

**No A1c result in the 365 days before the as-of date. Never tested counts as a
gap. Exactly 365 days is not a gap; 366 is.**

Two things the number cannot see, stated rather than discovered later:

- **Ordered but not resulted.** Synthea has no orders table, so "we ordered it
  and the patient never went" is indistinguishable from "we never ordered it".
  On real data these are different problems with different interventions —
  one is a follow-up failure, the other an ordering failure. v1 counts them the
  same and says so.
- **Results in another lab system.** Invisible. The measure is "no result *we
  can see*", which is what every care-gap report actually measures.

Corrected values count as results (see D4). A reviewer who disagrees can exclude
every corrected row with one filter.

### D7 · "Today" is frozen at 2026-08-23

The simulated data ends on that date; no patient ever gets another result. With
a wall-clock "today", every patient crosses the twelve-month line eventually:

| If "today" were | Open gaps |
|---|---:|
| the as-of date | 25 |
| +3 months | 37 |
| +6 months | 50 |
| +12 months | **116 of 116** |

Freezing it makes the report describe the data rather than the calendar. The
same lesson as D2, one layer up.

---

## Data quality

### D3 · How much to corrupt — 249 rows

The pipeline deliberately damages data so the checks can be scored against a
known answer. Volumes per defect class:

| | Rows | Of | % |
|---|---:|---:|---:|
| D1 duplicate encounters | 40 | 67,755 | 0.06 |
| D2 observations with no patient | 150 | 870,510 | 0.02 |
| D3 impossible A1c values | 20 | 8,941 | 0.22 |
| D4 future birth dates | 8 | 1,153 | 0.69 |
| D5 discharge before admission | 25 | 67,755 | 0.04 |
| D6 duplicate registrations | 6 | 1,153 | 0.52 |

Nothing exceeds 1% of its table. Enough that the quarantine reads as a real work
queue; small enough that the cohort survives to be reported on.

### D4 · An A1c of 250 — correct it, reversibly

A1c is a percentage; nothing biological produces 250. Blood glucose in mg/dL
lands there routinely. So a 250 in an A1c field is almost certainly a mis-keyed
glucose reading, not nonsense.

**The call: convert it.** The American Diabetes Association publishes a mapping
between A1c and estimated average glucose. Inverted, 250 mg/dL becomes an A1c of
10.3% — a plausible, poorly-controlled diabetic.

The original is kept in `remediation_log`, the Silver row is flagged
`remediated`, and a reviewer who disagrees excludes every corrected row with one
`WHERE` clause.

**The alternative was to quarantine and not guess**, which is equally
defensible. On this data both produce the same gap count, so the choice was made
on principle: a logged, reversible correction beats throwing the row away for
everyone. On real data a clinician should sign off on the rule before it runs.

Anything else out of range is quarantined rather than guessed at.

### D8 · Quarantined rows do not come back

Quarantine is a dead-letter queue in v1: rows go in, nothing comes out.

Reprocessing needs three things this project does not have — a replay path, a
`resolved_at` column, and a rule for whether a replayed row enters Silver under
its original load date or today's. A half-built version would make the
reconciliation assertion ambiguous, and that assertion is the one guarantee
worth keeping exact.

Named as scale work in `DATA_QUALITY_SPEC.md`.

---

## The application

### D9 · Static export at build time

The site is a static export. The pipeline writes the data it reads as **JSON**
for the pages and **Parquet** for in-browser querying — 458 KB total.

A server runtime holding the DuckDB file would have failed on a serverless
filesystem, and the deploy had to work on day five rather than day seven.

The trade-off accepted: the site reads a snapshot, so re-running the pipeline
without re-exporting leaves it stale. That is why the export is the last stage of
the pipeline rather than a separate step somebody has to remember.

### D12 · No language model on the question page

A static site has nowhere to hold an API key — a key shipped to the browser is a
public key. So the question page carries ten preset questions with hand-written
SQL, and a matcher that refuses anything it does not recognise.

This buys something a hosted model would not: **the SQL displayed is the SQL that
ran**, executed in the browser against the same files the site ships. Copy any
statement and run it against the warehouse; you get the same rows.

### D10 · The most restricted role loads first

The first thing a viewer sees should be a restriction, not a full table. Opening
on the technician view means the twelve "not available" cells are visible before
anything else, which is what the page is arguing.

### D11 · Age bands follow the measure, not round decades

**18–44, 45–64, 65–75, 76+.**

HEDIS's diabetes measure applies to members aged 18–75 and stratifies 18–64 and
65–75, so three of the four boundaries are the measure's own rather than chosen
for looking tidy. The 76+ band sits outside the measure's age range entirely —
21 of 116 patients — which is worth showing rather than hiding.

---

*The spreadsheet in `planning/build-plan/` holds these in their original form
alongside the metrics and the validation log.*
