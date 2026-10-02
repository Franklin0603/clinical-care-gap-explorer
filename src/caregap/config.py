"""Every path, date, code and threshold the pipeline uses — defined once.

Before this file existed these constants were scattered across the stage
modules, which produced two problems a reader would trip over:

  * `gold.py` imported ASOF from `validate.py`. A configuration value living
    inside a processing stage meant you could not build Gold without importing
    the validation module, and the dependency pointed backwards.
  * The LOINC code for A1c appeared as `A1C` in two modules and `A1C_LOINC` in a
    third. Three names, one value, and nothing keeping them in step.

Paths are absolute, derived from this file's location, so every stage runs from
any working directory. They were relative once, and the pipeline only worked
when invoked from the repository root.
"""

from pathlib import Path

# ----------------------------------------------------------------- locations
ROOT = Path(__file__).resolve().parents[2]   # src/caregap/config.py -> repo root

RAW = ROOT / "data" / "raw" / "csv"
WAREHOUSE = ROOT / "data" / "warehouse"
DB = WAREHOUSE / "clinical.duckdb"
WEB_DATA = ROOT / "web" / "public" / "data"

DEFECT_LOG = ROOT / "data" / "injected_defects.json"
DQ_REPORT = ROOT / "data" / "dq_report.json"
GOLD_REPORT = ROOT / "data" / "gold_report.json"

# The six Synthea exports loaded into Bronze, Decision D15. The other twelve are
# billing ledgers or clinical data with no bearing on an A1c gap.
#
# procedures joined later, for the patient detail view: it answers "what has
# actually been done for this person", which is the question a clinician asks
# next after seeing a gap. It is not an orders table and must never be described
# as one, since Synthea records only completed procedures.
SOURCES = ["patients", "encounters", "conditions", "observations", "medications",
           "procedures"]

# ---------------------------------------------------------------------- time
# Decision D7. The simulated data ends on this date; a wall-clock "today" would
# push more patients past the twelve-month line every day the site is read, so
# the report would describe the calendar rather than the data.
ASOF = "2026-08-23"

# Decision D6. A gap opens at 366 days: exactly 365 is not yet a gap.
GAP_DAYS = 365

# --------------------------------------------------------------------- codes
# LOINC. A1c defines the care gap; glucose is context only — Decision D13.
A1C = "4548-4"
GLUCOSE = ("2339-0", "2345-7")

# Decision D4 / DQ3. The floor was revised from the spec's 3.0 after profiling
# found 951 clean results below it — an 11% false-positive rate on untouched
# data, which would have made the catch rate meaningless.
A1C_RANGE = (2.0, 20.0)

# A value above A1C_RANGE but inside this band is read as a mg/dL glucose keyed
# into a percent field, and converted with the ADA eAG mapping.
GLUCOSE_RANGE = (40.0, 600.0)
REMEDIATION_RULE = "A1C_MGDL_TO_PCT_EAG"

# RxNorm: Humulin 70/30, and regular human insulin.
INSULIN = ("106892", "311034")

# ------------------------------------------------------------------- corrupt
# Recorded in the defect log. Sampling itself is hash-based rather than seeded,
# so the same rows are chosen regardless of row order.
SEED = 20260823

# Decision D3 — rows damaged per defect class. None exceeds 1% of its table.
DEFECT_VOLUME = {"D1": 40, "D2": 150, "D3": 20, "D4": 8, "D5": 25, "D6": 6}


def sql_list(values) -> str:
    """Render a Python iterable as a SQL IN-list: ('a', 'b') -> "'a', 'b'".

    Three modules built this string with the same join expression; it lives here
    now so the quoting is defined in one place.
    """
    return ", ".join(f"'{v}'" for v in values)
