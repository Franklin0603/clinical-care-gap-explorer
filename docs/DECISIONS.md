# Day 1 — Extraction decisions

Locked on 2026-08-23; numbers refreshed 2026-09-20 after V1.3 forced a regeneration
(see D2). Everything below is a decision with evidence attached, not
a preference. Numbers come from `pipeline/profile.py`; the cohort comes from
`pipeline/cohort.py`.

---

## D13 — The measure is A1c, not blood glucose

**Decision:** the care gap is defined on **HbA1c, LOINC `4548-4`**. Blood glucose
(`2339-0`, `2345-7`) is not used to define any gap.

This is worth writing down because glucose is the more obvious choice — it is the
larger table (10,439 rows vs 8,941), it covers more of the cohort, and "blood
sugar test" is what a layperson would name. All three of those are reasons to
reject it.

### 1. A1c measures control; glucose measures a moment

Glucose is a snapshot. It moves within the hour — a meal takes it from 90 to 140
and back. A1c measures the fraction of hemoglobin that has become glycated, and
since red blood cells survive about 120 days, the number integrates blood sugar
exposure over roughly three months. A patient cannot fast the morning of the test
and produce a good one.

Our own data shows the difference plainly. For the same patient in the same year:

| Test | Patient-years | Average spread within the year | As % of the mean |
|------|--------------:|-------------------------------:|-----------------:|
| A1c `4548-4` | 882 | 0.26 | **6.7%** |
| Glucose `2339-0` | 1,427 | 18.30 | **21.3%** |

Glucose is over three times noisier within a single patient. Building a
"controlled vs uncontrolled" flag on it would mostly detect what time of day
someone happened to visit.

### 2. Glucose is drawn on everyone, so its absence means nothing

Glucose is a component of routine metabolic panels, so it is ordered regardless
of whether anyone is thinking about diabetes:

| Test | Patients tested | Diabetic | Non-diabetic |
|------|----------------:|---------:|-------------:|
| Glucose `2339-0` | 532 | 145 | 387 |
| A1c `4548-4` | 497 | 133 | 364 |

Within our 161-patient cohort, **159 have a glucose result but only 133 have ever
had an A1c**. A gap report built on glucose would find almost nobody, because
almost everybody gets one incidentally. The measure has to be a test that is
ordered *because* the patient has diabetes — otherwise a "gap" is just a record
of who avoided the phlebotomist.

Applied as an actual 365-day gap as of 2026-08-23:

| Gap definition | Patients with an open gap |
|----------------|--------------------------:|
| No A1c in 12 months | **69 of 161 (43%)** |
| No glucose in 12 months | 49 of 161 (30%) |

(Day 1 profiling figures on all 161 code-carriers. Gold excludes the 45 who died
before the as-of date — Decision D5 — and reports **25 of 116 (21.6%)**.)

### 3. A1c is the measure that actually exists

HEDIS diabetes care is specified on HbA1c. There is no quality measure, anywhere,
requiring an annual glucose test. The project's claim is that it implements a
real published measure rather than an invented threshold — swap in glucose and
that claim is gone, along with the reason any of the thresholds are 12 months
instead of 18.

### 4. Clinicians act on it

Treatment intensification decisions are made against A1c targets (commonly below
7% for most adults). A care-gap list exists to prompt an action, and the action a
clinician takes downstream is keyed to this number.

**Glucose stays in the warehouse** — it is useful context on a patient detail
view, and `2339-0` vs `4548-4` unit confusion is exactly what defect D3
simulates. It is simply not a gap definition.

---

## D1 — Population size: 1,000

`-p 1000`, which produced **1,153 patients**: 1,000 alive at end of simulation
plus 153 who died during it. Synthea's `-p` counts survivors, not records.

Both are loaded. The deceased carry real history and belong in Bronze and Silver;
they are excluded from the care-gap denominator on Day 4, because calling a dead
patient about an overdue lab is the single worst failure mode this kind of report
has.

1,000 keeps every query sub-second on a laptop while still yielding a 161-patient
cohort — large enough that percentages mean something, small enough to iterate on
for seven days.

## D2 — State and seed: Massachusetts, four pinned time flags

```bash
java -jar synthea/synthea-with-dependencies.jar \
  -p 1000 \
  -s  20260823 \
  -cs 20260823 \
  -r  20260823 \
  -e  20260823 \
  --exporter.baseDirectory ./data/raw \
  --exporter.csv.export true \
  --exporter.fhir.export false \
  --exporter.hospital.fhir.export false \
  --exporter.practitioner.fhir.export false \
  Massachusetts
```

Massachusetts is Synthea's best-calibrated state — its demographics and
provider list are the most complete — and it costs nothing to prefer it.

### Why four flags, not one — the V1.3 finding

The Day 1 command had only `-s`. V1.3 (regenerate, compare) was run on
2026-09-20, four weeks after the original generation, and **failed**: same
seed, 1,151 patients instead of 1,142, every table 4–6% larger.

Each remaining flag was found by fixing one thing and looking at what still
moved:

