"""The check definitions.

Turning six functions into six definitions moves a class of mistake from "the
code is wrong" to "the data is wrong", and data is easier to assert on. These
check the definitions are internally consistent and that each one still catches
the defect it is paired with.
"""

import pytest

from checks import BY_ID, CHECKS, DEFECT_FOR, QUARANTINE, REMEDIATE, REVIEW


def test_there_are_six_checks_and_the_ids_are_unique():
    """The catch rate is out of six. A seventh needs the README and the matrix too."""
    assert len(CHECKS) == 6
    assert len(BY_ID) == 6


@pytest.mark.parametrize("check", CHECKS, ids=lambda c: c["id"])
def test_every_check_states_what_a_reader_needs(check):
    for field in ("id", "table", "name", "rule", "cause", "action"):
        assert check.get(field), f"{check['id']} is missing {field}"
    assert check["action"] in (QUARANTINE, REVIEW, REMEDIATE)
    assert check["table"].startswith("bronze_"), "checks read Bronze, not Silver"


@pytest.mark.parametrize("check", CHECKS, ids=lambda c: c["id"])
def test_the_rule_and_cause_read_as_prose(check):
    """Both go on screen. A reader who does not write SQL has to follow them."""
    assert check["rule"][0].isupper() and len(check["rule"]) > 15
    assert check["cause"][0].isupper() and len(check["cause"]) > 15
    assert "SELECT" not in check["rule"].upper(), "the rule is prose, not SQL"


@pytest.mark.parametrize("check", CHECKS, ids=lambda c: c["id"])
def test_each_check_is_paired_with_exactly_one_defect(check):
    """DQ3 catches D3. A defect caught by another check is a coincidence."""
    assert DEFECT_FOR[check["id"]] == "D" + check["id"][2]


@pytest.mark.parametrize("check", [c for c in CHECKS if c["action"] == QUARANTINE],
                         ids=lambda c: c["id"])
def test_quarantining_checks_can_identify_and_explain_a_row(check):
    assert check.get("key"), f"{check['id']} cannot address the row it rejects"
    assert check.get("predicate"), f"{check['id']} does not say which rows fail"
    assert check.get("reason"), f"{check['id']} rejects rows without a reason"


def test_only_dq3_remediates_and_it_keeps_the_original():
    """Principle 3: corrections are recorded, not overwritten."""
    remediating = [c for c in CHECKS if "remediate" in c]
    assert [c["id"] for c in remediating] == ["DQ3"]
    rem = BY_ID["DQ3"]["remediate"]
    for field in ("field", "predicate", "corrected", "rule_name", "rule_text"):
        assert rem.get(field), f"remediation is missing {field}"
    assert "46.7" in rem["rule_text"], "the rule text should state the conversion"


def test_dq6_reviews_rather_than_merges():
    """Principle 2: identity is never auto-resolved."""
    dq6 = BY_ID["DQ6"]
    assert dq6["action"] == REVIEW
    assert "predicate" not in dq6, "a review check rejects nothing"
    assert "confidence" in dq6["pairs"], "a human needs a score to triage on"


def test_dq5_defers_to_dq1_on_duplicate_rows():
    """A row is rejected once, or the reconciliation double-counts it."""
    assert BY_ID["DQ5"]["excludes"] == "DQ1"


def test_the_shipped_matrix_matches_the_definitions(con):
    """The Pipeline page renders from the report; the report is generated here."""
    import json
    import config

    if not config.DQ_REPORT.exists():
        pytest.skip("No dq_report.json. Run `make run` first.")
    shipped = {c["id"]: c for c in json.loads(config.DQ_REPORT.read_text())["checks"]}
    assert set(shipped) == set(BY_ID)
    for cid, check in BY_ID.items():
        assert shipped[cid]["rule"] == check["rule"]
        assert shipped[cid]["catches"] == DEFECT_FOR[cid]
