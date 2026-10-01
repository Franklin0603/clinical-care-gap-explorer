"""The source contracts, and proof that they fire.

A check that has never been seen to fail is a check nobody knows works. These
assert both directions: the real files satisfy their contracts, and a file
missing a column is rejected with a message that names it.
"""

import csv

import pytest

from caregap import config
from caregap.domain import schemas


@pytest.mark.parametrize("name", list(schemas.REQUIRED))
def test_real_sources_satisfy_their_contract(name):
    path = config.RAW / f"{name}.csv"
    if not path.exists():
        pytest.skip(f"No {path}. Run `make generate` first.")
    with path.open() as fh:
        header = next(csv.reader(fh))
    schemas.check(name, header)  # raises SchemaError if the source drifted


def test_a_missing_column_is_rejected():
    """The failure mode this exists for: Synthea renames a column upstream."""
    columns = [c for c in schemas.REQUIRED["observations"] if c != "VALUE"]
    with pytest.raises(schemas.SchemaError) as excinfo:
        schemas.check("observations", columns)
    message = str(excinfo.value)
    assert "VALUE" in message, "the message must name the missing column"
    assert "observations.csv" in message, "and the file it belongs to"
    assert "schemas.py" in message, "and where to fix it if the rename was intentional"


def test_extra_columns_are_allowed():
    """Synthea adds fields between versions. A contract is a floor, not a schema."""
    schemas.check("conditions", schemas.REQUIRED["conditions"] + ["SOME_NEW_FIELD"])


def test_contracts_only_claim_columns_we_actually_read():
    """A contract listing an unused column would lie about the real coupling.

    Scans every module in the package rather than a hand-maintained list. An
    earlier version named the files explicitly and broke the moment DQ6's
    identity matching moved from validate.py into checks.py - the contract was
    still honest, the test had just gone stale.
    """
    sources = "\n".join(
        f.read_text() for f in sorted((config.ROOT / "src" / "caregap").rglob("*.py"))
    )
    unused = [
        (table, col)
        for table, cols in schemas.REQUIRED.items()
        for col in cols
        if col not in sources
    ]
    assert not unused, f"Contracts claim columns no stage reads: {unused}"
