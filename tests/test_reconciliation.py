"""The guarantee the whole data quality layer rests on.

`bronze = silver + quarantine`, on every table, every run. The pipeline asserts
this itself and stops when it fails; this test is the same assertion from
outside, so a change that breaks it fails CI rather than only failing a run
somebody happened to be watching.

A row can leave the pipeline in exactly two ways: it reaches Silver, or it lands
in quarantine with a reason attached. Any third way is a silent drop, which is
the failure this project exists to prevent.
"""

import pytest
import config


@pytest.mark.parametrize("table", config.SOURCES)
def test_no_rows_vanish(con, table):
    bronze = con.sql(f"SELECT count(*) FROM bronze_{table}").fetchone()[0]
    silver = con.sql(f"SELECT count(*) FROM silver_{table}").fetchone()[0]
    quarantined = con.sql(
        f"SELECT count(*) FROM quarantine WHERE source_table = 'bronze_{table}'"
    ).fetchone()[0]
    assert bronze == silver + quarantined, (
        f"{table}: {bronze} bronze != {silver} silver + {quarantined} quarantined. "
        f"The difference of {bronze - silver - quarantined} rows left the pipeline "
        "without a reason being recorded."
    )


def test_silver_never_exceeds_bronze(con):
    """A join that fans out invents rows. The duplicate patient makes this likely."""
    for table in config.SOURCES:
        bronze = con.sql(f"SELECT count(*) FROM bronze_{table}").fetchone()[0]
        silver = con.sql(f"SELECT count(*) FROM silver_{table}").fetchone()[0]
        assert silver <= bronze, f"{table}: Silver has {silver - bronze} more rows than Bronze"


def test_every_quarantined_row_has_a_reason(con):
    """A quarantine table with null reasons cannot answer "why is this patient missing"."""
    unlabelled = con.sql(
        "SELECT count(*) FROM quarantine WHERE failure_reason IS NULL OR check_id IS NULL"
    ).fetchone()[0]
    assert unlabelled == 0


def test_reasons_are_sentences_not_stack_traces(con):
    """These go on screen. An exception string there undoes the argument."""
    reasons = [r[0] for r in con.sql("SELECT DISTINCT failure_reason FROM quarantine").fetchall()]
    assert reasons, "No quarantined rows at all — has corrupt.py run?"
    for reason in reasons:
        assert not any(
            fragment in reason
            for fragment in ("Traceback", "Error:", "Exception", "ValueError", "    at ")
        ), f"Reason reads like an exception: {reason!r}"
        assert reason[0].isupper(), f"Reason is not a sentence: {reason!r}"
