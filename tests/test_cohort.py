"""The cohort matches the definition that is written down.

Decision D5 is a sentence in DATA_DICTIONARY.md and a code list in cohort.py.
These assert the built table agrees with both, because the failure a reader
would never notice is Gold being built on a definition nobody wrote down.
"""

from caregap import config
from caregap.domain.cohort import DIABETES_CODES, EXCLUDED_CODES

DX = config.sql_list(DIABETES_CODES)


def test_gold_matches_the_written_definition(con):
    """D5: any of the eight codes, on a patient alive on the as-of date."""
    from_definition = con.sql(f"""
        SELECT count(DISTINCT c.patient_id)
        FROM silver_conditions c JOIN silver_patients p USING (patient_id)
        WHERE c.snomed_code IN ({DX})
          AND (p.death_date IS NULL OR p.death_date > DATE '{config.ASOF}')
    """).fetchone()[0]
    in_gold = con.sql("SELECT count(*) FROM care_gap_a1c").fetchone()[0]
    assert in_gold == from_definition


def test_one_row_per_patient(con):
    """Gold's grain. A fan-out here makes every number on the site wrong."""
    total, distinct = con.sql(
        "SELECT count(*), count(DISTINCT patient_id) FROM care_gap_a1c"
    ).fetchone()
    assert total == distinct


def test_excluded_codes_are_actually_excluded(con):
    """Prediabetes is not diabetes, and including it would triple the denominator."""
    for code, label in EXCLUDED_CODES.items():
        leaked = con.sql(f"""
            SELECT count(*) FROM care_gap_a1c
            WHERE patient_id IN (
                SELECT patient_id FROM silver_conditions WHERE snomed_code = '{code}'
            ) AND patient_id NOT IN (
                SELECT patient_id FROM silver_conditions WHERE snomed_code IN ({DX})
            )
        """).fetchone()[0]
        assert leaked == 0, f"{leaked} patients are in Gold on {label} alone"


def test_complication_only_patients_are_included(con):
    """The finding the project turns on.

    73 patients carry a diabetic complication with no type 2 diagnosis code.
    Anchoring the cohort on 44054006 alone drops them — 45% of the cohort, and
    the sicker half. If this ever returns zero, the cohort definition regressed
    to a single code.
    """
    complication_only = con.sql(f"""
        SELECT count(DISTINCT patient_id) FROM silver_conditions
        WHERE snomed_code IN ({DX}) AND snomed_code <> '44054006'
          AND patient_id NOT IN (
              SELECT patient_id FROM silver_conditions WHERE snomed_code = '44054006'
          )
    """).fetchone()[0]
    assert complication_only > 0


def test_no_quarantined_patient_reaches_gold(con):
    """Gold is sourced from Silver only; otherwise the validation layer is decorative."""
    leaked = con.sql("""
        SELECT count(*) FROM care_gap_a1c g
        JOIN quarantine q ON q.source_row_id = g.patient_id
        WHERE q.source_table = 'bronze_patients'
    """).fetchone()[0]
    assert leaked == 0
