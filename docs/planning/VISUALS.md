# Visuals & analytics — spec

Six charts exist (`docs/img/`, built in `pipeline/day4_gold.ipynb`). This file
specifies the rest: the Day 1–4 analytics to build **after Day 7**, once the app
shell exists and nothing is blocked on it.

Status: six built, eleven specified. Nothing here blocks Days 5–7.

---

## Rules this project follows

Carried forward from the six already built. They are the reason the charts read
rather than decorate.

1. **Only what has shape gets a chart.** Catch rate (6 of 6), the reconciliation
   (223 rows against 938,000) and the profile of the 21 stay as tables. Six bars
   at 100% is worse than six rows of text.
2. **Validate the palette, never eyeball it.** Blue `#2a78d6` and orange
   `#eb6834` are slots 1 and 2 of a checked categorical palette. Red was the
   obvious choice for "deleted rows" and was rejected: against orange it scores
   ΔE 7.1, below the 15 floor for normal vision. Max two series per chart.
3. **Never put a non-date on a date axis.** The first draft of the timeline put
   never-tested patients at a made-up x position; they read as "tested in 2024".
   They now have their own panel with no date axis.
4. **Watch the dynamic range.** The first funnel drew 1,151 next to 21; the steps
   that matter were invisible. It starts at the cohort now, with the population in
   the subtitle.
5. **Say which data state a number comes from.** The A1c floor chart reads the raw
   CSV, because the claim is about clean data. On Silver the same count is 947,
   since 4 of the 20 rows `corrupt.py` sets to 250 were originally below 3.0.
6. **Render it and look at it.** Every problem above was found by opening the PNG,
   not by reading the code.

---

## Built (Day 4)

| # | File | Shows | Lives on |
|---|------|-------|----------|
| 1 | `01_cohort_funnel.png` | 161 → 116 → 25 → 21, each step a recorded decision | P1, README |
| 2 | `02_inner_join.png` | 116 vs 95; the 21 deleted with no error | P1, FINDINGS |
| 3 | `03_last_a1c_timeline.png` | Every patient's last A1c against the 365-day line | P3 |
| 4 | `04_a1c_floor.png` | 951 clean results the proposed floor would reject | P2 |
| 5 | `05_gap_by_age.png` | Gap rate by decade (HEDIS stratification) | P1, P3 |
| 6 | `06_asof_drift.png` | 25 → 116 as "today" moves; why D7 is fixed | P2 |

---

## To build after Day 7

### Day 1 — the data as it arrived

**V1 · Where the 811 MB goes.** Horizontal bars, the 18 CSVs by row count, the
five loaded into Bronze in blue and the thirteen skipped in orange. Makes D15
visible: `claims_transactions` alone is 1,094,500 rows and 40% of the volume,
with no clinical role. *Has shape — the 18:5 split is the point.*

**V2 · A1c vs glucose, within one patient-year.** Two small histograms of the
spread between a patient's highest and lowest result in the same year: A1c 6.7%
of the mean, glucose 21.3%. The evidence for D13 — glucose is three times noisier,
so it cannot define control. *Has shape — two distributions, genuinely different.*

**V3 · Who gets which test.** Grouped bars: of the cohort, 159 have a glucose but
only 133 an A1c; 388 non-diabetics have a glucose too. The argument that glucose's
absence carries no signal because everyone gets one incidentally.

**Not a chart:** the 18-file row counts as a table (V1 covers the shape), the
reproducibility flags, the cohort code list. Tables and prose.

### Day 2 — what was broken on purpose

**V4 · The six defects against their tables.** Small multiples, one per table,
each showing rows injected as a fraction of the table. Communicates "under 1% of
any table" — the D3 volume decision — better than the numbers do.

**Not a chart:** the DQ Matrix. It is a 6-row table with a catch rate, and it
should stay one.

### Day 3 — the validation layer

**V5 · Where every row went.** A Sankey or stacked bar per table: Bronze splits
into Silver, quarantine and remediation. The reconciliation made visual. Caution:
quarantine is 223 of 938,000 rows, so a proportional bar shows a hairline —
either use a log scale with the numbers labelled, or accept that this one may fail
rule 4 and stay a table. **Decide by building it and looking.**

**V6 · Catch rate by defect.** Only if it ever drops below 100%. At 6 of 6 there
is nothing to see. *Specified so it is not forgotten if a seventh defect is added.*

**V7 · The remediation, before and after.** Twenty points at 250 mg/dL mapping to
10.3%, on the A1c distribution from chart 4. Shows what D4 actually did, and that
it is reversible.

### Day 4 — the answer

**V8 · Days overdue, distributed.** Histogram of `days_overdue` for the 4 stale
patients, with the 21 never-tested as a separate bar. Small n — check it reads
before keeping it.

**V9 · The worklist as a table, not a chart.** Priority 1–25 with age, last A1c,
days overdue, meds. This is a table and should stay one; listed here so nobody
charts it.

**V10 · Treated vs monitored.** The finding that carries the project: of 116
patients, the 45 on insulin are all current, and the 21 on no diabetes medication
have never been tested. A 2×2 or a simple paired bar. *Highest value of anything
in this list.*

**V11 · Gap rate under alternative definitions.** 365 vs 180 vs 730 days; with
and without the deceased; with and without remediated values counting as results.
A sensitivity analysis, showing the reported number is not the flattering one.
Pairs with the "don't widen the window until the number looks good" note in
`DAY_4.md`.

---

## Where they go

| Page | Charts |
|------|--------|
| P1 Overview | 1, 2, 5 — the funnel, the inner join, gap by age |
| P2 Pipeline & Data Quality | 4, 6, V1, V5, V7; catch rate and reconciliation as tables |
| P3 Patient Care | 3, V8, V10; the worklist as a table |
| README / FINDINGS | 1, 2 as PNGs |
| Interview | 1, 2, V10 |

## How

Prototype in the notebook with matplotlib, save to `docs/img/`, look at the PNG,
fix, then rebuild the keepers in Recharts for the app. The PNGs stay — the README
needs static images regardless, and a chart that only exists in a running app
cannot be shown in a message to a recruiter.

Palette for Recharts: the same two hexes. Re-run the validator if a third series
is ever added:

```
node scripts/validate_palette.js "#2a78d6,#eb6834,<new>" --mode light --pairs all
```
