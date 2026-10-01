"""Catch rate, scored against ground truth rather than asserted.

corrupt.py damages 249 rows in six ways and logs exactly what it damaged. These
tests read that log back and check each entry was caught — and caught by the
check that was supposed to catch it. A defect found by the wrong check is a
coincidence, not a working check, and would otherwise inflate the number.
"""

from caregap import config

DESTINATIONS = """
    SELECT source_row_id AS key, check_id AS caught_by FROM quarantine
    UNION ALL SELECT source_row_id, 'DQ3' FROM remediation_log
    UNION ALL SELECT candidate_a_mrn, 'DQ6' FROM identity_review
    UNION ALL SELECT candidate_b_mrn, 'DQ6' FROM identity_review
"""


def _key(entry):
    """Observations have no row id, so they are keyed on ENCOUNTER|CODE|DATE."""
    if entry["defect"] in ("D2", "D3"):
        return "|".join(str(v) for v in entry["key"].values())
    return entry["key"]["Id"]


def test_every_defect_type_was_injected(defects):
    assert set(defects["volume"]) == {"D1", "D2", "D3", "D4", "D5", "D6"}
    assert defects["total"] == sum(defects["volume"].values()) == 249


def test_every_injected_row_was_caught_by_its_own_check(con, defects):
    found = {k: c for k, c in con.sql(DESTINATIONS).fetchall()}
    missed, wrong_check = [], []
    for entry in defects["entries"]:
        expected = "DQ" + entry["defect"][1]
        caught_by = found.get(_key(entry))
        if caught_by is None:
            missed.append((entry["defect"], _key(entry)))
        elif caught_by != expected:
            wrong_check.append((entry["defect"], expected, caught_by))
    assert not missed, f"{len(missed)} injected rows were never caught: {missed[:3]}"
    assert not wrong_check, (
        f"{len(wrong_check)} rows were caught by the wrong check, which is a "
        f"coincidence rather than a working check: {wrong_check[:3]}"
    )


def test_dq3_floor_does_not_fire_on_clean_data(con):
    """The spec proposed a floor of 3.0, which flagged 951 untouched results.

    A check that fires on clean input makes the catch rate meaningless, so the
    floor was revised to 2.0. This guards the revision: nothing below the floor
    should be a value the generator legitimately produced.
    """
    lo, _ = config.A1C_RANGE
    below = con.sql(
        f"SELECT count(*) FROM silver_observations "
        f"WHERE loinc_code = '{config.A1C}' AND value < {lo}"
    ).fetchone()[0]
    assert below == 0, (
        f"{below} A1c results in Silver sit below the plausibility floor of {lo}. "
        "Either the floor is wrong again or they should have been quarantined."
    )
