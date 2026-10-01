"""The run manifest.

What this guards is the ability to answer, about any warehouse file: when was it
built, from which commit, and did its numbers move. The drift comparison is the
part worth testing — a comparison that never reports anything looks identical to
one that is broken.
"""

import json

import pytest

from caregap import config
from caregap import manifest


@pytest.fixture
def log():
    if not manifest.LOG.exists():
        pytest.skip(f"No {manifest.LOG}. Run `make run` first.")
    return json.loads(manifest.LOG.read_text())


def test_the_latest_run_is_fully_described(log):
    run = log["runs"][0]
    for field in ("run_id", "started_at", "finished_at", "duration_s",
                  "git_sha", "asof_date", "stages", "row_counts", "metrics"):
        assert field in run, f"the manifest cannot answer a question without {field}"
    assert run["git_sha"] != "", "a run with no commit cannot be traced back to code"
    assert run["asof_date"] == config.ASOF


def test_every_stage_was_timed(log):
    """A stage missing from the timings is one that silently did not run."""
    expected = {"ingest", "corrupt", "validate", "gold", "publish"}
    assert expected <= set(log["runs"][0]["stages"])


def test_the_recorded_counts_reconcile(log):
    """The manifest must agree with the guarantee the pipeline asserts."""
    counts = log["runs"][0]["row_counts"]
    assert counts["bronze"] == counts["silver"] + counts["quarantined"], (
        "The manifest recorded counts that do not balance, which means it was "
        "written at a moment the warehouse was inconsistent."
    )


def test_history_is_capped(log):
    assert len(log["runs"]) <= manifest.KEEP


def test_compare_is_silent_when_nothing_moved(tmp_path, monkeypatch):
    """Two runs with the same numbers must report nothing.

    Built from a controlled log rather than the real one: whether the last two
    real runs happened to match is a fact about somebody's shell history, not
    about this code, and a test that depends on it fails for the wrong reason.
    """
    run = {"run_id": "b", "row_counts": {"bronze": 10, "silver": 10},
           "metrics": {"cohort": 5, "open_gaps": 2}}
    earlier = {**run, "run_id": "a"}
    log_file = tmp_path / "run_log.json"
    log_file.write_text(json.dumps({"runs": [run, earlier]}))
    monkeypatch.setattr(manifest, "LOG", log_file)
    assert manifest.compare(run) == []


def test_compare_is_silent_on_a_first_run(tmp_path, monkeypatch):
    """Nothing to compare against is not drift."""
    run = {"run_id": "only", "row_counts": {"bronze": 1}, "metrics": {"cohort": 1}}
    log_file = tmp_path / "run_log.json"
    log_file.write_text(json.dumps({"runs": [run]}))
    monkeypatch.setattr(manifest, "LOG", log_file)
    assert manifest.compare(run) == []


def test_compare_reports_a_number_that_moved(tmp_path, monkeypatch):
    """The case the comparison exists for: a decision changed and the result did.

    Setting GAP_DAYS to 180 and re-running really does produce this, but as a
    test it is a controlled log - the point being asserted is that drift is
    reported with its direction and size, not that the pipeline is slow.
    """
    earlier = {"run_id": "a", "row_counts": {"bronze": 10}, "metrics": {"open_gaps": 25}}
    later = {"run_id": "b", "row_counts": {"bronze": 10}, "metrics": {"open_gaps": 50}}
    log_file = tmp_path / "run_log.json"
    log_file.write_text(json.dumps({"runs": [later, earlier]}))
    monkeypatch.setattr(manifest, "LOG", log_file)
    changes = manifest.compare(later)
    assert changes == ["open_gaps: 25 -> 50 (+25)"], changes


def test_a_corrupt_log_does_not_stop_a_run(tmp_path, monkeypatch):
    """A broken artifact should degrade to 'no comparison', never raise."""
    broken = tmp_path / "run_log.json"
    broken.write_text("{not json")
    monkeypatch.setattr(manifest, "LOG", broken)
    assert manifest.compare({"run_id": "x", "row_counts": {}, "metrics": {}}) == []
