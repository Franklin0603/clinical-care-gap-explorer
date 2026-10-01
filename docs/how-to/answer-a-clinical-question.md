# Answer a clinical question

Somebody asks something about the cohort. Here is how to find the answer.

Open [`notebooks/04_playground.ipynb`](../../notebooks/04_playground.ipynb) — it
opens the warehouse read-only and has `ask(sql)` ready.

## Pick the layer first

This is the step that decides whether the question feels easy or hard.

| The question is about… | Query | Because |
|---|---|---|
| Who is overdue, and how badly | `care_gap_a1c` | One row per patient, already carrying the gap and the priority |
| A patient's history over time | `silver_observations` | Gold holds only each patient's **latest** A1c |
| When somebody was last seen | `silver_encounters` | Every visit, not just the most recent |
| What they are on | `silver_medications` | Gold has a count; the names are here |
| **Why a patient is missing** | `quarantine`, `identity_review` | The whole reason those tables exist |

**Gold answers "who". Silver answers "what happened."**

## Worked examples

**"Who should we call first?"** — Gold has already ranked them. `priority` puts
never-tested first, then most overdue, then highest last value, then insulin,
then age.

```sql
SELECT priority, patient_id[1:8], age, days_overdue, last_a1c_value
FROM care_gap_a1c WHERE gap_flag ORDER BY priority LIMIT 10
```

**"Is this patient's control getting worse?"** — Gold cannot answer this; it
holds one result per patient. Silver has the series.

```sql
SELECT observed_at::DATE, value, _dq_status
FROM silver_observations
WHERE patient_id = '...' AND loinc_code = '4548-4'
ORDER BY observed_at
```

Watch for `_dq_status = 'remediated'` — that value was corrected by
[ADR-0004](../decisions/0004-remediate-unit-errors.md) and a reader may want to
discount it.

**"Why isn't my patient on the list?"** — the question this project was built to
answer. `why_not_in_report(patient_id)` in the playground notebook checks the
three ways a patient can be absent: no qualifying diagnosis, excluded by a
recorded decision, or their row was quarantined. Each answer is recoverable
rather than guessed at.

## Before you trust the answer

**Check the as-of date.** Everything is computed as of 2026-08-23
([ADR-0007](../decisions/0007-fixed-as-of-date.md)), not today. A question about
"the last six months" means six months before that date.

**Check whether the question needs the deceased.** The Gold cohort excludes
patients who died before the as-of date
([ADR-0005](../decisions/0005-cohort-definition.md)). A question about
historical care patterns probably wants them; a call list does not. Silver has
everybody.

**Check whether a corrected value changes it.** 20 A1c results were converted
from mis-keyed glucose readings. Exclude them with
`WHERE _dq_status = 'clean'` if the answer should rest only on untouched data.

## If the question cannot be answered

Some cannot, and saying so is the right answer:

- **Was the test ordered?** No orders table — see
  [ADR-0006](../decisions/0006-gap-definition.md).
- **Does the patient have a result elsewhere?** Not visible. The measure is "no
  result *we can see*".
- **Can we reach them?** No phone or email in the source data.
  `last_encounter_date` is the honest proxy.
