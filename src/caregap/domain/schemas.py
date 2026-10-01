"""What each source file must contain for the pipeline to mean anything.

Synthea is an upstream dependency that ships new versions. When a column is
renamed or dropped, the failure surfaces wherever that column is first used -
which is a binder error deep inside validate.py, naming a column the reader
never chose and giving no hint that the source changed.

These contracts move that failure to the earliest possible point, with a message
that says which file changed and which columns went missing. They are a floor,
not a schema: extra columns are fine and expected, since Synthea adds fields
without removing them. Only the absence of something we read is an error.

A contract here is the honest statement of the coupling. Every column listed is
one the pipeline actually reads somewhere; adding a column to a contract without
using it would make the check lie about what we depend on.
"""

REQUIRED = {
    # patients.Id is the spine every other table joins to. BIRTHDATE and
    # DEATHDATE drive DQ4 and the alive-on-as-of clause in D5; FIRST, LAST and
    # SSN are what DQ6 matches identities on.
    "patients": ["Id", "BIRTHDATE", "DEATHDATE", "FIRST", "LAST", "GENDER", "SSN", "ADDRESS"],

    # START and STOP carry the chronology DQ5 checks; ENCOUNTERCLASS is the
    # care-setting proxy that scopes a role's row access.
    "encounters": ["Id", "START", "STOP", "PATIENT", "ENCOUNTERCLASS", "CODE", "DESCRIPTION"],

    # CODE is the SNOMED code the cohort is defined on; STOP is what Decision D5
    # rests on being always null.
    "conditions": ["PATIENT", "ENCOUNTER", "CODE", "DESCRIPTION", "START", "STOP"],

    # The A1c lives here. ENCOUNTER, CODE and DATE together are the only key an
    # observation has - there is no row id - so quarantine and remediation both
    # address rows by that triple.
    "observations": ["DATE", "PATIENT", "ENCOUNTER", "CODE", "DESCRIPTION", "VALUE", "UNITS"],

    # CODE is the RxNorm code; START and STOP decide whether a prescription is
    # active on the as-of date.
    "medications": ["PATIENT", "ENCOUNTER", "CODE", "DESCRIPTION", "START", "STOP"],
}


class SchemaError(Exception):
    """Raised when a source file no longer carries a column the pipeline reads."""


def check(name: str, columns) -> None:
    """Assert a source has every column the pipeline reads from it.

    Raises SchemaError naming the file and the missing columns, rather than
    letting the absence surface later as a binder error on a column name the
    reader did not choose.
    """
    present = {c.upper() for c in columns}
    missing = [c for c in REQUIRED[name] if c.upper() not in present]
    if missing:
        raise SchemaError(
            f"{name}.csv is missing {len(missing)} column(s) the pipeline reads: "
            f"{', '.join(missing)}.\n"
            f"It has: {', '.join(sorted(columns))}.\n"
            "This usually means Synthea changed its export between versions. "
            "Update caregap/domain/schemas.py if the rename is intentional."
        )
