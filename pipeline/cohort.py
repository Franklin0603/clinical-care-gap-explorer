"""The diabetes cohort, as an explicit code list.

Substring matching on DESCRIPTION is how you *discover* codes (profile.py).
It is not how you define a cohort - '%diabet%' also matches Prediabetes, and
display strings are free text that can change between source systems. Join on
codes, per DATA_DICTIONARY.md.

Run from the repo root:

    python pipeline/cohort.py
"""

import duckdb

RAW = "data/raw/csv"

# SNOMED CT. Confirmed present in this Synthea extract - see profile.py 1.9.
#
# A patient qualifies on ANY of these. Anchoring on 44054006 alone is wrong:
# in this extract 73 of the 128 patients carrying a diabetic complication have
# no type-2 diagnosis code on file, and they are the sickest of the cohort.
# Real claims data behaves the same way, which is why HEDIS value sets are
# lists rather than single codes.
DIABETES_CODES = {
    44054006:        "Diabetes mellitus type 2",
    127013003:       "Disorder of kidney due to diabetes mellitus",
    90781000119102:  "Microalbuminuria due to type 2 diabetes mellitus",
    157141000119108: "Proteinuria due to type 2 diabetes mellitus",
    368581000119106: "Neuropathy due to type 2 diabetes mellitus",
    1551000119108:   "Nonproliferative diabetic retinopathy due to type II diabetes mellitus",
    97331000119101:  "Macular edema and retinopathy due to type 2 diabetes mellitus",
    1501000119109:   "Proliferative diabetic retinopathy due to type II diabetes mellitus",
}

# Deliberately OUT of the cohort. Recorded here so the exclusion is a decision
# with a reason attached, not an oversight:
#
#   714628002  Prediabetes - not diabetes. Does not qualify for the HbA1c
#              control measure. 439 patients in this extract, so including it
#              would roughly triple the denominator.
#   80394007   Hyperglycemia - a finding, not a diagnosis. Can occur without
#              diabetes (stress, steroids, acute illness).
#
# No type 1 diabetes code appears in this extract. If the generator or state
# changes, re-run profile.py before trusting this list.
EXCLUDED_CODES = {
    714628002: "Prediabetes (finding)",
    80394007:  "Hyperglycemia (disorder)",
}

# Synthea never sets STOP on a diabetes condition row (profile.py 1.11 shows
# 0.0% resolved), so a diagnosis is permanent once recorded and the cohort
# needs no 'active as of' filter. Revisit if that fraction ever moves - this
# is Decision D5.
DIABETES_IS_PERMANENT = True

A1C_LOINC = "4548-4"  # Hemoglobin A1c/Hemoglobin.total in Blood, reported in %


def _code_list(codes):
    return ", ".join(str(c) for c in codes)


def build(con):
    """Create a `cohort` view: one row per qualifying patient."""
    con.sql(f"""
        CREATE OR REPLACE VIEW cohort AS
        SELECT PATIENT      AS patient_id,
               min(START)   AS first_dx_date,
               count(*)     AS n_dx_rows,
               list(DISTINCT CODE) AS codes
        FROM read_csv_auto('{RAW}/conditions.csv')
        WHERE CODE IN ({_code_list(DIABETES_CODES)})
        GROUP BY PATIENT
    """)
    return con


def main():
    con = build(duckdb.connect())

    n = con.sql("SELECT count(*) FROM cohort").fetchone()[0]
    print(f"Diabetes cohort: {n:,} patients")
    print(f"  qualifying codes: {len(DIABETES_CODES)}")
    print(f"  excluded codes:   {len(EXCLUDED_CODES)} ({', '.join(EXCLUDED_CODES.values())})")

    print("\nPatients contributed per code (patients may match several):")
    con.sql(f"""
        SELECT CODE, DESCRIPTION, count(DISTINCT PATIENT) AS patients
        FROM read_csv_auto('{RAW}/conditions.csv')
        WHERE CODE IN ({_code_list(DIABETES_CODES)})
        GROUP BY CODE, DESCRIPTION
        ORDER BY patients DESC
    """).show(max_rows=40)

    print("Anchor-code-only would have missed:")
    con.sql(f"""
        SELECT count(DISTINCT PATIENT) AS patients_without_a_t2dm_code
        FROM read_csv_auto('{RAW}/conditions.csv')
        WHERE CODE IN ({_code_list(DIABETES_CODES)})
          AND CODE <> 44054006
          AND PATIENT NOT IN (
              SELECT PATIENT FROM read_csv_auto('{RAW}/conditions.csv')
              WHERE CODE = 44054006
          )
    """).show()


if __name__ == "__main__":
    main()
