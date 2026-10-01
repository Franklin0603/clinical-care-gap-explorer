# Add a data quality check

The six checks are definitions, not functions. Adding one is an entry in a list;
the runner does the plumbing.

## 1 · Define it

In `src/caregap/domain/checks.py`, append to `CHECKS`:

```python
{
    "id": "DQ7",
    "table": "bronze_observations",
    "name": "Observation has a unit",
    "rule": "Every numeric result carries a unit",
    "cause": "A feed dropped the units column during an upgrade",
    "key": OBS_KEY,
    "predicate": "WHERE TRY_CAST(VALUE AS DOUBLE) IS NOT NULL AND (UNITS IS NULL OR UNITS = '')",
    "reason": "'Numeric result with no unit recorded'",
    "action": QUARANTINE,
},
```

| Field | What it must be |
|---|---|
| `id` | `DQ7`. Pairs with defect `D7` — a defect caught by any other check is a coincidence, and the catch rate says so |
| `table` | A `bronze_*` table. Checks read Bronze, not Silver |
| `rule`, `cause` | Prose, not SQL. Both go on screen for a reader who does not write SQL |
| `key` | How to address one rejected row. Observations have no row id, so they use `OBS_KEY` |
| `predicate` | SQL selecting the rows that **fail** |
| `reason` | SQL, not a string — one check can reject rows for different reasons, and the row decides which sentence it gets |
| `action` | `QUARANTINE`, `REVIEW`, or add a `remediate` block |

## 2 · Exclude rows another check already took

A row is rejected once, or the reconciliation double-counts it. If your check
overlaps an existing one, defer:

```python
"excludes": "DQ1",
```

## 3 · Subtract the rejects from Silver

`src/caregap/sql/silver/build.sql` builds each table as Bronze minus the
`rej_*` temp tables. Add yours to the relevant `WHERE`:

```sql
WHERE o.rowid NOT IN (SELECT rid FROM rej_DQ7)
```

Skip this and `bronze = silver + quarantine` stops balancing, which fails the
build — by design.

## 4 · Run it

```bash
make run && make test
```

The DQ matrix on the Pipeline page generates itself from the definitions, so
there is nothing to update by hand.

## What you do not have to do

- **Write a function.** The runner in `validate.py` executes any definition.
- **Update the web page.** It renders from `dq_report.json`, which is generated.
- **Update the catch rate.** It is computed by joining the defect log to the
  output tables.

## If it should also be scored

The catch rate measures checks against *deliberately injected* defects. A new
check only scores if a matching defect exists — add one to `DEFECT_VOLUME` in
`config.py` and an injection function in `stages/corrupt.py`.

A check with no paired defect is still useful; it just does not appear in the
"6 of 6" and the README should say so rather than implying coverage it has not
measured.
