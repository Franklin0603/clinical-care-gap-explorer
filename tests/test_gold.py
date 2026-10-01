"""Properties of care_gap_a1c that the report depends on.

The first of these is the one that matters. A diabetic with no A1c on record is
the highest-risk person on a care-gap list, and an inner join from the cohort to
observations deletes exactly those people without erroring. This test is the
guard against that regression.
"""

import config


def test_never_tested_patients_survive_and_are_flagged(con):
    """The inner-join bug, as a test.

    With a LEFT JOIN the table holds 116 patients including 21 never tested.
    With an INNER JOIN it holds 95 and none of them, the query runs in
    milliseconds, and the numbers look plausible. That is why this is asserted
    rather than remembered.
    """
    never_tested, all_flagged = con.sql("""
        SELECT count(*), coalesce(bool_and(gap_flag), false)
        FROM care_gap_a1c WHERE last_a1c_date IS NULL
    """).fetchone()
    assert never_tested > 0, (
        "No never-tested patients in Gold. The usual cause is an INNER JOIN from "
        "the cohort to observations, which silently drops them."
    )
    assert all_flagged, "A patient with no A1c on record is a gap by definition."


def test_days_since_a1c_is_null_safe(con):
    """No date means no day count. Null arithmetic yields null, and null is not true."""
    bad = con.sql(f"""
        SELECT count(*) FROM care_gap_a1c
        WHERE (last_a1c_date IS NULL AND days_since_a1c IS NOT NULL)
           OR days_since_a1c < 0
           OR days_since_a1c > 40000
    """).fetchone()[0]
    assert bad == 0


def test_gap_flag_matches_its_definition(con):
    """D6: a gap opens past 365 days. Exactly 365 is not yet a gap."""
    inconsistent = con.sql(f"""
        SELECT count(*) FROM care_gap_a1c
        WHERE gap_flag <> (last_a1c_date IS NULL OR days_since_a1c > {config.GAP_DAYS})
    """).fetchone()[0]
    assert inconsistent == 0


def test_derived_a1c_columns_agree_with_their_source(con):
    """next_due_date and days_overdue are both functions of last_a1c_date.

    They are restricted together for that reason (see access.py); here the point
    is that they stay consistent, so the two can never tell a reader different
    stories about the same patient.
    """
    inconsistent = con.sql(f"""
        SELECT count(*) FROM care_gap_a1c
        WHERE (next_due_date IS NULL) <> (last_a1c_date IS NULL)
           OR (days_overdue IS NOT NULL) <> (gap_flag AND last_a1c_date IS NOT NULL)
    """).fetchone()[0]
    assert inconsistent == 0


def test_ages_are_plausible(con):
    """DQ4 quarantines future birth dates; a negative age here means Gold read Bronze."""
    lo, hi = con.sql("SELECT min(age), max(age) FROM care_gap_a1c").fetchone()
    assert 0 <= lo and hi <= 120


def test_gap_rate_is_neither_zero_nor_everyone(con):
    """0% means the logic never fires; 100% means the A1c join is failing."""
    rate = con.sql("SELECT avg(gap_flag::INT) FROM care_gap_a1c").fetchone()[0]
    assert 0.01 < rate < 0.99
