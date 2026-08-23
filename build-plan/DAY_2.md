# Day 2 — Break It On Purpose

**~3 hours · Tracker IDs 2.1 – 2.11**

## Why today exists

Today you write `corrupt.py`, which deliberately damages your Bronze data in six
realistic ways — and, just as importantly, writes down exactly what it damaged.

That second half is what separates this project from a demo. Without
`injected_defects.json`, tomorrow's catch rate is a *claim*. With it, it's a
*measurement*. Every check you write on Day 3 gets scored against ground truth
you created today.

The six defects aren't arbitrary. Each one has a real operational cause, listed
in `DATA_QUALITY_SPEC.md`. Know the cause, not just the symptom — "duplicate
rows" is a shrug; "an HL7 interface replayed the message" is a conversation.

## Learning objectives

By tonight you should be able to say, without notes:

- Why you log the injection rather than just running checks and reporting finds
- What an interface replay is, and why duplicate encounters are so common
- Why `corrupt.py` must be idempotent, and what breaks if it isn't

---

## Tasks

### 2.1 — Plan it on paper first

Re-read the **Principles** section of `DATA_QUALITY_SPEC.md`. Then write down,
for each of the six defects: which table, which rows you'll pick, how many, and
what identifier you'll log so you can find them again.

**Why:** injection is the one place you're deliberately writing bad data. If you
improvise it, you'll corrupt rows you can't identify afterwards, and your ground
truth file will be wrong in ways that are very hard to debug.

### 2.2 — Decide the volume

How many rows per defect type? Record in **Decision D3**.

**Why:** too few and the Pipeline page looks contrived — a single quarantined
row doesn't demonstrate anything. Too many and you gut the cohort you're
supposed to be reporting on. A useful frame: enough rows that the quarantine
table looks like a real work queue, but under a few percent of any table.

### 2.3 — D1: duplicate encounter rows

Pick existing encounters and write them a second time, unchanged.

**Real cause:** an HL7 interface replays a message, or a downstream system
double-posts. This is the single most common defect class of the six in real
clinical warehouses.

**Look this up:** HL7 interface replay, message idempotency

### 2.4 — D2: null `patient_id` in observations

Take real observation rows and blank the patient reference.

**Real cause:** a lab result arrives with a patient identifier that doesn't
resolve — a failed foreign key at ingest.

**Look this up:** orphan records, referential integrity

### 2.5 — D3: A1c value of 250

Set some A1c observations to 250.

**Real cause:** a glucose value in mg/dL entered into a field expecting a
percentage. This is the one defect of the six where quarantining is arguably the
*wrong* answer — a human can see what was meant. That tension is Decision D4
tomorrow.

**Look this up:** A1c units percent vs mmol/mol, estimated average glucose (eAG)

### 2.6 — D4: birth date in the future

**Real cause:** registration typo — a clerk types 2054 instead of 1954.

Trivial to catch, and that's fine. Not every check has to be clever. Some of the
most valuable checks in production systems are the boring ones.

### 2.7 — D5: discharge before admission

**Real cause:** clock drift or a timezone mismatch between two systems feeding
the same encounter record.

**Careful:** don't corrupt encounters that have no discharge timestamp. An open
encounter is valid data, not a defect, and tomorrow's DQ5 has to leave it alone.

### 2.8 — D6: same patient, two MRNs

Duplicate a patient record with the same name and birth date but a different MRN
and a different patient_id.

**Real cause:** the person registered at two different sites in the same health
system, or once as "Rob" and once as "Robert".

**This is the most dangerous defect of the six.** It's why DQ6 routes to a human
tomorrow instead of merging automatically. A wrong merge combines two people's
medication lists — that's a patient safety event, not a data bug.

**Look this up:** master patient index (MPI), deterministic vs probabilistic
record matching

### 2.9 — Write `injected_defects.json`

One entry per corrupted row: the defect id, the table, the source row
identifier, and what you changed.

**Why:** this file *is* your ground truth. Tomorrow you'll read it back and ask
"did my checks find each of these?" If the row identifiers in it don't resolve
back to actual rows, the file is decorative.

**Look this up:** ground truth in evaluation, why you separate the thing being
tested from the thing testing it

### 2.10 — Make it idempotent

Running `corrupt.py` twice from a clean Bronze must produce the same
`injected_defects.json` — not twice the corruption.

