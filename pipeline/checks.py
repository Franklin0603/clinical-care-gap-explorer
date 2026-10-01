"""The six data quality checks, as definitions rather than six functions.

Why this shape
--------------
Written as functions, each check repeated the same four steps - find the bad
rows, write them somewhere with a reason, name the check, carry the raw row -
and the only thing that varied was the predicate. Four copies of the plumbing is
four places for the plumbing to drift, and the DQ matrix on the Pipeline page had
to be maintained by hand alongside them.

As data, a check states only what is true of it: which table, which rows are
wrong, why in a sentence, and what happens to them. The runner in validate.py
does the plumbing once. The matrix generates itself. Adding a seventh check is a
new entry here, not a new function plus a new row in a table plus a new line in
the report.

What a check is
---------------
    id          DQ1..DQ6, matching the defect it is meant to catch (D1..D6)
    table       the Bronze table it reads
    name        a short label for the page
    rule        the rule in one line, for a reader who does not write SQL
    cause       what produces this defect in a real system
    predicate   SQL selecting the rows that FAIL the check
    reason      a CASE expression, or a literal, giving each row its sentence
    action      QUARANTINE, REVIEW, or REMEDIATE

`reason` is SQL rather than a Python string because a single check can reject
rows for several distinct reasons - DQ2 distinguishes an observation with no
patient from one whose patient does not resolve - and the row itself decides
which sentence it gets.
"""

from config import A1C, A1C_RANGE, ASOF, GLUCOSE_RANGE, REMEDIATION_RULE, sql_list
from cohort import DIABETES_CODES

QUARANTINE, REVIEW, REMEDIATE = "QUARANTINE", "REVIEW", "REMEDIATE"

# Observations carry no row id, so they are addressed by this triple. Checked on
# Day 1: it is unique for A1c rows, which is what DQ3 relies on.
OBS_KEY = "coalesce(ENCOUNTER, '') || '|' || CODE || '|' || DATE"

LO, HI = A1C_RANGE
GLO, GHI = GLUCOSE_RANGE

