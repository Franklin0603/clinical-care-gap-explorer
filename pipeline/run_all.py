"""One command, Synthea to Gold (task 4.5).

    python pipeline/run_all.py              # data/raw must exist; rebuilds the warehouse from it
    python pipeline/run_all.py --generate   # also regenerates data/raw with the pinned Synthea command (~4 min, needs Java 17)
    python pipeline/run_all.py --fresh      # delete the warehouse file first (V4.10: from nothing)

Stages, in order and each re-runnable:
    load_bronze  -> corrupt -> validate -> gold -> export_web
Any stage that fails its own checks raises SystemExit and stops the run.
"""

import argparse
import os
import shutil
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone

import config
import corrupt
import export_web
import gold
import load_bronze
import manifest
import validate

SYNTHEA = [
    "java", "-jar", "synthea/synthea-with-dependencies.jar",
    "-p", "1000", "-s", "20260823", "-cs", "20260823", "-r", "20260823", "-e", "20260823",
    "--exporter.baseDirectory", "./data/raw",
    "--exporter.csv.export", "true",
    "--exporter.fhir.export", "false",
    "--exporter.hospital.fhir.export", "false",
    "--exporter.practitioner.fhir.export", "false",
    "Massachusetts",
]


TIMINGS: dict[str, float] = {}


def stage(name, fn):
    t = time.time()
    print(f"\n==== {name} {'=' * (60 - len(name))}")
    fn()
    elapsed = time.time() - t
    TIMINGS[name] = elapsed
    print(f"---- {name} done in {elapsed:.1f}s")


JAR = "synthea/synthea-with-dependencies.jar"
JAR_URL = ("https://github.com/synthetichealth/synthea/releases/download/"
           "master-branch-latest/synthea-with-dependencies.jar")


def ensure_jar():
    """The jar is ~200MB of tool, not code, so it is gitignored. Fetch it once."""
    if os.path.exists(JAR) and os.path.getsize(JAR) > 10_000_000:
        return
    if shutil.which("java") is None:
        raise SystemExit(
            "Synthea needs Java 17 and no java was found on PATH.\n"
            "Install a JDK 17 or later, then run this again."
        )
    os.makedirs("synthea", exist_ok=True)
    print(f"Downloading Synthea (~200MB, once) from\n  {JAR_URL}")
    # -L matters: without it you get a 9-byte redirect body that fails as a jar
    subprocess.run(["curl", "-L", "--fail", "-o", JAR, JAR_URL], check=True)
    print(f"  saved {os.path.getsize(JAR) / 1e6:.0f} MB to {JAR}")


def generate():
    ensure_jar()
    subprocess.run(SYNTHEA, check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--generate", action="store_true", help="regenerate data/raw with Synthea first")
    ap.add_argument("--fresh", action="store_true", help="delete the warehouse file before loading")
    args = ap.parse_args()

    t0 = time.time()
    run_id = uuid.uuid4().hex[:8]
    started = datetime.now(timezone.utc)
    if args.generate:
        stage("synthea", generate)
    if args.fresh and os.path.exists(load_bronze.DB):
        os.remove(load_bronze.DB)
        print(f"removed {load_bronze.DB}")

    if not os.path.isdir("data/raw/csv"):
        raise SystemExit(
            "There is no data to load yet — data/raw/csv is empty.\n\n"
            "Run this instead, which downloads Synthea and generates the patients:\n"
            "    python pipeline/run_all.py --generate\n\n"
            "It needs Java 17 and takes about four minutes. Every later run can drop\n"
            "the flag and rebuilds the warehouse from data/raw in about thirteen seconds."
        )

    stage("load_bronze", load_bronze.main)
    stage("corrupt", corrupt.main)
    stage("validate", validate.main)
    stage("gold", gold.main)
    stage("export_web", export_web.main)   # the site reads a build-time snapshot (D9)

    # Record what this run did. Without it a warehouse file cannot say when it
    # was built, from which commit, or whether its numbers moved.
    import duckdb

    con = duckdb.connect(str(config.DB))
    row = manifest.record(con, run_id, started, datetime.now(timezone.utc), TIMINGS)
    changes = manifest.compare(row)
    con.close()

    print(f"\n==== run {run_id} {'=' * (54 - len(run_id))}")
    print(f"  {row['git_sha']}  ·  as of {row['asof']}  ·  {row['duration_s']}s")
    print("  " + "  ".join(f"{k} {v:,}" for k, v in row["row_counts"].items()))
    if changes:
        print("  changed since the previous run:")
        for c in changes:
            print(f"    {c}")
    print(f"  -> {manifest.LOG.relative_to(config.ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
