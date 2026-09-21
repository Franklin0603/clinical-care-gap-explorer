# Day 1 — Walkthrough

Companion to `DAY_1.md`. That file says what and why; this one says how.

**Two kinds of step in here:**

- **DO THIS** — exact commands. Setup and tooling. Copy them; there's nothing to
  learn from retyping a `mkdir`.
- **WORK THIS OUT** — a worked example, then the same pattern applied to a new
  question by you. This is where the learning is. If you copy your way past
  these, Day 4 will be much harder and the interview will be worse.

Run everything from the project root:
`/Users/franklinajisogun/Documents/engineering-project/healthcare-project/clicicalGap`

---

## 1.1 — Initialise the repo  · DO THIS

```bash
git init
git branch -M main
```

Hold off on the first commit until `.gitignore` exists. That ordering is the
whole point of the next step.

---

## 1.2 — `.gitignore` first  · DO THIS

```bash
cat > .gitignore <<'EOF'
# data — regenerable, large, and never belongs in git
data/raw/
data/warehouse/
*.duckdb
*.duckdb.wal
synthea/
*.jar

# python
.venv/
__pycache__/
*.pyc

# node
node_modules/
.next/
.vercel/

# os / editor
.DS_Store
.idea/
.vscode/
EOF

git add .gitignore docs build-plan
git commit -m "Docs, build plan, and gitignore before any data lands"
```

**Why `*.jar` is in there:** the Synthea jar is ~200MB. It's a tool, not your
code.

Prove it works once data exists — this is validation **V1.1**:

```bash
git check-ignore -v data/raw/csv/patients.csv
```

It prints the line of `.gitignore` that matched. Silence means nothing matched
and the file *would* be committed.

---

## 1.3 — Folder skeleton  · DO THIS

```bash
mkdir -p pipeline data/raw data/warehouse web
touch pipeline/.gitkeep web/.gitkeep
```

`data/` isn't tracked at all, so it needs no `.gitkeep`.

---

## 1.4 — Python environment  · DO THIS

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install duckdb pandas
pip freeze > requirements.txt
```

Validation **V1.2**:

```bash
which python                      # must point inside .venv
python -c "import duckdb; print(duckdb.__version__)"
```

Every new terminal needs `source .venv/bin/activate` again. When something
"isn't installed", check this first.

---

## 1.5 — Get Synthea  · DO THIS

```bash
mkdir -p synthea && cd synthea
curl -L -O https://github.com/synthetichealth/synthea/releases/download/master-branch-latest/synthea-with-dependencies.jar
java -jar synthea-with-dependencies.jar --help | head -30
cd ..
```

If that URL 404s, go to the releases page on GitHub and grab the current
`synthea-with-dependencies.jar` — it's the standalone build with everything
bundled, which is why you don't need Gradle.

You're done with 1.5 when `--help` prints usage. Don't generate yet.

---

## 1.6 — Decide, then record  · DO THIS

Into the **Decisions** sheet before you run anything:

- **D1** population: `1000`
- **D2** state and seed: `Massachusetts`, seed `20260823` (any fixed integer —
  use a date you'll recognise)

The seed is what makes your README reproducible. Pick it deliberately and write
it down; don't let it be an accident of a command you ran once.

---

## 1.7 — Generate  · DO THIS

```bash
java -jar synthea/synthea-with-dependencies.jar \
  -p 1000 \
  -s 20260823 \
  --exporter.baseDirectory ./data/raw \
  --exporter.csv.export true \
  --exporter.fhir.export false \
  Massachusetts
