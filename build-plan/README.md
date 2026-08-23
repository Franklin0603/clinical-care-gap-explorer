# Build Plan — Clinical Care Gap Explorer

Everything you need to build this yourself, in order, with a way to check
your own work at every step.

## What's in here

| File | Use it for |
|------|-----------|
| `Clinical_Care_Gap_Build_Plan.xlsx` | Tracking. 70 tasks, decisions log, catch-rate calculator, learning log. Live in the Task Tracker sheet. |
| `DAY_1.md` … `DAY_7.md` | Doing. One file per working day: what to build, why, what to look up, and how to prove it worked. |
| `DAY_N_GUIDE.md` | Walkthrough for that day — exact commands for setup, worked examples plus exercises for the parts that matter. Ask for the next one when you get there. |
| `VALIDATION.md` | The invariants that must hold at every stage, in one place. Your reference when something feels wrong. |

## How a day works

1. Open the day's markdown file. Read the whole thing before writing anything.
2. Work the tasks in order. Each maps to an ID in the Task Tracker sheet.
3. Run that day's **validation checks**. Every one must pass.
4. Record numbers in the Metrics sheet, decisions in the Decisions sheet.
5. Rate yourself in the Learning Log.
6. Commit.

## About the validation checks

Each check has three parts:

- **Check** — the command or query to run
- **Expect** — what a correct result looks like
- **If it fails** — the most likely cause, so you debug the right thing

The checks verify your work; they don't do it. A check like
`SELECT count(*) FROM bronze_encounters` tells you whether the load worked —
it doesn't tell you how to load. That gap is deliberate and it's where the
learning is.

**Two kinds of expected values.** Some are absolute invariants that must hold
no matter what data you generated — `bronze = silver + quarantined` is true
for every dataset ever. Others depend on your Synthea seed, so the doc gives
you a plausible *range* and asks you to record your actual number. Trust the
invariants completely; treat the ranges as a smell test.

## The rule about asking for help

Try the lookup first. The **Go find out** column in the tracker and the
**Look this up** sections here name the exact concept to search for.

Ask when you have a specific error you've already tried to read, or when a
validation check fails and you've ruled out the "If it fails" causes. Not
before. The parts you struggle through are the parts you'll be able to
defend in an interview.

## Governing docs

These live in `../docs/` and are the source of truth. The build plan
implements them; it does not override them.

- `PRD.md` — scope, and a binding non-goals list
- `DATA_DICTIONARY.md` — tables, columns, cohort definitions
- `DATA_QUALITY_SPEC.md` — the six defects, the six checks, three output tables
- `ACCESS_CONTROL.md` — role matrix and the language rules
- `README_TEMPLATE.md` — the blanks you fill on Day 7
