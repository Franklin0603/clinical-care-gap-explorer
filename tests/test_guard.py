"""The SELECT-only guard, Python side.

There are two guards: `guardSelectOnly` in `web/lib/sql.ts` for SQL a reader
types, and `caregap.agent.guard` for SQL a model writes. One runs in a browser
and one in Python, so they cannot be a single implementation.

What keeps them from drifting is this: the cases below are the same statements
`web/lib/sql.test.ts` probes, in the same order, and the two files must agree
about every one. If you add a case to either, add it to the other.

The obvious cases are DROP and DELETE; any check catches those. The ones worth a
test are the ones that defeat a naive check:

  - a blocklist on "DROP" rejects `WHERE mrn LIKE '%drop%'`, which is harmless
  - a check reading only the first statement passes `SELECT 1; DROP TABLE x`
  - `WITH x AS (SELECT 1) DELETE FROM patients` begins with WITH, contains
    SELECT, and deletes rows

That last one defeated the first version of the web guard and was found by
writing the test, not by reading the code.
"""

import pytest

from caregap.agent.guard import guard_select_only, main_verb, strip_fences

ALLOW = [
    ("SELECT * FROM patients", "a plain select"),
    ("  select 1  ", "lowercase and padded"),
    ("SELECT * FROM patients;", "a trailing semicolon is not a second statement"),
    ("WITH x AS (SELECT 1) SELECT * FROM x", "a CTE"),
    ("WITH a AS (SELECT 1), b AS (SELECT 2) SELECT * FROM a, b", "several CTEs"),
    ("SELECT * FROM patients WHERE mrn LIKE '%drop%'", "a scary word inside a string"),
    ("SELECT * FROM patients WHERE sex = 'a;b'", "a semicolon inside a string"),
]

REFUSE = [
    ("DROP TABLE patients", "drop"),
    ("DELETE FROM care_gap_a1c", "delete"),
    ("UPDATE patients SET age = 0", "update"),
    ("INSERT INTO patients VALUES (1)", "insert"),
    ("ATTACH 'other.db'", "attach"),
    ("COPY patients TO 'out.csv'", "copy"),
    ("SELECT 1; DROP TABLE patients", "a stacked statement"),
    ("SELECT 1 --; x\n; DROP TABLE patients", "a separator behind a line comment"),
    ("SELECT 1 /* ; */ ; DROP TABLE patients", "a separator in a block comment"),
    ("WITH x AS (SELECT 1) DELETE FROM patients", "a CTE whose statement is a DELETE"),
    ("WITH x AS (SELECT 1) UPDATE patients SET age = 0", "a CTE whose statement is an UPDATE"),
    ("", "nothing at all"),
]


@pytest.mark.parametrize("sql,why", ALLOW, ids=[w for _, w in ALLOW])
def test_allows(sql, why):
    assert guard_select_only(sql).ok, f"should have allowed: {sql!r}"


@pytest.mark.parametrize("sql,why", REFUSE, ids=[w for _, w in REFUSE])
def test_refuses(sql, why):
    result = guard_select_only(sql)
    assert not result.ok, f"should have refused: {sql!r}"
    # A refusal a reader cannot act on is barely better than a crash.
    assert len(result.reason) > 20, "a refusal must explain itself in a sentence"
    assert not any(w in result.reason for w in ("Error", "Exception", "None")), \
        "no exception text in a refusal"


def test_the_two_guards_probe_the_same_statements():
    """The corpus above is the contract with web/lib/sql.test.ts.

    Checked rather than asserted in a comment, because a comment saying two
    files agree is the kind of claim that stops being true quietly.
    """
    from pathlib import Path
    import re

    from caregap.config import ROOT

    ts = (ROOT / "web" / "lib" / "sql.test.ts").read_text()
    # The TS arrays hold ["<sql>", "<why>"] pairs; pull the SQL out of each.
    quoted = re.findall(r'^\s*\["((?:[^"\\]|\\.)*)",', ts, re.M)
    in_ts = {s.replace('\\n', '\n').replace('\\"', '"') for s in quoted}
    here = {sql for sql, _ in ALLOW + REFUSE}

    missing_here = in_ts - here
    missing_there = here - in_ts
    assert not missing_here, f"web tests probe statements this file does not: {missing_here}"
    assert not missing_there, f"this file probes statements the web tests do not: {missing_there}"


def test_markdown_fences_come_off():
    """Models wrap SQL in markdown even when the prompt says not to."""
    assert strip_fences("```sql\nSELECT 1\n```") == "SELECT 1"
    assert strip_fences("```\nSELECT 1\n```") == "SELECT 1"
    assert guard_select_only("```sql\nSELECT 1\n```").ok


def test_main_verb_walks_past_the_cte_list():
    assert main_verb("SELECT 1") == "SELECT"
    assert main_verb("WITH x AS (SELECT 1) SELECT 2") == "SELECT"
    assert main_verb("WITH x AS (SELECT 1) DELETE FROM t") == "DELETE"
    assert main_verb("WITH a AS (SELECT 1), b AS (SELECT 2) UPDATE t SET x = 1") == "UPDATE"


def test_a_refusal_never_returns_sql():
    """Belt and braces: the caller must not be able to run a refused statement."""
    for sql, _ in REFUSE:
        assert guard_select_only(sql).sql == ""


# Python-side only: the web guard sees text a human typed, where prose is caught
# by the intent matcher before it ever reaches the guard. Here prose arrives
# directly, because a model asked to do something destructive refuses in English.
PROSE = [
    "I can't do that — I can only provide a read-only SELECT statement.",
    "Sure! Here's what I'd suggest: first, consider whether you need this.",
    "The answer is 25 patients.",
]


@pytest.mark.parametrize("text", PROSE)
def test_prose_is_refused_as_prose(text):
    result = guard_select_only(text)
    assert not result.ok
    assert "not SQL" in result.reason, result.reason
    # The old message took the first word and said "it is a I", which is true
    # and tells the reader nothing about what went wrong.
    assert " is a I" not in result.reason


# ---------------------------------------------------------------- empty results

def test_looks_empty_catches_the_aggregate_zero():
    """A COUNT returning 0 is one row, not none, which is the case that matters.

    The first version only checked for zero rows, so the warning never fired for
    `SELECT count(*) ... -> 0`, which is both a perfectly good "none" and exactly
    what a query against the wrong table produces.
    """
    import pandas as pd

    from caregap.agent.text_to_sql import looks_empty

    assert looks_empty(pd.DataFrame({"n": []}))              # no rows
    assert looks_empty(pd.DataFrame({"count_star()": [0]}))  # the aggregate zero
    assert looks_empty(pd.DataFrame({"a": [0], "b": [None]}))
    assert not looks_empty(pd.DataFrame({"count_star()": [25]}))
    assert not looks_empty(pd.DataFrame({"a": [0], "b": [3]}))
    assert not looks_empty(pd.DataFrame({"n": [0, 0]}))      # two rows is an answer