**Why:** you will run this many times over the next five days. If it stacks,
you'll poison your own data, get a nonsense catch rate, and lose an hour finding
out why.

**Look this up:** idempotency, `random.seed`, deterministic sampling

### 2.11 — Commit

---

## Validation

### V2.1 — Ground truth resolves to real rows
**Check:** for a sample of entries in `injected_defects.json`, look up that row
identifier in the corresponding bronze table
**Expect:** every identifier finds exactly one row (or, for D1 duplicates, the
count you'd expect), and that row is visibly corrupted
**If it fails:** your logged identifier isn't the one that identifies the row.
Fix this today — tomorrow's catch rate is unmeasurable without it.

### V2.2 — Entry count matches injection count
**Check:** count entries in `injected_defects.json` against the number of rows
your script reports corrupting
**Expect:** exactly equal, and all six defect ids present
**If it fails:** a code path corrupts without logging. That path will show up
tomorrow as a defect you "missed" that you actually never recorded.

### V2.3 — Idempotency
**Check:** restore clean Bronze, run `corrupt.py`, save the JSON. Restore clean
Bronze again, run it again, compare the two JSON files.
**Expect:** identical
**If it fails:** you're sampling without a fixed seed, or you're not restoring
Bronze between runs. Both matter.

### V2.4 — Corruption did not stack
**Check:** run `corrupt.py` twice **without** restoring Bronze in between, then
count how many rows are corrupted
**Expect:** the same number as after one run — or a clear, deliberate error
telling you Bronze is already corrupted
**If it fails:** task 2.10 isn't done. Decide now whether the script refuses to
run on dirty Bronze or reloads it first, then make it do that.

### V2.5 — Each defect is actually present and detectable
**Check:** one query per defect, confirming the bad data exists
- D1: any (patient_id, encounter_id) appearing more than once
- D2: observations with a null or empty patient_id
- D3: A1c observations outside 3.0-20.0
- D4: patients with a birth date after today
- D5: encounters where discharge < admission
- D6: more than one patient sharing the same name + birth date

**Expect:** every one returns rows, in the quantity you decided in D3
**If it fails:** that injection silently did nothing. Common cause: you filtered
for rows to corrupt and the filter matched nothing, and the script didn't
complain.

### V2.6 — You didn't corrupt the wrong thing
**Check:** for D5, confirm you only corrupted encounters that **had** a
discharge timestamp
**Expect:** no encounter has been given a discharge timestamp it didn't have
before
**If it fails:** you've invented a different defect than the one you documented,
and DQ5 tomorrow will produce confusing results.

### V2.7 — The cohort survived
**Check:** count distinct patients still carrying a diabetes code, and count
valid A1c observations remaining
**Expect:** close to your Day 1 numbers. You should have damaged a small
percentage, not a large one.
**If it fails:** Decision D3's volume is too aggressive. Dial it back — Gold on
Day 4 needs a real cohort to report on.

### V2.8 — Bronze totals are unchanged except where intended
**Check:** compare bronze row counts now against the Metrics sheet from Day 1
**Expect:** the only table that grew is `encounters` (D1 added duplicate rows)
and `patients` (D6 added a duplicate person). Everything else has the same
count — D2, D3, D4, D5 modify rows in place; they don't add or remove them.
**If it fails:** you deleted rows instead of corrupting them. Deleting is a
different defect class and it's not one of the six.

---

## Ship gate

- [ ] All six defect types are present in Bronze and confirmed by V2.5
- [ ] `injected_defects.json` exists and every entry resolves to a real row
- [ ] `corrupt.py` is idempotent (V2.3 and V2.4 both pass)
- [ ] The diabetic cohort is still large enough to be worth reporting on
- [ ] Decision D3 recorded
- [ ] Day 2 committed

## Common ways Day 2 goes wrong

**You corrupt rows you can't identify again.** Then the JSON is useless and
tomorrow's catch rate is guesswork. V2.1 catches this — run it.

**The script stacks corruption on rerun.** You spend an hour tomorrow wondering
why you have forty duplicate encounters instead of eight.

**You over-corrupt.** Gold ends up nearly empty and the whole app looks broken.
V2.7 catches this while it's still cheap to fix.

**You inject a defect the spec doesn't list**, because it seemed interesting.
Six is the number in the spec, and the catch rate is out of six. Adding a
seventh means rewriting the DQ Matrix and the README.
