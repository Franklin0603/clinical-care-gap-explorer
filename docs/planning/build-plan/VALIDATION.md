# Validation Reference

The checks that must hold, in one place. Use this when a number looks wrong and
you don't know where to start.

---

## Part 1 — Invariants

These are true regardless of your seed, your population size, or your cohort
definitions. If one of these fails, something is broken — not merely surprising.

### The reconciliation invariant

```
for every table:   bronze rows  =  silver rows  +  quarantined rows
```

The single most important line in the project. It's FR2 ("no silent drops")
expressed as arithmetic, and it should run on every pipeline execution and fail
loudly.

Remediated rows sit in Silver *and* have an entry in `remediation_log`. They are
not quarantined. Count them once, on the Silver side.

### Grain invariants

```
care_gap_a1c:      count(*) = count(distinct patient_id)
silver tables:     row count <= corresponding bronze count
```

A Silver table larger than its Bronze source means a join fanned out. With the
D6 duplicate patient present, this is a live risk all week.

### Null-safety invariants

```
last_a1c_date IS NULL   =>   days_since_a1c IS NULL
last_a1c_date IS NULL   =>   gap_flag = TRUE
days_since_a1c          >=   0, always
```

The middle line is the never-tested patient. If patients with no A1c are absent
from Gold entirely, an inner join deleted your highest-risk cohort.

### Provenance invariants

```
every quarantine row:   check_id IS NOT NULL AND failure_reason IS NOT NULL
every quarantine row:   (source_table, source_row_id) resolves to a bronze row
every remediation row:  original_value IS NOT NULL
every identity_review row on day 3:  status = 'pending'
```

### Isolation invariants

```
no patient_id in care_gap_a1c appears in quarantine as a rejected patient
no bronze table is read by anything downstream of silver
```

Gold comes from Silver. If Gold touches Bronze anywhere, the validation layer
was decorative.

### Language invariants

```
the repo contains no unqualified claim of HIPAA compliance
every page renders the synthetic-data notice, including error states
no error path exposes a stack trace
```

---

## Part 2 — Values that depend on your data

These vary with your seed and population. The doc gives you a smell test, not a
target. **Record your actual numbers in the Metrics sheet** and use these to
notice when something is off by an order of magnitude.

| Quantity | Rough expectation at 1,000 patients | What an odd value suggests |
|---|---|---|
| patients.csv rows | ~1,000, plus any dead patients Synthea includes | Far off -> wrong population flag |
| observations.csv rows | The largest file by far, likely six figures | Smaller than encounters -> generation problem |
| encounters.csv rows | Tens of thousands | — |
| conditions / medications | Thousands to tens of thousands | — |
| Distinct patients with a diabetes code | Enough for a real list; under ~50 is thin | Zero -> wrong SNOMED code |
| A1c values | Clustered in a plausible clinical percentage range | Values near 250 pre-injection -> wrong units, revisit DQ3's bounds |
| Rows corrupted on Day 2 | A small percentage of each table | Large -> Gold will be empty |
| Catch rate | 5 or 6 of 6 | 6 of 6 with a loosened check is worse than 5 of 6 honest |
| Gap rate | Low-ish; Synthea generates diligent care | 0% -> logic never fires. 100% -> A1c results aren't joining |
| Never-tested patients | Some, usually | Zero -> suspect an inner join |
| Pipeline runtime | Seconds to a couple of minutes | Many minutes -> a missing filter or an accidental cross join |

---

## Part 3 — Debugging by symptom

**A number on screen doesn't match the warehouse.**
Stale build-time export, or a hardcoded value. Regenerate with a different seed
and reload — anything that doesn't move was hardcoded.

**Silver is smaller than expected and quarantine didn't grow.**
A check dropped rows silently. Run the reconciliation per table to find which
one, then per check within that table.

**Row counts exploded after a join.**
The D6 duplicate patient. One person existing twice multiplies every row that
joins through them.

**Every open encounter got quarantined.**
DQ5's null handling. `NULL >= x` is unknown, not false, and `NOT (unknown)` is
still unknown.

**Gold has no never-tested patients.**
Inner join. The most important bug in the project.

**Cast columns are full of nulls in Silver.**
`TRY_CAST` swallowed unparseable values and left the row looking clean. Those
rows should have been quarantined — it's a silent drop in disguise.

**Catch rate is nonsense (over 100%, or zero).**
Over 100%: you're counting quarantine rows instead of matching against
`injected_defects.json`. Zero: your row identifiers in the ground-truth file
don't resolve.

**Corruption doubled after a rerun.**
`corrupt.py` isn't idempotent, or Bronze wasn't restored first.

**A defect got caught by the wrong check.**
Coincidence, not correctness. Confirm each defect is caught by its intended
check id before claiming the check works.

**Works locally, fails deployed.**
Almost always Decision D9 — the data-access approach. Serverless filesystems are
ephemeral and read-only in ways local development never shows you.

**A chat answer is confidently wrong.**
Verify against the Metrics sheet. If a chip can't be trusted, cut it. Nine
reliable chips beat ten with one liar.

---

## Part 4 — Pre-ship checklist

Run this once, at the end, against the deployed app.

**Data**
- [ ] Reconciliation balances for every table
- [ ] Gold grain is one row per patient
- [ ] Never-tested patients present and flagged
- [ ] No quarantined data reached Gold
- [ ] Three patients hand-verified end to end

**Quality layer**
- [ ] All six defects present, and each caught by its intended check
- [ ] Catch rate measured against ground truth, escapes explained
- [ ] Nothing auto-merged in `identity_review`
- [ ] `original_value` preserved on every remediation

**App**
- [ ] Synthetic-data banner on every page including errors
- [ ] No hardcoded numbers
- [ ] PCT payload contains no restricted fields
- [ ] Role changes both rows and columns
- [ ] Restricted fields shown as labelled placeholders
- [ ] Generated SQL displayed, and it's the SQL that ran
- [ ] Five bad questions, five clean sentences
- [ ] No stack trace reachable anywhere

**Repo**
- [ ] No `___` blanks left in the README
- [ ] README numbers match the live app
- [ ] Clean clone runs from the README alone
- [ ] No unqualified compliance claim anywhere
- [ ] "What I'd do differently at scale" written in both places
- [ ] Loom recorded, under 90 seconds, linked
