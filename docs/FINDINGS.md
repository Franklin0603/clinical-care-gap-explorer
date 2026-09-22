# Findings — what building the pipeline revealed

Clinical Care Gap Explorer · Synthea, Massachusetts, 1,000 patients · as of 2026-08-23

---

## The headline

**25 of 116 living diabetic patients (21.6%) have no A1c result in the last twelve
months. 21 of them have never had one.**

Those 21 are the same people three different, ordinary technical mistakes would
each have hidden. They carry a diabetic complication but no diabetes diagnosis
code; they are on no diabetes medication; and most were seen by a clinician in the
weeks before the as-of date. They are not lost to the system. They are in the
building, and nobody has ordered the one test that says how bad it is.

| | |
|---|---:|
| Patients generated | 1,153 |
| Carrying any diabetes code | 161 |
| …of whom alive on the as-of date (the denominator) | **116** |
| Open A1c gap | **25 (21.6%)** |
| …never tested at all | **21** |
| …last result over a year old | 4 |
| Due within the next 90 days | 12 |
| Last result ≥ 7.0 % (uncontrolled) | 19 of 95 tested |

---

## Finding 1 — One diagnosis code misses 45% of the cohort

The obvious cohort definition is "patients with the type 2 diabetes code,
`44054006`". It yields 88 patients.

Another 73 carry a *complication* of diabetes — diabetic kidney disease,
retinopathy, neuropathy — with no underlying diagnosis code on file. Their record
says, in effect, "complication of a disease nobody wrote down."

Anchor the cohort on the single obvious code and 45% of it disappears, and it is
specifically the sicker half. This is not an artefact of synthetic data; it is why
HEDIS value sets are lists of dozens of codes rather than one. The cohort here is
eight codes, written out with reasons in `pipeline/cohort.py`.

## Finding 2 — An inner join deletes the highest-risk patients, silently

Gold is built by joining the cohort to each patient's most recent A1c. Written
with an inner join, the table has 95 rows and zero never-tested patients. Written
with a left join, it has 116 rows and 21.

Nothing errors either way. The inner-join version looks complete and plausible.
The 21 patients it drops are 84% of the open gaps — the ones who most need a
call. `pipeline/day4_gold.ipynb` shows both versions side by side; `gold.py`
asserts on every run that never-tested patients are present and flagged (V4.2).

## Finding 3 — The never-tested are the complication-only patients

Findings 1 and 2 are the same finding. All 21 never-tested patients:

- carry **no** `44054006` code — 21 of 21
- carry *Disorder of kidney due to diabetes mellitus* — 21 of 21
- are on **no** insulin — 0 of 21 (45 of the 95 tested patients are)
- are on **no** diabetes medication at all — they account for most of the 47
  cohort members on neither insulin nor metformin
- were mostly seen recently — priority #5 on the worklist had an encounter
  **the day before** the as-of date

The pattern: in this data, patients who are *treated* get monitored — insulin
comes with a pharmacist, a refill cycle, and forced contact. Patients with a
diabetic complication on the problem list and no diabetes prescription have
nobody prompting the test. Synthea's care model produces this; real health
systems do too.

## Finding 4 — Including the deceased inflates the gap nearly threefold

The Day 1 profiling figure was 69 of 161 (43%). It counted 45 patients who died
before the as-of date, and the dead carry most of the stale A1cs. Excluding them
— a care-gap list is a call list, and HEDIS excludes deceased members — gives
25 of 116. The number got smaller and less impressive. It is the right one.

## Finding 5 — The spec's own plausibility range was wrong

`DATA_QUALITY_SPEC.md` proposed rejecting any A1c outside 3.0–20.0 %. The units
were right. The floor was not: **951 of 8,941 clean values sit below 3.0** — an 11%
false-positive rate before a single defect had been injected. A check that fires
on clean input makes catch rate meaningless, and catch rate is the number the
project exists to report. Floor revised to 2.0.

## Finding 6 — "Same seed" did not mean same data

Regenerating with the original command four weeks later produced 1,151 patients
instead of 1,142 and every table 4–6% larger. `-s` pins only the patient RNG.
Synthea's clinician seed, reference date and end date all default to the wall
clock. Each was found by fixing one and seeing what still moved; with all four
pinned (`-s -cs -r -e`), two runs are identical in content across every table.

Two lessons: the seed controls the patients, not the calendar; and
"reproducible" means same content, not same bytes — the export is multithreaded,
so row order varies and the right check is a sorted diff, not `md5`.

## Finding 7 — A third of observations are words, not numbers

315,450 of 870,510 observations carry text results (smoking status, survey
answers). Casting `VALUE` to a number with `TRY_CAST` would null every one of them
while the row sat in Silver looking clean — a silent drop in disguise. Silver
keeps `value_text` for every row; `value` is populated only where the source was
numeric, and the null counts reconcile.

---

## Data quality results

The pipeline deliberately damages 249 rows in six realistic ways, logs each one,
then scores its own checks against that log.

| Defect | Rows injected | Caught by its own check |
|---|---:|---:|
| D1 duplicate encounters (interface replay) | 40 | 40 |
| D2 observations with no patient (failed foreign key) | 150 | 150 |
| D3 A1c of 250 (mg/dL glucose in a % field) | 20 | 20, remediated to 10.3 % via the ADA eAG mapping, original kept |
| D4 birth date in the future (registration typo) | 8 | 8 |
| D5 discharge before admission (clock drift) | 25 | 25 |
| D6 same person, two registrations | 6 | 6, routed to a human, nothing merged |

**Catch rate: 6 of 6 defect types, 249 of 249 rows.** On every table,
`bronze = silver + quarantine` balances, and the pipeline stops if it does not.

---

## What the number cannot see

Stated here rather than discovered later.

- **Ordered but not resulted.** Synthea has no orders. "We ordered it and the
  patient never went" and "we never ordered it" are the same row here. On real
  data they are different problems with different interventions.
- **Results in another lab system.** Invisible. The measure is "no result *we can
  see*", which is what every care-gap report actually measures.
- **Whether we can reach them.** Synthea has address, city and ZIP. No phone, no
  email. `last_encounter_date` is the honest proxy.
- **Lost to follow-up.** 0 of 116 — Synthea patients never disappear. The column
  was dropped rather than shipped always-false.
- **Hospice, palliative, and the other HEDIS exclusions.** Not implemented. The
  app says so.

---

## Reproduce it

```bash
python pipeline/run_all.py --fresh        # deleted warehouse -> Gold in ~13 s
python pipeline/run_all.py --generate     # also regenerate from Synthea (~4 min, Java 17)
```

Every number above is in `data/dq_report.json` and `data/gold_report.json`
after a run. The notebooks `pipeline/day3_validate.ipynb` and
`pipeline/day4_gold.ipynb` show each finding with its query and output.

| Finding | Where |
|---|---|
| 1 — one code misses 45% | `cohort.py` header; `day4_gold.ipynb` cell 3 |
| 2 — inner join | `day4_gold.ipynb` cell 8 |
| 3 — the 21 | `day4_gold.ipynb` §4.x, hypothesis cell |
| 4 — deceased | `day4_gold.ipynb` cell 3; `DATA_DICTIONARY.md` cohort section |
| 5 — DQ3 floor | `day3_validate.ipynb` §3.4; `DAY_1_DECISIONS.md` |
| 6 — reproducibility | `DAY_1_DECISIONS.md` D2 |
| 7 — value_text | `day3_validate.ipynb` §3.8, V3.10 cell |