| Flag | Controls | Default without it | What it changed |
|------|----------|--------------------|-----------------|
| `-s` | patient RNG | — | already set |
| `-cs` | clinician / provider assignment | wall clock | which providers exist, so encounters |
| `-r` | reference date (the simulation's "now") | wall clock | row counts across all tables |
| `-e` | simulation end date | wall clock | with `-r` alone, data still ran to the current day; one open encounter was stamped at export time |

With all four, two runs produced identical content in every table. Two
lessons worth carrying:

- **The seed controls the patients, not the calendar.** Any generator with a
  notion of "now" needs "now" pinned too.
- **"Reproducible" means same content, not same bytes.** Synthea exports
  from several threads, so row order in the CSV varies. The right check is a
  sorted diff or a DuckDB `EXCEPT`, not `md5`.

The Day 1 data was regenerated with this command on 2026-09-20 and Bronze
reloaded; every number in these docs comes from the pinned output. The
original unpinned extract cannot be regenerated by anyone, which is the whole
point.

The two extra `fhir.export` flags are not cosmetic either. `--exporter.fhir.export false`
alone still writes hospital and practitioner FHIR bundles; the run is not
CSV-only without all three.

## D14 — CSV export, not FHIR

FHIR JSON is the more realistic interchange format and the PRD explicitly lists
FHIR conformance as a non-goal. Flat CSV loads into DuckDB with `read_csv_auto`
in one line, and the project's subject is data quality, not parsing nested
resources. Choosing CSV is choosing to spend the seven days on the actual
subject.

## D15 — We extract 5 of the 18 CSVs

Synthea emits 18 files totalling 811 MB. Bronze loads five:

| File | Rows | Why |
|------|-----:|-----|
| `patients.csv` | 1,153 | The cohort spine. Defects D4, D6 |
| `encounters.csv` | 67,755 | Everything hangs off an encounter. Defects D1, D5 |
| `conditions.csv` | 40,811 | Defines who has diabetes |
| `observations.csv` | 870,510 | Where A1c lives. Defects D2, D3 |
| `medications.csv` | 59,273 | Diabetes medications, patient detail view |

Deliberately not loaded:

- **`claims_transactions.csv` (1,094,500 rows)** — a billing ledger. On its own it
  is 40% of total data volume and contributes nothing to a clinical care gap.
  Loading it would make every pipeline run slower for no page in the app.
- **`claims.csv`, `payers.csv`, `payer_transitions.csv`** — insurance. The PRD
  names claims as a separate project.
- **`imaging_studies.csv` (145,496)**, `procedures.csv`, `devices.csv`,
  `supplies.csv`, `allergies.csv`, `careplans.csv`, `immunizations.csv` — real
  clinical data, no role in an A1c gap.
- **`organizations.csv`, `providers.csv`** — 840 rows each, may be pulled in on
  Day 6 if the role-based views need a facility name. Not Day 1.

Scoping this now rather than "load everything and see" is the difference between
a 3-minute pipeline and a 30-second one, seven days running.

## D5 — Cohort definition: any of 8 SNOMED codes, ever recorded

Decided early, because the evidence arrived on Day 1. Full reasoning and the
code list live in `pipeline/cohort.py`.

- **Any of 8 codes**, not just type 2 (`44054006`). 73 patients carry a diabetic
  complication with no underlying diagnosis code; anchoring on the obvious code
  drops 45% of the cohort and specifically its sickest half.
- **Prediabetes (`714628002`) excluded** — 439 patients, roughly triples the
  denominator, and does not qualify for the measure.
- **Hyperglycemia (`80394007`) excluded** — a finding, not a diagnosis.
- **"Ever recorded", with no active-as-of filter.** 0 of 835 diabetes condition
  rows carry a stop date, so a diagnosis is permanent in this dataset. Clinically
  correct too: type 2 diabetes is managed, not cured.

**Cohort: 161 patients carry a code; 116 are alive on the as-of date and form the Gold denominator (Day 4).**

---

## Two things this changes downstream

### DQ3's plausible range needs revising before Day 3

`DATA_QUALITY_SPEC.md` proposes 3.0–20.0 %. The units are right, the floor is
not: **951 of 8,941** clean A1c values fall below 3.0, an 11% false-positive rate
on untouched data. Since Day 3's headline number is catch rate measured against
injected defects, a check that fires on clean input makes that number
meaningless. Proposed floor: **2.0**. The ceiling is untested here — nothing in
this dataset exceeds 8.8 — which also means the injected value of 250 is a very
easy catch, and the write-up should say so rather than imply otherwise.

### The only future-dated rows are not clinical

With `-e` pinned, no encounter or condition is dated after 2026-08-23. The
252 observations that are carry codes `QALY`, `DALY` and `QOLS` — Synthea's
quality-of-life summary scores, with no LOINC code, no encounter and no
category. They are generator metadata that landed in the observations file,
and they drop out of Silver on their own because nothing can join to them.

Worth one line in the dictionary and no check. This is also the remaining
argument for **D7** being a fixed as-of date rather than `current_date` — a
run-time date means the gap count in the README changes every day it is read.

**Open — decide on Day 4:** D7 (as-of date). Recommended: freeze at
`2026-08-23`, the simulation end date, so the gap count stays put. *(Decided Day 3.)*
