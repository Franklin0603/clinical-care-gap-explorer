"""Role-based access: the matrix, as data (Day 6).

This models the HIPAA **minimum necessary standard** - a workforce member sees
only what their job requires. It is NOT HIPAA compliance, and nothing in this
repo may say that it is: compliance covers BAAs, audit infrastructure, breach
procedures, training, physical safeguards and a real covered entity. A portfolio
app has none of those.

There is no authentication. The role selector is a demonstration control.

HOW THE FILTERING WORKS, AND WHAT THAT IS WORTH
-----------------------------------------------
Decision D9 made the site a static export, so there is no server to filter at
request time. Instead export_web.py writes one payload per role, each built by a
query that never SELECTs the restricted columns and never returns the restricted
rows. The file a PCT's page loads does not contain an A1c value anywhere - the
fields are absent, not blanked, not hidden in CSS.

What this does not do: the other roles' files are still reachable by URL. With no
authentication that is unavoidable and is stated on the page. The point being
demonstrated is that restriction happens in the query layer, not the component.

THE LEAK THAT COLUMN FILTERING ALONE MISSES
--------------------------------------------
`next_due_date` is `last_a1c_date + 365 days`; `days_overdue` and
`days_since_a1c` are the same date in different clothes. Restrict the A1c value
but keep any of those and the test date is reconstructable exactly. Derived
columns inherit the sensitivity of what they were derived from, so they are
restricted together. `priority` is likewise excluded from the PCT view: it ranks
on days overdue and last value.
"""

# Columns every role may see. Identity and scheduling, nothing clinical.
BASE_COLUMNS = ["patient_id", "mrn", "age", "sex", "unit", "last_encounter_date", "gap_flag"]

# A1c-derived columns. Any one of these reconstructs the test date, so they
# travel as a group - see the module docstring.
A1C_COLUMNS = [
    "last_a1c_date", "last_a1c_value", "days_since_a1c", "next_due_date",
    "days_overdue", "a1c_count_2y", "last_a1c_controlled", "priority",
]

MEDICATION_COLUMNS = ["active_med_count", "on_insulin"]
HISTORY_COLUMNS = ["first_dx_date", "identity_review_pending"]

# "Unit" is the care setting of the patient's most recent encounter. Synthea has
# no unit assignment, so this is a documented proxy, not a real rostering.
ROLES = {
    "pct": {
        "label": "Patient Care Technician",
        "columns": BASE_COLUMNS,
        "units": ["ambulatory"],
        "scope": "One assigned unit",
        "rationale": (
            "Sees who needs a lab draw and when they were last in, and nothing about "
            "the result. On the floor a PCT is told which patients need a task done, "
            "not what the number was."
        ),
    },
    "nurse": {
        "label": "Nurse",
        "columns": BASE_COLUMNS + A1C_COLUMNS + MEDICATION_COLUMNS,
        "units": ["ambulatory", "wellness", "outpatient"],
        "scope": "Their service line",
        "rationale": (
            "Adds lab results and active medications, because a nurse acts on the "
            "value - an A1c of 9.5 fourteen months ago is a different call from a 5.8. "
            "Not full diagnosis history."
        ),
    },
    "physician": {
        "label": "Physician",
        "columns": BASE_COLUMNS + A1C_COLUMNS + MEDICATION_COLUMNS + HISTORY_COLUMNS,
        "units": None,  # cross-unit: the whole panel
        "scope": "Cross-unit, whole panel",
        "rationale": (
            "The fullest view: diagnosis history, every patient regardless of unit, and "
            "the identity-review flag, because deciding whether two records are one "
            "person is a clinical judgement."
        ),
    },
}

DEFAULT_ROLE = "pct"  # Decision D10: the most restricted view first, so the
                      # first thing a viewer sees is a restriction.


def columns_for(role):
    return ROLES[role]["columns"]


def restricted_for(role):
    """Columns this role cannot see - shown as labelled placeholders, not dropped."""
    everything = ROLES["physician"]["columns"]
    allowed = set(columns_for(role))
    return [c for c in everything if c not in allowed]
