# Day 1 — Ground Truth

**~3 hours · Tracker IDs 1.1 – 1.13**

## Why today exists

You cannot define a patient cohort from a document. The blanks at the bottom
of `DATA_DICTIONARY.md` — *diabetic patient*, *open A1c gap* — are unanswerable
until you have looked at what Synthea actually emits. Today you get the data on
disk, look at it honestly, and load it untouched.

The temptation today is to start cleaning. Resist it. Bronze is a faithful copy
of what arrived. If you clean here, you destroy your ability to show anyone what
the raw data looked like — which is the entire point of the project.

## Learning objectives

By tonight you should be able to say, without notes:

- What belongs in Bronze and what specifically must **not** happen there
- The difference between SNOMED, LOINC and RxNorm, and why you join on codes
- Why a fixed random seed is the thing that makes your README verifiable

---

## Tasks

### 1.1 — Initialise the repo

This folder is not a git repo yet. Make it one, and commit `docs/` and
`build-plan/` as your first commit.

**Why:** the commit history is part of the portfolio. Seven days of steady
commits reads completely differently from one commit called "initial".

### 1.2 — `.gitignore` before any data exists

Exclude: the Synthea output directory, the DuckDB database file, your virtual
environment, `node_modules`, and OS junk files.

**Why:** Synthea emits hundreds of megabytes. If it lands in a commit even once
it is in your history permanently and the repo becomes painful to clone.
Getting this in *before* task 1.7 costs thirty seconds; fixing it afterwards
costs an hour.

**Look this up:** `gitignore templates Python`, `gitignore Node`,
`git check-ignore -v` (the flag that tells you *which rule* matched)

### 1.3 — Folder skeleton

Create `pipeline/`, `data/raw/`, `data/warehouse/`, `web/`.

**Why:** a flat repo of loose scripts reads as homework. Structure signals that
you thought about the shape of the thing before writing it.

**Look this up:** why git doesn't track empty directories, and the `.gitkeep`
convention

### 1.4 — Python environment

Create a virtual environment. Install `duckdb` and `pandas` into it. Freeze to
`requirements.txt` and commit that file.

**Why:** the README promises a run command. It has to work on a machine that
isn't yours.

**Look this up:** `python -m venv`, `pip freeze`, why installing globally will
eventually break something else on your machine

### 1.5 — Get Synthea running

Just get it to execute and print its usage text. Do not try to generate real
data yet.

**Why:** "the tool doesn't work" and "the tool works but my flags are wrong" are
two different problems. Debugging them simultaneously wastes an hour. You have
Java 17 installed, which is sufficient.

**Look this up:** Synthea GitHub releases, `synthea-with-dependencies.jar`,
running a jar with `java -jar`

### 1.6 — Decide population, state, seed

Write all three into the **Decisions** sheet (D1, D2) before you generate.

**Why:** the seed is the important one. It's what lets a reviewer clone your
repo, run it, and get the numbers in your README. Without it, every figure you
publish is unverifiable.

**Recommendation:** 1,000 patients. Every query stays instant, and you'll run
this pipeline dozens of times over the next six days. You can regenerate larger
on Day 4 once the pipeline is stable, if the row counts look thin.

**Look this up:** Synthea's `-p` and `-s` flags

### 1.7 — Generate with CSV export on

**Why:** Synthea defaults to FHIR JSON bundles. You want flat CSVs — FHIR
conformance is an explicit non-goal in the PRD, and parsing bundles would eat
the whole day.

**Look this up:** the `exporter.csv.export` property, `synthea.properties`,
passing exporter settings on the command line

### 1.8 – 1.11 — Profile before you load

This is the part people skip, and it's the part that makes Day 4 possible. Four
questions:

- **1.8** How many rows in each CSV? -> Metrics sheet
- **1.9** Which distinct diabetes SNOMED codes appear in conditions, and how
  many distinct patients carry each? -> into `DATA_DICTIONARY.md`
- **1.10** What is the A1c LOINC code, its unit string, and the min / median /
  max of its values?
- **1.11** What fraction of diabetes condition rows have a `resolved_date`?

**Why 1.10 matters:** DQ3's plausible range is 3.0-20.0 **percent**. If Synthea
emits A1c in mmol/mol, that range is wrong and injecting a "250" as a unit error
makes no sense. Confirm the reality before you build a check on top of it.

**Why 1.11 matters:** this single percentage decides Decision D5 — whether
"diabetic patient" means *any diabetes code ever recorded* or *only conditions
with no resolved date*. If almost nothing is ever resolved, the distinction is
academic and you should say so. If plenty resolve, you have a real choice to
defend.

**Look this up:** SNOMED CT browser, LOINC 4548-4, `GROUP BY`, the difference
between `COUNT(*)` and `COUNT(column)` on nullable columns

### 1.12 — Load Bronze

