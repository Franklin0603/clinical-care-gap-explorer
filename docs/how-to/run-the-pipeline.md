# Run the pipeline

## First time

```bash
make setup      # virtualenv, the package, web dependencies
make generate   # download Synthea, generate patients, build everything
```

`make generate` needs **Java 17** and takes about four minutes, most of it
Synthea simulating 1,153 lifetimes. It downloads a ~200 MB jar once; the jar is
a tool rather than code, so it is not in the repository.

## After that

```bash
make run     # rebuild the warehouse from data/raw   (~13 seconds)
make test    # 121 tests
make web     # the app at localhost:3000
```

`make` with no target lists everything.

## What a run does

Five stages, each re-runnable and each verifying its own work:

| | Stage | What it does |
|---|---|---|
| 1 | `ingest` | Raw CSVs into Bronze, every column text, nothing cleaned |
| 2 | `corrupt` | Damages 249 rows in six realistic ways and logs exactly what it damaged |
| 3 | `validate` | Six checks into Silver; rejects quarantined with a reason |
| 4 | `gold` | `care_gap_a1c` — one row per diabetic patient |
| 5 | `publish` | The snapshot the web app reads |

A stage that cannot prove what it did raises rather than printing a warning
nobody reads. The run ends with a manifest: commit, per-stage timings, row
counts per layer, and anything that moved since the previous run.

## Things that will bite you

**DuckDB allows one writer.** A notebook kernel holding the database blocks every
script, and closing the notebook tab does not stop the kernel. Every notebook
ends with `con.close()` — run that cell, or shut the kernel down.

**Stage order matters from stage 2 onward.** Running `ingest` on its own reloads
Bronze from the clean CSVs, which wipes the injected defects and leaves the
reconciliation unbalanced. `make run` always runs all five in order; that is
what it is for.

**`make generate` replaces `data/raw`.** The four pinned time flags
([ADR-0002](../decisions/0002-pinned-seed.md)) mean it regenerates identical
data, so this is safe — but it is four minutes you rarely need to spend.

## Starting completely clean

```bash
make fresh   # delete the warehouse, rebuild it from data/raw
```

Expect, every time:

```
catch rate: 6 of 6 defect types | 249 of 249 rows
care_gap_a1c: 116 patients, 25 open gaps (21.6%), 21 never tested
```

Different numbers mean something changed — the manifest will say what.
