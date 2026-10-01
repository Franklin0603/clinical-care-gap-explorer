"""Shared fixtures.

Most tests here are integration tests: they assert against the warehouse the
pipeline builds rather than against mocks, because the things worth guarding in
this project are properties of the data (the reconciliation balances, the cohort
matches its written definition, every injected defect was caught by the check
meant for it) and a mock would assert nothing about those.

That means the warehouse has to exist. If it does not, the tests skip with a
message telling you what to run rather than failing with a confusing error.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline"))

import config  # noqa: E402

BUILD_HINT = "Run `python pipeline/run_all.py --generate` first to build the warehouse."


@pytest.fixture(scope="session")
def con():
    """A read-only connection to the warehouse, shared across the session."""
    import duckdb

    if not config.DB.exists():
        pytest.skip(f"No warehouse at {config.DB}. {BUILD_HINT}")
    connection = duckdb.connect(str(config.DB), read_only=True)
    yield connection
    connection.close()


@pytest.fixture(scope="session")
def defects():
    """The ground truth: every row corrupt.py damaged, and how."""
    import json

    if not config.DEFECT_LOG.exists():
        pytest.skip(f"No defect log at {config.DEFECT_LOG}. {BUILD_HINT}")
    return json.loads(config.DEFECT_LOG.read_text())
