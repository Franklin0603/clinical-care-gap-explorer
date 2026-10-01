"""A record of what each pipeline run did.

Without this, a warehouse file answers none of the questions you ask of one in
practice: when was it built, from which commit, how long did each stage take,
and did the numbers move. Those are the questions behind "is this stale?" and
"did my change break something?", and stdout scrollback does not answer them.

Each run appends a row to `pipeline_runs` in the warehouse and rewrites
`data/run_log.json` for anything outside DuckDB to read. The table is the
history; the JSON is the latest run plus the few previous, so a diff between two
runs is readable without opening a database.

Deliberately not captured: wall-clock timings are recorded but not asserted on.
They vary with the machine, and a test that fails because a laptop was busy is a
test people learn to ignore.
"""

import json
import platform
import subprocess
import sys
from datetime import datetime, timezone

from caregap import config

TABLE = "pipeline_runs"
LOG = config.ROOT / "data" / "run_log.json"
KEEP = 10  # runs retained in the JSON; the table keeps everything


def git_sha() -> str:
    """The commit the code was at. 'unknown' outside a checkout, never an error."""
    try:
        sha = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=config.ROOT, capture_output=True, text=True, timeout=5,
        )
        dirty = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=config.ROOT, capture_output=True, text=True, timeout=5,
        )
        if sha.returncode != 0:
            return "unknown"
        return sha.stdout.strip() + ("-dirty" if dirty.stdout.strip() else "")
    except Exception:
        return "unknown"


def ensure_table(con):
    con.sql(f"""
        CREATE TABLE IF NOT EXISTS {TABLE} (
            run_id        VARCHAR,
            started_at    TIMESTAMP,
            finished_at   TIMESTAMP,
            duration_s    DOUBLE,
            git_sha       VARCHAR,
            asof_date     VARCHAR,   -- 'asof' alone is reserved: DuckDB has ASOF JOIN
            python        VARCHAR,
            stages        JSON,    -- name -> seconds
            row_counts    JSON,    -- layer -> rows
            metrics       JSON     -- cohort, gaps, catch rate, quarantined
        )
    """)


def collect(con) -> dict:
    """The numbers worth comparing between two runs."""
    bronze = silver = 0
    for t in config.SOURCES:
        bronze += con.sql(f"SELECT count(*) FROM bronze_{t}").fetchone()[0]
        silver += con.sql(f"SELECT count(*) FROM silver_{t}").fetchone()[0]
    quarantined = con.sql("SELECT count(*) FROM quarantine").fetchone()[0]
    cohort, gaps, never = con.sql("""
        SELECT count(*), count(*) FILTER (WHERE gap_flag),
               count(*) FILTER (WHERE last_a1c_date IS NULL)
        FROM care_gap_a1c
    """).fetchone()
    return {
        "row_counts": {"bronze": bronze, "silver": silver, "quarantined": quarantined,
                       "remediated": con.sql("SELECT count(*) FROM remediation_log").fetchone()[0],
                       "gold": cohort},
        "metrics": {"cohort": cohort, "open_gaps": gaps, "never_tested": never,
                    "identity_review_pending": con.sql(
                        "SELECT count(*) FROM identity_review WHERE status = 'pending'").fetchone()[0]},
    }


def record(con, run_id: str, started, finished, stages: dict) -> dict:
    """Append this run to the table and rewrite the JSON log."""
    ensure_table(con)
    collected = collect(con)
    row = {
        "run_id": run_id,
        "started_at": started.isoformat(timespec="seconds"),
        "finished_at": finished.isoformat(timespec="seconds"),
        "duration_s": round((finished - started).total_seconds(), 1),
        "git_sha": git_sha(),
        "asof_date": config.ASOF,
        "python": f"{sys.version_info.major}.{sys.version_info.minor} on {platform.system()}",
        "stages": {k: round(v, 1) for k, v in stages.items()},
        **collected,
    }
    con.execute(
        f"INSERT INTO {TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [row["run_id"], row["started_at"], row["finished_at"], row["duration_s"],
         row["git_sha"], row["asof_date"], row["python"],
         json.dumps(row["stages"]), json.dumps(row["row_counts"]), json.dumps(row["metrics"])],
    )
    history = []
    if LOG.exists():
        try:
            history = json.loads(LOG.read_text()).get("runs", [])
        except json.JSONDecodeError:
            history = []  # a corrupt log should not stop a run
    LOG.write_text(json.dumps({"runs": [row] + history[: KEEP - 1]}, indent=1) + "\n")
    return row


def compare(row: dict) -> list[str]:
    """What moved since the previous run. Empty when nothing did, or on a first run."""
    if not LOG.exists():
        return []
    try:
        runs = json.loads(LOG.read_text()).get("runs", [])
    except json.JSONDecodeError:
        return []
    previous = next((r for r in runs if r["run_id"] != row["run_id"]), None)
    if not previous:
        return []
    changes = []
    for group in ("row_counts", "metrics"):
        for key, now in row[group].items():
            before = previous[group].get(key)
            if before is not None and before != now:
                changes.append(f"{key}: {before:,} -> {now:,} ({now - before:+,})")
    return changes
