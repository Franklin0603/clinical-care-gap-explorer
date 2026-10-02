"""The published artefacts are in a declared, reproducible order.

Why this is worth a test. The pipeline's claim is that the same seed gives the
same numbers (ADR-0002), and these files are committed, so a reader can diff
them. Neither held: `SELECT * FROM care_gap_a1c` has no ORDER BY, so DuckDB
returned rows in whatever order the scan produced, and two runs over identical
data rewrote every artefact in a different sequence. Worse, `priority` is a
published worklist rank computed by `row_number()`, and two never-tested
patients of the same age tie on every clinical sort key - so the rank itself
moved between runs. A nurse working down that list would have seen two patients
swap places for no reason.

That was found by diffing two runs, not by reading the code. These tests are the
cheap standing version of that diff: they assert the order each artefact
declares, so removing an ORDER BY fails here rather than quietly reintroducing
churn.

One artefact is deliberately not stable. `quarantine` carries `raw_payload`, the
whole source row including its Bronze `_loaded_at`, which is a wall-clock load
time and is supposed to change on every run.
"""

import json

import pytest

from caregap import config
from caregap.stages.publish import TABLES

OUT = config.WEB_DATA
HINT = "Run `caregap run` first to build the exports."


def load(name):
    path = OUT / name
    if not path.exists():
        pytest.skip(f"No export at {path}. {HINT}")
    return json.loads(path.read_text())


def sort_key(row, columns):
    """The tuple a row sorts on, with None ordered consistently."""
    return tuple((row[c] is None, row[c]) for c in columns)


@pytest.mark.parametrize("table,order", sorted(TABLES.items()))
def test_exported_tables_are_in_their_declared_order(table, order):
    rows = load(f"{table}.json")
    columns = [c.strip() for c in order.split(",")]
    missing = [c for c in columns if rows and c not in rows[0]]
    assert not missing, f"{table}.json has no column {missing}; the order key is stale"

    keys = [sort_key(r, columns) for r in rows]
    assert keys == sorted(keys), (
        f"{table}.json is not ordered by {order}. Without a total order the file "
        "is rewritten in a different sequence on every run."
    )


def test_order_keys_are_a_total_order():
    """A declared order with ties leaves the tied rows free to move.

    This is the failure that reached the published output: an order that looks
    specified, with duplicates inside it.
    """
    for table, order in sorted(TABLES.items()):
        rows = load(f"{table}.json")
        columns = [c.strip() for c in order.split(",")]
        keys = [sort_key(r, columns) for r in rows]
        dupes = len(keys) - len(set(keys))
        assert dupes == 0, (
            f"{table} declares ORDER BY {order}, which leaves {dupes} tied "
            "row(s). Add a unique column to the end of the key."
        )


def test_the_full_export_is_ordered_and_total():
    rows = load("care_gap_full.json")
    assert len(rows) == 116
    keys = [
        (not r["gap_flag"], -(r["days_overdue"] or 0), -r["age"], r["patient_id"])
        for r in rows
    ]
    assert keys == sorted(keys), "care_gap_full.json is not in its declared order"
    assert len(set(keys)) == len(keys), "care_gap_full.json order is not total"


def test_priority_is_a_stable_rank():
    """Open gaps get 1..n exactly once each, so the rank cannot be arbitrary."""
    rows = load("care_gap_full.json")
    ranks = sorted(r["priority"] for r in rows if r["priority"] is not None)
    gaps = sum(1 for r in rows if r["gap_flag"])
    assert ranks == list(range(1, gaps + 1)), (
        "priority should be a permutation of 1..open_gaps; a duplicate or a hole "
        "means the window function's ORDER BY has a tie in it"
    )


def test_patient_detail_covers_every_patient_including_the_never_tested():
    detail = load("patient_detail.json")
    cohort = load("care_gap_full.json")
    assert set(detail) == {r["patient_id"] for r in cohort}

    never = [r["patient_id"] for r in cohort if r["last_a1c_date"] is None]
    assert len(never) == 21
    for pid in never:
        assert detail[pid]["a1c"] == [], (
            "a never-tested patient must have an empty A1c series, not a missing "
            "key - the detail panel would look broken for exactly the patients "
            "the report exists to find"
        )


def test_patient_detail_series_are_ordered():
    detail = load("patient_detail.json")
    for pid, rec in detail.items():
        dates = [p["d"] for p in rec["a1c"]]
        assert dates == sorted(dates), f"{pid[:8]} A1c series is not in date order"
        meds = [(not m["insulin"], m["started"] or "", m["name"]) for m in rec["meds"]]
        assert meds == sorted(meds), f"{pid[:8]} medications are not in declared order"


def test_a1c_values_are_plausible_percentages():
    """The detail charts plot these directly, so an impossible value is visible.

    Guards the null-handling bug this view shipped with: Number(null) is 0 in
    JavaScript and 0 is finite, so the never-tested were plotted as a 0% A1c
    until the loader checked for null explicitly.
    """
    lo, hi = config.A1C_RANGE
    for pid, rec in load("patient_detail.json").items():
        for point in rec["a1c"]:
            assert lo <= point["v"] <= hi, (
                f"{pid[:8]} has an A1c of {point['v']}% on {point['d']}, outside "
                f"the plausible range {lo}-{hi}"
            )
