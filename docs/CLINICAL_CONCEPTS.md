# Clinical Concepts — a plain-English primer

For anyone (including future you) who opens this repo without a healthcare
background. Nothing here is specific to our code; it's the vocabulary the code
assumes you already have.

---

## 1. What this project actually does

A person with type 2 diabetes is supposed to get a blood test called an **A1c**
roughly every six months. It measures average blood sugar over the past three
months. If it drifts up and nobody notices, the long-term damage is to kidneys,
eyes, and nerves — slowly, and then all at once.

Sometimes nobody notices. The patient moves, changes doctors, misses an
appointment, or simply falls off the list. Twelve months pass with no A1c on
file.

That is a **care gap**: a patient who qualifies for a routine piece of care and
hasn't received it. This project finds them.

The query itself is easy — "diabetic patients with no A1c in 12 months" is about
four lines of SQL. The project is not really about the query.

## 2. Why the project is really about dirty data

A care-gap list gets handed to a nurse who calls patients. So a wrong list has a
cost in both directions:

- **A false positive** wastes a call on someone who already had the test — their
  result was recorded under a duplicate record, or with a broken patient link.
- **A false negative** is worse. The patient stays invisible, and everyone
  believes the report.

Real clinical data arrives with duplicate rows, lab values in the wrong units,
patients registered twice under different medical record numbers, and timestamps
that disagree. A care-gap report built on unvalidated data is worse than no
report, because people act on it.

So the build is: load raw → deliberately break it → catch the breakage → measure
what fraction we caught → *then* report the gaps. The data quality work is the
project. See `DATA_QUALITY_SPEC.md`.

## 3. Codes, and why nothing is stored as words

Healthcare does not store "diabetes" as text. It stores a number from an agreed
vocabulary.

The reason is that free text does not survive contact with reality. One system
writes `Diabetes mellitus type 2`, another `DM Type II`, another `T2DM`, another
`NIDDM` (a term abandoned in the 90s). All four mean the same thing, and no
`WHERE description = ...` will ever match all of them. Worse, a display string
can be edited by a vendor in a routine upgrade and silently break your report.

A code is stable, unambiguous, and international. **Join on codes. Never join on
display names.**

There are several code systems because they describe different things:

| System | Describes | Example |
|--------|-----------|---------|
| **SNOMED CT** | Conditions — what a patient *has* | `44054006` = Diabetes mellitus type 2 |
| **LOINC** | Lab tests and measurements — what was *measured* | `4548-4` = Hemoglobin A1c |
| **RxNorm** | Medications — what was *prescribed* | metformin |
| **ICD-10** | Diagnoses *for billing* | `E11.9` = Type 2 diabetes without complications |
| **CPT** | Procedures for billing | — |

Rough mental model:

- **SNOMED** is what the clinician means.
- **ICD-10** is what the biller submits so the visit gets paid.
- **LOINC** is the question a lab was asked.
- **RxNorm** is what the pharmacy dispenses.

We use SNOMED, LOINC and RxNorm. ICD-10 and CPT are claims-side and out of scope
(see PRD non-goals).

### A note on LOINC codes specifically

A LOINC code identifies a *question*, not an answer. `4548-4` means precisely:
"the proportion of hemoglobin that is glycated, in blood." The result value and
its unit are stored separately.

That separation is exactly where unit errors live. `4548-4` should be reported in
**percent** — a normal value is around 5, a poorly-controlled diabetic might be
9. But blood glucose is reported in **mg/dL**, where normal is around 90. If a
mg/dL value lands in a percent field, you get an A1c of 250, which is
biologically impossible and, importantly, still a perfectly valid number as far
as the database is concerned. Only a range check catches it.

That is defect D3 in our spec, and it is a real thing that really happens.

## 4. HEDIS, and where "12 months" comes from

**HEDIS** is a set of quality measures published by NCQA. Health plans are
scored on them, and money moves based on the score. The relevant one here is the
diabetes care measure set (historically "CDC" — Comprehensive Diabetes Care).