Every CSV into DuckDB as `bronze_*`, plus `_loaded_at` and `_source_file`.
No type casting, no dedupe, no validation, no filtering.

**Look this up:** DuckDB `read_csv_auto`, `CREATE TABLE AS SELECT`, the
`all_varchar` option, `current_timestamp`

### 1.13 — Commit

---

## Validation

Run every one of these before you call Day 1 done.

### V1.1 — The repo is real and the data is not in it
**Check:** `git status --short` after generating data
**Expect:** nothing under `data/` listed, no `.duckdb` file listed
**If it fails:** your `.gitignore` patterns don't match the actual paths. Run
`git check-ignore -v data/raw/patients.csv` — it prints the rule that matched,
or nothing if no rule matched.

### V1.2 — The environment is isolated
**Check:** activate the venv, then `which python` and `python -c "import duckdb"`
**Expect:** a path inside your venv directory, and no import error
**If it fails:** you installed into system Python, or you're in a shell where the
venv was never activated.

### V1.3 — Generation is reproducible
**Check:** run Synthea twice with the same seed into two different output
directories, then compare row counts of `patients.csv`
**Expect:** identical counts. Ideally identical file contents.
**If it fails:** your seed isn't actually being applied. This matters — without
it, Decision D2 is unenforceable and your README numbers can't be reproduced.

### V1.4 — The expected CSVs exist and are non-trivial
**Check:** `wc -l data/raw/*.csv`
**Expect:** at minimum `patients`, `encounters`, `conditions`, `observations`,
`medications`. With 1,000 patients, rough magnitudes: patients ~1,000;
encounters tens of thousands; observations by far the largest, likely six
figures. Conditions and medications in the thousands to tens of thousands.
**If it fails:** if you got one file or a `fhir/` directory full of JSON, CSV
export never turned on — task 1.7 isn't done. If observations is smaller than
encounters, something is wrong with the generation.

> These are magnitudes, not targets. Your exact numbers depend on your seed and
> Synthea version. Record what you actually get; don't chase mine.

### V1.5 — Bronze is a faithful copy
**Check:** for each table, compare the DuckDB row count against the CSV line
count minus one for the header
**Expect:** exactly equal, every table
**If it fails:** a row count *lower* than the CSV usually means the loader
inferred a type, hit a value it couldn't parse, and dropped or nulled rows. This
is precisely why Bronze should be loaded as text.

### V1.6 — Bronze carries its lineage
**Check:** `SELECT _source_file, count(*) FROM bronze_observations GROUP BY 1`
**Expect:** one row per source file, no nulls in `_source_file`, `_loaded_at`
populated on every row
**If it fails:** you added the columns but never populated them.

### V1.7 — Bronze has NOT been cleaned
**Check:** look at the column types of a bronze table, and check whether any
duplicate rows were removed on load
**Expect:** columns are text/varchar. Nothing has been deduped. Nothing has been
filtered.
**If it fails:** you cleaned in Bronze. Reload. On Day 2 you inject defects into
Bronze and on Day 3 you catch them — if Bronze silently cleans itself, your
catch rate measures nothing.

### V1.8 — You can answer the profiling questions out loud
**Check:** say these to yourself without looking anything up:
- The diabetes SNOMED code(s) I will filter on are ___
- The A1c LOINC code is ___ and its unit is ___
- A1c values in my data range from ___ to ___
- ___% of diabetes conditions have a resolved_date, so definition D5 should be ___

**Expect:** four answers with real numbers
**If it fails:** tasks 1.9-1.11 aren't finished. This is the check that Day 4
depends on — everything else today is plumbing.

### V1.9 — Sanity: is there a project here at all?
**Check:** count distinct patients carrying a diabetes code
**Expect:** enough to make a care-gap list interesting. Below ~50 and your Gold
page will look empty — regenerate with a larger population now, while it costs
you nothing.
**If it fails:** bump the population in Decision D1 and rerun. Better to find
this today than on Day 4.

---

## Ship gate

Do not start Day 2 until all of these are true:

- [ ] Bronze tables exist in DuckDB and row counts match the CSVs exactly
- [ ] Bronze is untyped and uncleaned
- [ ] The real diabetes SNOMED codes and A1c LOINC code are written into
      `docs/DATA_DICTIONARY.md`
- [ ] Decisions D1 and D2 are recorded with the actual seed value
- [ ] The Metrics sheet has all five Bronze row counts
- [ ] Day 1 is committed

## Common ways Day 1 goes wrong

**You generate before writing `.gitignore`.** Then you accidentally commit
600MB. Do 1.2 first — it's ordered that way for a reason.

**You get FHIR JSON instead of CSV** and spend an hour writing a parser. Stop
and fix the export setting instead.

**You start cleaning in Bronze** because the data looks messy. It's supposed to.
You're about to make it messier on purpose tomorrow.

**You skip profiling** because loading felt like the real work. Day 4 will then
stall completely, because you'll be trying to define a cohort with no evidence.
