# Notebooks

Where the decisions were made, with the evidence still attached.

Each stage of this pipeline was prototyped here before it was ported to
`src/caregap/`. The notebooks were not cleaned up afterwards and are not a
tutorial rewritten from the finished code — they are the working record, with
the outputs that produced each decision still in them.

That is deliberate. A decision written in a document is an assertion. The same
decision next to the query that produced it is an argument.

| | Covers | Decisions it settles |
|---|---|---|
| `01_profile.ipynb` | What arrived in the raw export, before anything was loaded | **D15** five files of eighteen · **D5** eight codes not one · **D13** A1c not glucose · **DQ3** the floor that was wrong |
| `02_validate.ipynb` | The six data quality checks, and scoring them against known defects | **D7** a fixed as-of date · **D4** remediate the unit error, reversibly |
| `03_gold.ipynb` | The care-gap table, and what else it can answer | **D5/D6** both cohort definitions locked · the nine worklist columns · the six charts |
| `04_playground.ipynb` | **Answering a question somebody just asked** — not a record, a working surface | — |
| `05_text_to_sql.ipynb` | Whether a model writes better SQL than the ten hand-written queries | **D12** no language model — now tested rather than assumed |

`01`–`03` are history: decisions already made, with the evidence that made them.
`04` is for now. If a clinician asks something, that is where the answer gets
found, as a table or a chart. `05` revisits a decision with a measurement, which
is what the other four are for — it needs a key in `.env`, and it is the only
notebook that calls out to anything.

## Running them

```bash
make generate          # the warehouse has to exist for 02 and 03
jupyter lab notebooks  # or open them in VS Code
```

Pick the kernel named **Python (clinicalGap .venv)**. Each notebook adds
`../src` to the path in its first cell, so the package imports without an
install.

`01_profile.ipynb` needs only `data/raw` and writes nothing — it reads the CSVs
directly, which is the point: it ran before the pipeline existed.
`04_playground.ipynb` opens the warehouse **read-only**, so nothing explored
there can change it.

## Which layer answers which question

The thing `04` is most useful for, and the thing that takes longest to learn:

| The question is about… | Query | Because |
|---|---|---|
| Who is overdue, and how badly | `care_gap_a1c` | One row per patient, already carrying the gap and the priority |
| A patient's history over time | `silver_observations` | Gold holds only the *latest* A1c |
| When somebody was last seen | `silver_encounters` | Every visit, not just the most recent |
| What they are on | `silver_medications` | Gold has a count; the names are here |
| **Why a patient is missing** | `quarantine` · `identity_review` | The whole reason those tables exist |

**Gold answers "who". Silver answers "what happened".**

## The one thing to know before running them

**DuckDB allows one writer.** A notebook kernel holding the database blocks
every script, and closing the tab does not stop the kernel. Each notebook ends
with `con.close()`; run that cell, or shut the kernel down, before `make run`.

This cost two interruptions during the build. It is the real cost of working this
way with a single-file database, and worth knowing rather than rediscovering.

## Why notebook-first

Writing a stage in a notebook first means seeing each step's output before
committing to a structure. Three of the findings in `docs/explanation/findings.md` came out
of that gap between what a query was expected to return and what it did:

- the 73 patients carrying a complication with no diagnosis code
- the inner join that drops every never-tested patient without erroring
- the plausibility floor that rejects 11% of clean data

None would have surfaced from writing the `.py` directly and running it once.