This matters for one reason: the thresholds in this project are not invented.
"Diabetic patients need an A1c within 12 months" is a real published measure with
a real definition of who counts. Using the actual rule instead of a made-up one
is what makes the output a care-gap report rather than a demo.

The real HEDIS specification is far stricter than what we implement — it has
precise enrolment requirements, exclusion criteria, and hospice carve-outs. We
implement the idea, not the certified measure, and the app says so.

## 5. Terms you will hit in this repo

**A1c (HbA1c)** — blood test, average blood sugar over ~3 months, reported in
percent. Under 5.7 normal, 5.7–6.4 prediabetes, 6.5+ diabetes.

**Care gap** — a patient eligible for routine care who hasn't received it.

**Cohort** — the set of patients a measure applies to. Ours is "has diabetes."
Getting the cohort wrong invalidates everything downstream, which is why it lives
in one file with the codes written out explicitly (`pipeline/cohort.py`).

**Encounter** — one interaction with the health system. A visit, an admission, a
phone consult. Most clinical data hangs off an encounter.

**MRN (Medical Record Number)** — the ID a hospital assigns a patient. Local to
that organisation, which is why the same human can hold several. This is the
cause of defect D6.

**PHI (Protected Health Information)** — identifiable patient data, legally
protected under HIPAA in the US. This project uses **synthetic data only** —
Synthea generates fake people. No PHI is involved, and the app states that on
every page.

**Observation** — one recorded measurement. A lab result, a blood pressure, a
height. Carries a LOINC code, a value, and a unit.

**Bronze / Silver / Gold** — a layering convention, not a healthcare term. Bronze
is raw as-loaded, Silver is typed and validated, Gold is the reporting tables.
The value is that you can always show what the data looked like before you
touched it.

---

## 6. What profiling this dataset actually turned up

Four findings from `pipeline/profile.py`, in plain English. Each one changed a
decision.

### Prediabetes is not diabetes

Searching condition descriptions for the text `diabet` matches **439 patients
with prediabetes** — more than any real diabetes code. Prediabetes means elevated
blood sugar that has not crossed the diagnostic threshold. Those patients do not
qualify for the A1c measure.

Include them and the denominator roughly triples, so every percentage in the app
is wrong. This is the clearest possible argument for not defining a cohort by
text search.

### One diabetes code is not enough

The obvious approach is to take the type 2 code, `44054006`, and call it the
cohort. That gives 88 patients.

But **73 more patients carry a diabetic complication** — diabetic kidney disease,
diabetic retinopathy, diabetic neuropathy — **with no type 2 diagnosis code on
file at all.** Their record says, in effect, "complication of a disease we never
wrote down."

Anchor on the single obvious code and you silently drop 45% of the cohort, and
specifically the sickest half — the ones who most need the follow-up. This isn't
a quirk of synthetic data; it is why professional value sets are lists of dozens
of codes rather than one. Our cohort is the union of all 8.

Final cohort: **161 patients** out of 1,153.

### The A1c range in our own spec was wrong

`DATA_QUALITY_SPEC.md` proposed flagging any A1c outside 3.0–20.0 percent.

The units checked out — Synthea reports `4548-4` in percent, so the order of
magnitude was right. But **951 of 8,941 A1c values sit below 3.0**. That is 11%
of completely clean data that the check would have flagged as broken, before a
single defect was injected.

A check with an 11% false-positive rate on clean input makes the Day 3 catch-rate
measurement meaningless. Profile first, then set thresholds — that is the entire
reason task 1.10 exists.

### Diabetes is never resolved

Of **835** diabetes condition rows, **zero** have an end date. In this dataset a
diabetes diagnosis, once recorded, is permanent.

Clinically that is roughly right — type 2 diabetes is managed, not cured. It also
means the cohort needs no "still active as of today" filter, which removes a
whole class of date logic. That assumption is written down in `cohort.py` so that
if the data ever changes, the reason it was safe is visible.
