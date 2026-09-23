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
import subprocess
import sys
import time

import corrupt
import export_web
import gold
import load_bronze
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


def stage(name, fn):
    t = time.time()
    print(f"\n==== {name} {'=' * (60 - len(name))}")
    fn()
    print(f"---- {name} done in {time.time() - t:.1f}s")


def generate():
    subprocess.run(SYNTHEA, check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--generate", action="store_true", help="regenerate data/raw with Synthea first")
    ap.add_argument("--fresh", action="store_true", help="delete the warehouse file before loading")
    args = ap.parse_args()

    t0 = time.time()
    if args.generate:
        stage("synthea", generate)
    if args.fresh and os.path.exists(load_bronze.DB):
        os.remove(load_bronze.DB)
        print(f"removed {load_bronze.DB}")

    stage("load_bronze", load_bronze.main)
    stage("corrupt", corrupt.main)
    stage("validate", validate.main)
    stage("gold", gold.main)
    stage("export_web", export_web.main)   # the site reads a build-time snapshot (D9)
    print(f"\nSynthea-to-Gold complete in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    sys.exit(main())
