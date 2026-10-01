"""Clinical Care Gap Explorer — the pipeline behind the care-gap report.

Five stages run in order, each re-runnable:

    ingest    raw Synthea CSVs into Bronze, every column text
    corrupt   inject 249 known defects and log exactly what was damaged
    validate  six checks into Silver, rejects quarantined with a reason
    gold      care_gap_a1c, one row per diabetic patient
    publish   the snapshot the web app reads

`caregap run` drives all five. See caregap.cli.
"""

__version__ = "1.0.0"
