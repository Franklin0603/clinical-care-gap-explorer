# PRD — Clinical Care Gap Explorer

**Owner:** Franklin Ajisogun
**Status:** Draft
**Build window:** 7 days, ~3 hrs/day
**Data:** Synthea synthetic patients only. No PHI.

---

## 1. Problem

Health systems lose money and patients lose outcomes when routine
monitoring is missed. A diabetic patient who hasn't had an A1c in 12+
months is an open care gap — clinically meaningful, and the basis of
real quality measures (HEDIS CDC).

Finding those patients is not a hard query. It is hard because the
underlying data is dirty: duplicate encounters, unit errors, patients
registered under two MRNs. A care-gap report built on unvalidated data
is worse than no report, because people act on it.

## 2. What this is

A four-page web app that walks a viewer through the full path from raw
clinical data to a care-gap list a care team could act on — showing the
data quality work in the middle rather than hiding it.

## 3. Who it's for

- Hiring managers and recruiters in health tech (primary)
- People in conversation who ask "what have you built?"

It is a portfolio artifact, not a production system. It should be
honest about that on every page.

## 4. Goals

- G1 — A viewer with no context understands the pipeline in under 3 minutes.
- G2 — The data quality work is visible, not implied.
- G3 — Access-by-role is demonstrated, using correct healthcare vocabulary.
- G4 — Every failure path returns a plain sentence, never a stack trace.



## 5. Non-goals

Explicitly out of scope for v1:

- Clinical notes / NLP extraction (that is the v2 project)
- Insurance claims (that is a separate project)
- Real authentication or user accounts
- FHIR or OMOP conformance
- Databricks / cloud deployment
- Any claim of HIPAA compliance



## 6. Pages



### P1 — Overview

One-sentence description. Headline number (___ of ___ diabetic patients
with an open A1c gap). Synthetic-data banner. Links to the other three
pages. Short architecture diagram.

### P2 — Pipeline & Data Quality

- Bronze → Silver → Gold with row counts at each layer
- Six data quality checks, pass/fail, with counts
- Quarantine table: every rejected row and its `failure_reason`
- One before/after example of a remediated record
- Identity review queue: duplicate MRNs awaiting human decision
- Catch rate: ___% of injected defects detected



### P3 — Patient Care

- Care-gap cohort: diabetic patients with no A1c in 12 months
- One chart (gap count by age band)
- Patient list
- Role selector: PCT / Nurse / Physician — changes visible fields and rows
- Text stating which fields the selected role cannot see and why



### P4 — Ask the Data

- Ten preset question chips
- Natural language → SQL over the gold tables
- Generated SQL displayed above every answer
- SELECT-only enforcement
- Out-of-scope questions get an honest refusal listing what IS available



## 7. Functional requirements


| ID  | Requirement                                                                |
| --- | -------------------------------------------------------------------------- |
| FR1 | Pipeline runs end to end from a single command                             |
| FR2 | Every rejected row is written to quarantine with a reason; no silent drops |
| FR3 | Duplicate MRNs are flagged for human review, never auto-merged             |
| FR4 | Role selection filters both columns and rows                               |
| FR5 | Chat rejects any statement that is not a single SELECT                     |
| FR6 | All errors return a human sentence naming what the tool can answer         |
| FR7 | Every page displays the synthetic-data notice                              |




## 8. Success criteria

- [ ] Deployed at a public URL
- [ ] README states the catch rate and the architecture
- [ ] 90-second Loom recorded
- [ ] Five deliberately bad chat questions return five clean sentences
- [ ] A non-technical person can explain what it does after 3 minutes



## 9. Risks


| Risk                                  | Mitigation                                       |
| ------------------------------------- | ------------------------------------------------ |
| Scope creep (notes, claims, FHIR)     | Non-goals list above is binding                  |
| Day runs long                         | Cut the feature, not the day                     |
| Synthea data too clean to fail checks | Defects are injected deliberately and logged     |
| Over-claiming compliance              | Use "minimum necessary", never "HIPAA compliant" |




## 10. Open questions

- Default role on page load? (recommendation: PCT)
- Age banding for the chart — 10-year bands or clinical bands?
- Do quarantined rows ever re-enter the pipeline after remediation?