CHECKS = [
    {
        "id": "DQ1",
        "table": "bronze_encounters",
        "name": "Encounter uniqueness",
        "rule": "One row per patient and encounter",
        "cause": "An interface replayed the message",
        "key": "Id",
        # Keep the earliest copy. A replayed message carries no new information,
        # and the earliest is what the care team saw first.
        "predicate": "QUALIFY row_number() OVER (PARTITION BY PATIENT, Id ORDER BY rowid) > 1",
        "reason": ("'Duplicate encounter row for the same patient and encounter id; "
                   "earliest copy kept'"),
        "action": QUARANTINE,
    },
    {
        "id": "DQ2",
        "table": "bronze_observations",
        "name": "Referential integrity",
        "rule": "Every observation points at a patient that exists",
        "cause": "A result arrived with an unresolvable patient id",
        "key": OBS_KEY,
        # An orphan result is a lab value nobody will ever see. Quarantining it
        # means somebody can go and find out whose it was.
        "predicate": ("WHERE PATIENT IS NULL "
                      "OR PATIENT NOT IN (SELECT Id FROM bronze_patients)"),
        "reason": ("CASE WHEN PATIENT IS NULL "
                   "THEN 'Observation has no patient identifier' "
                   "ELSE 'Observation patient identifier does not match any patient' END"),
        "action": QUARANTINE,
    },
    {
        "id": "DQ3",
        "table": "bronze_observations",
        "name": "A1c plausibility",
        "rule": f"A1c between {LO} and {HI} percent",
        "cause": "A glucose in mg/dL keyed into a percent field",
        "key": OBS_KEY,
        "scope": f"WHERE CODE = '{A1C}'",
        # Decision D4. A value above the range but inside the glucose band is a
        # mis-keyed mg/dL reading and is converted; anything else out of range is
        # quarantined rather than guessed at.
        "predicate": (f"WHERE TRY_CAST(VALUE AS DOUBLE) IS NULL "
                      f"OR TRY_CAST(VALUE AS DOUBLE) < {LO} "
                      f"OR (TRY_CAST(VALUE AS DOUBLE) > {HI} "
                      f"AND TRY_CAST(VALUE AS DOUBLE) NOT BETWEEN {GLO} AND {GHI})"),
        "reason": (f"CASE WHEN TRY_CAST(VALUE AS DOUBLE) IS NULL "
                   f"THEN 'A1c value is not numeric' "
                   f"WHEN TRY_CAST(VALUE AS DOUBLE) < {LO} "
                   f"THEN 'A1c below plausible floor of {LO} %' "
                   f"ELSE 'A1c above {HI} % and not in a glucose range; "
                   f"cannot infer intended value' END"),
        "action": QUARANTINE,
        "remediate": {
            "field": "VALUE",
            "predicate": (f"WHERE TRY_CAST(VALUE AS DOUBLE) > {HI} "
                          f"AND TRY_CAST(VALUE AS DOUBLE) BETWEEN {GLO} AND {GHI}"),
            # The ADA mapping between A1c and estimated average glucose, inverted.
            "corrected": "round((TRY_CAST(VALUE AS DOUBLE) + 46.7) / 28.7, 1)",
            "rule_name": REMEDIATION_RULE,
            "rule_text": (f"{REMEDIATION_RULE}: value in glucose range keyed into a "
                          f"percent field; A1c = (value + 46.7) / 28.7"),
        },
    },
    {
        "id": "DQ4",
        "table": "bronze_patients",
        "name": "Birth date sanity",
        "rule": "In the past, implied age 120 or less",
        "cause": "A registration typo in the year",
        "key": "Id",
        "predicate": (f"WHERE TRY_CAST(BIRTHDATE AS DATE) IS NULL "
                      f"OR BIRTHDATE::DATE > DATE '{ASOF}' "
                      f"OR date_diff('year', BIRTHDATE::DATE, DATE '{ASOF}') > 120"),
        "reason": (f"CASE WHEN TRY_CAST(BIRTHDATE AS DATE) IS NULL "
                   f"THEN 'Birth date is not a valid date' "
                   f"WHEN BIRTHDATE::DATE > DATE '{ASOF}' "
                   f"THEN 'Birth date is after the as-of date' "
                   f"ELSE 'Implied age exceeds 120 years' END"),
        "action": QUARANTINE,
    },
    {
        "id": "DQ5",
        "table": "bronze_encounters",
        "name": "Encounter chronology",
        "rule": "Discharge is not before admission",
        "cause": "Clock drift between two systems",
        "key": "Id",
        # An open encounter has no STOP and is valid data. `NULL < START` is
        # unknown rather than true, so it survives this predicate - but the null
        # is excluded explicitly so that is a decision, not an accident of
        # three-valued logic.
        "predicate": ("WHERE STOP IS NOT NULL AND STOP <> '' "
                      "AND TRY_CAST(STOP AS TIMESTAMP) < TRY_CAST(START AS TIMESTAMP)"),
        "reason": "'Discharge timestamp is before admission timestamp'",
        "action": QUARANTINE,
        # A row can only be rejected once; DQ1 has first claim on duplicates.
        "excludes": "DQ1",
    },
    {
        "id": "DQ6",
        "table": "bronze_patients",
        "name": "Patient identity",
        "rule": "No two patients share a name and birth date",
        "cause": "The same person registered twice",
        # Nothing is merged. Both records stay in Silver, and the pair goes to a
        # human: a wrong merge combines two people's medication lists, which is a
        # patient safety event rather than a data bug.
        "action": REVIEW,
        "pairs": """
            SELECT a.Id AS candidate_a, b.Id AS candidate_b,
                   'first_name,last_name,birth_date'
                     || CASE WHEN a.SSN = b.SSN THEN ',ssn' ELSE '' END
                     || CASE WHEN a.ADDRESS = b.ADDRESS THEN ',address' ELSE '' END AS match_fields,
                   0.70 + CASE WHEN a.SSN = b.SSN THEN 0.25 ELSE 0 END
                        + CASE WHEN a.ADDRESS = b.ADDRESS THEN 0.05 ELSE 0 END AS confidence
            FROM bronze_patients a
            JOIN bronze_patients b
              ON a.FIRST = b.FIRST AND a.LAST = b.LAST
             AND a.BIRTHDATE = b.BIRTHDATE AND a.Id < b.Id
        """,
    },
]

BY_ID = {c["id"]: c for c in CHECKS}

# Which defect each check is meant to catch. A defect found by any other check is
# a coincidence, not a working check, and the catch rate says so.
DEFECT_FOR = {c["id"]: "D" + c["id"][2] for c in CHECKS}