```

Flag by flag:

| Flag | What it does |
|---|---|
| `-p 1000` | population of *living* patients |
| `-s 20260823` | random seed — the reproducibility guarantee |
| `--exporter.csv.export true` | flat CSVs, which you want |
| `--exporter.fhir.export false` | turns off the default FHIR JSON. Skip this and you generate hundreds of MB you'll never open |
| `Massachusetts` | positional arg, the state |

Takes a few minutes. Then:

```bash
ls data/raw/csv/
wc -l data/raw/csv/*.csv
```

Note the path: Synthea puts CSVs in a `csv/` subdirectory of the base
directory. That's validation **V1.4**.

**Two things worth noticing in the output:**

`patients.csv` has a `DEATHDATE` column, and deceased patients are in there.
Whether your care-gap cohort includes them is a real decision — a deceased
patient can't have an overdue A1c. Note it now; it feeds Decision D5 on Day 4.

Synthea also truncates history by default (`--exporter.years_of_history`, 10
years). Fine for a 12-month A1c window, but know it's happening.

---

## 1.8 — Row counts  · WORK THIS OUT (worked example)

Here's the full pattern, once. Everything after this you write yourself.

```python
# pipeline/profile.py
import duckdb, glob, os

con = duckdb.connect()          # in-memory; profiling doesn't need a saved db

for path in sorted(glob.glob("data/raw/csv/*.csv")):
    name = os.path.basename(path)
    n = con.sql(f"SELECT count(*) FROM read_csv_auto('{path}')").fetchone()[0]
    print(f"{name:24} {n:>10,}")
```

```bash
python pipeline/profile.py
```

Two things in there that carry forward:

- `read_csv_auto('path')` queries a CSV directly, with no load step. This is
  DuckDB's best feature for exploration.
- `.fetchone()[0]` pulls a single scalar out. For a whole table, use
  `con.sql(...).df()` to get a pandas DataFrame instead.

Put the five counts in the **Metrics** sheet.

**Before you write another query, print the headers:**

```python
print(con.sql("SELECT * FROM read_csv_auto('data/raw/csv/conditions.csv') LIMIT 3").df())
```

Synthea's column names are uppercase and vary a little between versions. Look
at the real ones rather than trusting any doc, including this one.

---

## 1.9 — Find the diabetes codes  · WORK THIS OUT

**The question:** which distinct diabetes SNOMED codes appear in
`conditions.csv`, and how many distinct patients carry each?

**The method, which is the actual lesson:** you *discover* codes by searching
descriptions, then you *filter* on codes forever after. `DATA_DICTIONARY.md` is
explicit — "Do not hardcode display names — join on codes." Descriptions vary by
source system and get reworded; codes don't.

**Shape of what you're writing:**

```
SELECT  <the code column>,
        <the description column>,
        count(*)                     AS rows,
        count(DISTINCT <patient col>) AS patients
FROM    read_csv_auto('data/raw/csv/conditions.csv')
WHERE   lower(<description col>) LIKE '%diabet%'
GROUP BY 1, 2
ORDER BY patients DESC
```

**Hints:**

- Conditions has a start column and a stop column, plus patient, code and
  description. Confirm the exact names from the header print above.
- `LIKE '%diabet%'` catches "Diabetes", "Prediabetes", "Diabetic retinopathy"
  and more. That's intentional — you want to see the whole family before you
  decide what's in scope.
- Then look hard at the results. Prediabetes is not diabetes. Neither is
  "history of". Diabetic *retinopathy* implies diabetes but isn't the diagnosis
  code. **Which of these belong in your cohort is a clinical judgement, and
  writing down why is Decision D5.**

Write the codes you settle on into `docs/DATA_DICTIONARY.md`, replacing the
placeholder text under "Code systems used".

---

## 1.10 — Confirm the A1c observation  · WORK THIS OUT

**The question:** what's the LOINC code for A1c in your data, what unit does it
carry, and what do the values look like?

Same discover-then-pin move. Search `observations.csv` descriptions for
`hemoglobin` or `a1c`, find the code, then query by code only.

Once you have the code, get the distribution:

```
SELECT  count(*),
        min(CAST(<value col> AS DOUBLE)),
        median(CAST(<value col> AS DOUBLE)),
        max(CAST(<value col> AS DOUBLE)),
        <the units column>
FROM    read_csv_auto('data/raw/csv/observations.csv')
WHERE   <code col> = '<the code you found>'
GROUP BY <the units column>
```

**Hints:**

- The value column arrives as text — observations hold numbers *and* strings in
  the same column, so it can't be typed on read. `CAST` it here.
- Expect LOINC `4548-4`, but verify rather than assume.
- Group by units deliberately. If more than one unit appears for the same code,
  that's a real finding and it changes DQ3.

**What you're checking:** `DATA_QUALITY_SPEC.md` sets DQ3's plausible range at
3.0–20.0 **percent**. If your median sits around 5–6 with unit `%`, that range
holds and injecting a 250 as a unit error makes sense. If values come back in
mmol/mol, the range is wrong and you'll need to say so before Day 2.

---

## 1.11 — Resolved-date fill rate  · WORK THIS OUT

**The question:** of the diabetes condition rows, what fraction have a stop
date?

**The one SQL idea you need:**

```sql
count(*)              -- counts every row
count(some_column)    -- counts only rows where that column is NOT NULL
```

So `count(stop_col) * 1.0 / count(*)` is the fill rate, in one query, with no
`WHERE`. That asymmetry between `count(*)` and `count(col)` is worth
internalising — it's a common source of quietly wrong numbers.

Filter to the diabetes codes you pinned in 1.9.

**What the answer decides:** Decision D5. If almost nothing resolves, "any
diabetes code ever recorded" and "only unresolved" are the same cohort, and the
honest thing to say is that the distinction doesn't bite in Synthea but would in
real data. If a meaningful share do resolve, you have a genuine choice to
defend.

---

## 1.12 — Load Bronze  · WORK THIS OUT (worked example, then extend)

> Extended version, including the decisions to make before you type and the
> traps specific to this dataset: `LOAD_BRONZE_GUIDE.md`.

One table, fully worked:

```python
# pipeline/load_bronze.py
import duckdb

con = duckdb.connect("data/warehouse/clinical.duckdb")

con.sql("""
CREATE OR REPLACE TABLE bronze_patients AS
SELECT
    *,
    current_timestamp        AS _loaded_at,
    'patients.csv'           AS _source_file
FROM read_csv_auto(
    'data/raw/csv/patients.csv',
    all_varchar = true          -- everything stays text. this is the point.
)
""")

print(con.sql("SELECT count(*) FROM bronze_patients").fetchone()[0])
```

**`all_varchar = true` is the most important line in the file.** Bronze is a
faithful copy of what arrived. If DuckDB infers types on read, it will silently
null or reject values it can't parse — a silent drop before you've written a
single check, and the exact thing this project exists to prevent. Typing happens
in Silver, on Day 3, where rejects get quarantined with a reason.

**Now extend it yourself** to the other four tables — encounters, conditions,
observations, medications.

Do it as a loop over the file list rather than five copy-pasted blocks. You'll
be re-running this all week, and on Day 2 `corrupt.py` will need to reload
Bronze from clean. Think about that while you write it: how does this script
behave when it runs a second time? `CREATE OR REPLACE` is a hint.

**Watch for:** `read_csv_auto` also takes `filename = true`, which adds the
source path as a column. Whether you use it or hardcode the name per table is
your call — but know it exists.

---

## Validate before you stop

From `DAY_1.md`, run all nine. The four that catch real problems:

**V1.5 — Bronze is faithful.** DuckDB count == CSV lines minus header, every
table.

```python
# extend this to all five
csv_rows = con.sql("SELECT count(*) FROM read_csv_auto('data/raw/csv/patients.csv', all_varchar=true)").fetchone()[0]
db_rows  = con.sql("SELECT count(*) FROM bronze_patients").fetchone()[0]
print(csv_rows, db_rows, "OK" if csv_rows == db_rows else "MISMATCH")
```

**V1.7 — Bronze is not typed.** `DESCRIBE bronze_patients` — every column should
be VARCHAR. Anything else means `all_varchar` didn't apply.

**V1.8 — You can answer the four profiling questions out loud.** With real
numbers, no notes. This is the gate that Day 4 depends on.

**V1.9 — Is there a project here?** Count distinct patients carrying your
diabetes codes. Under ~50 and Gold will look empty — bump the population and
regenerate now, while it costs you nothing.

---

## Commit

```bash
git add pipeline requirements.txt docs
git commit -m "Day 1: Synthea generation, data profiling, Bronze load"
```

`data/` won't appear in that commit. If it does, `.gitignore` is wrong — go back
to 1.2 before committing.

---

## Where you should be

- Five `bronze_*` tables in `data/warehouse/clinical.duckdb`, untyped, row
  counts matching the CSVs
- Real diabetes SNOMED codes and the A1c LOINC code written into
  `DATA_DICTIONARY.md`
- Decisions D1 and D2 recorded with the actual seed
- Metrics sheet: five Bronze row counts
- A view on Decision D5 that you formed from data, not from a document

Tomorrow you break it on purpose.
