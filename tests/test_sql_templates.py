"""The SQL templates and their loader.

Moving a query into a file trades one failure mode for another: a typo in a
placeholder name no longer shows up as a Python NameError, it shows up as
DuckDB parsing the literal text `{asof}`. The loader exists to close that gap,
and these assert it does.
"""

import re

import pytest

from caregap import sql


def all_templates():
    return sorted(p.relative_to(sql.SQL_DIR).as_posix() for p in sql.SQL_DIR.rglob("*.sql"))


def test_the_templates_are_where_the_loader_looks():
    found = all_templates()
    assert found, "no .sql files found"
    assert "gold/care_gap_a1c.sql" in found
    assert "silver/build.sql" in found
    assert "bronze/load.sql" in found


@pytest.mark.parametrize("name", all_templates())
def test_every_template_explains_itself(name):
    """These are read by someone deciding whether to trust a number."""
    text = (sql.SQL_DIR / name).read_text()
    comments = [l for l in text.splitlines() if l.strip().startswith("--")]
    assert len(comments) >= 3, f"{name} has {len(comments)} comment lines"


def test_a_missing_parameter_is_refused_by_name():
    """Without this the template reaches DuckDB with a literal {path} in it."""
    with pytest.raises(sql.TemplateError) as e:
        sql.load("bronze/load.sql", table="patients")
    assert "path" in str(e.value)


def test_an_unused_parameter_is_refused():
    """A caller passing something the template ignores is out of date with it."""
    with pytest.raises(sql.TemplateError) as e:
        sql.load("bronze/load.sql", table="p", path="x.csv", asof="2026-08-23")
    assert "asof" in str(e.value)


def test_a_missing_template_names_the_path():
    with pytest.raises(sql.TemplateError) as e:
        sql.load("gold/not_a_file.sql")
    assert "not_a_file.sql" in str(e.value)


def test_filling_a_template_leaves_no_placeholders():
    filled = sql.load("bronze/load.sql", table="patients", path="/tmp/p.csv")
    assert not re.search(r"\{\w+\}", filled), "an unfilled placeholder survived"
    assert "bronze_patients" in filled and "/tmp/p.csv" in filled


def test_the_bronze_load_keeps_every_column_as_text():
    """all_varchar is the whole point of that statement - see the file's comment."""
    assert "all_varchar = true" in sql.load("bronze/load.sql", table="p", path="x")


def test_gold_joins_left_not_inner():
    """The bug this project is most careful about, asserted on the SQL itself.

    tests/test_gold.py asserts the never-tested patients survive in the built
    table. This asserts the reason they do, so a change to the join reads as a
    deliberate edit rather than an accident.
    """
    text = (sql.SQL_DIR / "gold/care_gap_a1c.sql").read_text()
    joins = re.findall(r"^\s*(LEFT JOIN|JOIN|INNER JOIN)\s+(\w+)", text, re.M)
    to_latest = [kind for kind, table in joins if table == "latest_a1c"]
    assert to_latest == ["LEFT JOIN"], (
        f"the join from cohort to latest_a1c is {to_latest}, not LEFT JOIN. "
        "An inner join silently drops every never-tested patient."
    )
