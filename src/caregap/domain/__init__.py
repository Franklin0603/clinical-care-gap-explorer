"""What the pipeline believes, stated as data rather than code.

These modules contain no plumbing. Each is a declaration a reviewer can read
without following any SQL:

    cohort    the eight diabetes SNOMED codes, and the two deliberately excluded
    checks    the six data quality checks, their rules and their causes
    access    which clinical role may see which columns and which rows
    schemas   what each Synthea source file must contain
"""
