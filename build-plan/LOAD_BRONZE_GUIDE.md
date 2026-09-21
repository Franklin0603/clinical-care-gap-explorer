# `load_bronze.py` — extended walkthrough

Task 1.12. Companion to the short version in `DAY_1_GUIDE.md`, which gives you
one fully worked table and tells you to extend it. This file is the rest: the
decisions to make before you type, the traps that are specific to *this*
dataset, and how to prove you're done.

Read `DAY_1_GUIDE.md § 1.12` first. Don't read this instead of writing the file.

---

## What Bronze is for

Bronze is a photocopy. Its only job is to be a faithful, timestamped record of
what arrived, so that when someone later asks "was that value wrong when we got
it, or did we break it?" you can answer.

Everything you might reasonably want to do to this data — casting dates,
deduping, dropping malformed rows — is Silver's job on Day 3, where every reject
lands in `quarantine` with a reason. Doing any of it here destroys the thing
Bronze exists to provide.

This matters more than usual on this project, because on Day 2 you deliberately
inject defects into Bronze and on Day 3 you measure what fraction you caught. If
Bronze quietly cleans itself on load, that catch rate measures nothing.

---

## Five decisions before you write a line

### 1. Which files · DO THIS

Five, not eighteen. `patients`, `encounters`, `conditions`, `observations`,
`medications`. That's Decision **D15** in the workbook — the other thirteen are
billing ledgers or clinical data with no bearing on an A1c gap, and
`claims_transactions.csv` alone is 1,094,500 rows.

Write the list out explicitly. A `glob` over `data/raw/csv/*.csv` is fewer
keystrokes and silently loads 40% more data than you decided to.

### 2. Table naming · DO THIS

`bronze_<source>` — `bronze_patients`, `bronze_encounters`, and so on. Day 3
builds `silver_*` beside them in the same database, and the prefix is what makes
`SHOW TABLES` legible when there are fifteen of them.

### 3. Where the database lives · DO THIS

```python
duckdb.connect("data/warehouse/clinical.duckdb")
```

The directory already exists and `*.duckdb` is already in `.gitignore`. The
default `duckdb.connect()` with no argument is **in-memory** — it works
perfectly, prints correct row counts, and then evaporates when the process
exits, leaving Day 2 with nothing to corrupt. This is the single most common way
this task appears to succeed and hasn't.

### 4. What the lineage columns hold · WORK THIS OUT

Two columns, on every row, of every table: `_loaded_at` and `_source_file`.
V1.6 checks both are populated.

`_loaded_at` — look up `current_timestamp`. It's evaluated once per statement,
so every row in a table shares a load timestamp. That's correct: it stamps the
*load*, not the row.

`_source_file` — you have a choice here, and it's worth two minutes:

- **`read_csv_auto(..., filename = true)`** adds a `filename` column
  automatically. Convenient, but the value is the path exactly as you passed it
  (`data/raw/csv/patients.csv`), and the column is called `filename`, not
  `_source_file`.
- **Hardcode the basename** per table (`'patients.csv'`) and you get the name
  you specified in the dictionary, with no path noise.

Either is defensible. Pick one, and know why when someone asks.

### 5. What happens on the second run · WORK THIS OUT

You will run this script many times this week. `CREATE TABLE` fails the second
time; `CREATE OR REPLACE TABLE` doesn't. Use the latter — the script should be
safely re-runnable, the same property Day 2 demands of `corrupt.py`.

But think one step further, because this is the part people miss:

> **Re-running `load_bronze.py` after `corrupt.py` wipes your injected defects.**

That's correct behaviour — a reload means fresh Bronze — but it makes run order
a real constraint from tomorrow onward. Put a comment in the file saying so.
Future you, debugging a catch rate of zero on Day 3, will be grateful.

---

## The shape

```
for each of the five sources:
    CREATE OR REPLACE TABLE bronze_<name> AS
    SELECT *,
           <load timestamp>  AS _loaded_at,
           <source name>     AS _source_file
    FROM read_csv_auto('<path>', all_varchar = true)

then: verify, and print the result
```

Roughly forty lines with the verification. Match `profile.py`'s structure —
module docstring, small named functions, `main()`, `if __name__ == "__main__"`.

---

## `all_varchar = true` is the whole task

If you take one thing from this file:

```python
read_csv_auto('data/raw/csv/observations.csv', all_varchar = true)
```

Without it, DuckDB samples the first chunk of rows, infers a type per column,
and then quietly nulls anything later in the file that doesn't fit. No error, no
warning — a smaller row count or a column full of unexplained nulls.

This is not hypothetical on this dataset. `observations.VALUE` holds mostly
numbers, but LOINC `25428-4` stores text results in the same column. Type
inference on that column is a coin flip about which 6,662 rows survive.

Silver is where types get applied, and where a value that won't cast lands in
`quarantine` with a `failure_reason` instead of disappearing. That difference is
the entire subject of this project.

---

## Verify inside the script

Print a table at the end. Don't check this by hand — you'll re-run the script
fifty times this week and a mismatch you have to notice is a mismatch you'll
miss.

**V1.5 — Bronze is faithful.** For each table, DuckDB count == CSV lines minus
the header. I checked all five against `wc -l`; they match exactly today, so any
mismatch you see is a bug you introduced:

```
patients        1,153
encounters     67,755
conditions     40,811
observations  870,510
medications    59,273
```

**V1.6 — Lineage is populated.** `SELECT _source_file, count(*) FROM
bronze_observations GROUP BY 1` — one row, no nulls, and `_loaded_at` non-null
on every row.

**V1.7 — Bronze is not typed.** `DESCRIBE bronze_patients`, and check the source
columns are `VARCHAR`.

> **One gotcha here.** `DAY_1_GUIDE.md` says "every column should be VARCHAR."
> That isn't quite true once you've added lineage: `current_timestamp` produces
> `TIMESTAMP WITH TIME ZONE`, so `bronze_patients` comes back 29 VARCHAR + 1
> timestamp. That's correct and expected — `_loaded_at` is *yours*, not the
> source's. Write the assertion against the source columns only, or you'll
> spend twenty minutes chasing a passing test that reports failure.

---

## Traps, in the order you'll hit them

**Globbing the directory.** Loads all 18 files. Every run for the next six days
gets slower for no page in the app.

**In-memory connection.** Everything passes, nothing persists. Check for
`data/warehouse/clinical.duckdb` on disk before you believe it worked.

**Casting `BIRTHDATE` because it's obviously a date.** It's obviously a date in
Silver. In Bronze it's obviously text.

**Deduping because you see repeated rows.** Tomorrow you add more on purpose.

**Assuming the lineage columns are VARCHAR.** See the gotcha above.

**`all_varchar` spelling.** It's a named argument to `read_csv_auto`. If DuckDB
errors, check the docs rather than guessing at variants.

---

## Search terms

DuckDB `read_csv_auto` options · `all_varchar` · `filename` option ·
`CREATE OR REPLACE TABLE AS SELECT` · `current_timestamp` · DuckDB persistent
vs in-memory database · `DESCRIBE` · medallion architecture bronze layer

---

## Done when

- [ ] `data/warehouse/clinical.duckdb` exists on disk
- [ ] Five `bronze_*` tables, row counts matching the numbers above exactly
- [ ] Every source column is `VARCHAR`
- [ ] `_loaded_at` and `_source_file` populated on every row of every table
- [ ] Running the script twice in a row succeeds and changes nothing but
      `_loaded_at`
- [ ] Nothing has been cast, deduped, filtered or renamed

Then V1.8 (say the four profiling answers out loud), commit, and Day 1 is shut.
