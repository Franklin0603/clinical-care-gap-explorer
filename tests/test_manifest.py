"""The run manifest.

What this guards is the ability to answer, about any warehouse file: when was it
built, from which commit, and did its numbers move. The drift comparison is the
part worth testing — a comparison that never reports anything looks identical to
one that is broken.
"""

import json

import pytest

import config
import manifest


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
    expected = {"load_bronze", "corrupt", "validate", "gold", "export_web"}
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


def test_compare_is_silent_when_nothing_moved(log):
    """Re-comparing the latest run against itself must report no drift."""
    assert manifest.compare(log["runs"][0]) == []


def test_compare_reports_a_number_that_moved(log):
    """The case the comparison exists for: a decision changed and the result did.

    Built from the real latest run with one metric altered, rather than by
    running the pipeline twice, so the test stays fast and deterministic.
    """
    moved = json.loads(json.dumps(log["runs"][0]))
    moved["run_id"] = "synthetic"
    moved["metrics"]["open_gaps"] += 25
    changes = manifest.compare(moved)
    assert any("open_gaps" in c for c in changes), f"drift went unreported: {changes}"
    assert "+25" in " ".join(changes), "the report should say which way and by how much"


def test_a_corrupt_log_does_not_stop_a_run(tmp_path, monkeypatch):
    """A broken artifact should degrade to 'no comparison', never raise."""
    broken = tmp_path / "run_log.json"
    broken.write_text("{not json")
    monkeypatch.setattr(manifest, "LOG", broken)
    assert manifest.compare({"run_id": "x", "row_counts": {}, "metrics": {}}) == []
