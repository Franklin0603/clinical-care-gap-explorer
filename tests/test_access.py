"""Role scoping, asserted against the payloads the site actually ships.

The check that matters is V6.1: a PCT's file must not contain a restricted
field. Not blanked, not hidden in CSS — absent. These read the exported JSON
rather than the role matrix, so they test what a reviewer would find in the
network tab rather than what the configuration intends.
"""

import json

import pytest

from caregap import config
from caregap.domain.access import ROLES, restricted_for


def payload(role):
    path = config.WEB_DATA / f"care_gap_{role}.json"
    if not path.exists():
        pytest.skip(f"No export at {path}. Run `python caregap/stages/publish.py`.")
    return json.loads(path.read_text())


@pytest.mark.parametrize("role", list(ROLES))
def test_payload_contains_only_permitted_columns(role):
    rows = payload(role)
    assert rows, f"{role} payload is empty"
    present = set(rows[0])
    assert present == set(ROLES[role]["columns"]), (
        f"{role} payload columns differ from the matrix: "
        f"unexpected {present - set(ROLES[role]['columns'])}, "
        f"missing {set(ROLES[role]['columns']) - present}"
    )


@pytest.mark.parametrize("role", list(ROLES))
def test_restricted_fields_are_absent_not_blank(role):
    """Blanking a field still ships its name and its row count. Absence does not."""
    raw = (config.WEB_DATA / f"care_gap_{role}.json").read_text()
    for field in restricted_for(role):
        assert f'"{field}"' not in raw, (
            f"{role} payload mentions the restricted field {field!r}. "
            "Restricted columns must never be selected, not selected and emptied."
        )


def test_row_counts_differ_by_role():
    """Column filtering alone is the shortcut. FR4 requires row scoping too."""
    counts = {role: len(payload(role)) for role in ROLES}
    assert len(set(counts.values())) == len(counts), (
        f"Roles see the same number of patients ({counts}), so only columns are "
        "being filtered. A PCT should see one unit, not the whole panel."
    )
    assert counts["pct"] < counts["nurse"] < counts["physician"]


def test_a1c_derived_columns_travel_together():
    """next_due_date reconstructs last_a1c_date exactly: +365 days.

    Restricting the value while shipping any column derived from the date leaks
    the date. This asserts the grouping holds for every role.
    """
    derived = {"last_a1c_date", "last_a1c_value", "days_since_a1c",
               "next_due_date", "days_overdue", "a1c_count_2y",
               "last_a1c_controlled", "priority"}
    for role, cfg in ROLES.items():
        visible = derived & set(cfg["columns"])
        assert visible in (set(), derived), (
            f"{role} sees {visible} but not {derived - visible}. These are all "
            "functions of the same date and must be restricted as a group."
        )
