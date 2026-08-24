"""Profile the raw Synthea CSVs before anything is loaded (tasks 1.8 - 1.11).

Read-only. Answers the four questions Day 1 says you must be able to state out
loud, and prints nothing else. Run from the repo root:

    python pipeline/profile.py
"""

import glob
import os

import duckdb

RAW = "data/raw/csv"


def header(title):
    print(f"\n{title}\n{'-' * len(title)}")


def q(con, sql):
    """Run a query and print it without a pandas round trip."""
    con.sql(sql).show(max_rows=40)


def row_counts(con):
    """1.8 - how many rows in each CSV."""
    header("1.8  Row counts per file")
    for path in sorted(glob.glob(f"{RAW}/*.csv")):
        n = con.sql(f"SELECT count(*) FROM read_csv_auto('{path}')").fetchone()[0]
        print(f"  {os.path.basename(path):24} {n:>10,}")


def diabetes_codes(con):
    """1.9 - which diabetes SNOMED codes appear, and how many patients each.

    No LIMIT: the point is the whole distribution. The tail is where the
    complication codes live, and those are most of the cohort.
    """
    header("1.9  Diabetes-ish codes in conditions")
    q(con, """
        SELECT CODE, DESCRIPTION,
               count(*)                AS n_rows,
               count(DISTINCT PATIENT) AS patients
        FROM conditions
        WHERE lower(DESCRIPTION) LIKE '%diabet%'
        GROUP BY CODE, DESCRIPTION
        ORDER BY patients DESC
    """)
    print("  NOTE: '%diabet%' also matches Prediabetes, which is not diabetes.")
    print("  Discovery only - the cohort itself is the code list in cohort.py.")


def a1c_profile(con):
    """1.10 - the A1c code, its unit string, and its distribution.

    DQ3's plausible range is stated in percent. If Synthea reported mmol/mol
    the range would be wrong by an order of magnitude, so check the units
    before writing the check, not after.
    """
    header("1.10  A1c and glucose observations")
    q(con, """
        SELECT CODE, DESCRIPTION, UNITS,
               count(*)                                  AS n,
               min(try_cast(VALUE AS DOUBLE))            AS lo,
               round(median(try_cast(VALUE AS DOUBLE)),2) AS med,
               max(try_cast(VALUE AS DOUBLE))            AS hi
        FROM observations
        WHERE lower(DESCRIPTION) LIKE '%a1c%'
           OR lower(DESCRIPTION) LIKE '%glucose%'
        GROUP BY CODE, DESCRIPTION, UNITS
        ORDER BY n DESC
    """)

    header("1.10b  A1c (4548-4) against DQ3's 3.0 - 20.0 percent range")
    q(con, """
        SELECT count(*)                                                  AS total,
               count(*) FILTER (WHERE try_cast(VALUE AS DOUBLE) < 3.0)   AS below_3,
               count(*) FILTER (WHERE try_cast(VALUE AS DOUBLE) > 20.0)  AS above_20,
               round(quantile_cont(try_cast(VALUE AS DOUBLE), 0.01), 2)  AS p01,
               round(quantile_cont(try_cast(VALUE AS DOUBLE), 0.99), 2)  AS p99
        FROM observations
        WHERE CODE = '4548-4'
    """)


def resolved_fraction(con):
    """1.11 - what fraction of diabetes condition rows have a stop date.

    This decides Decision D5: whether the cohort needs 'active as of' logic
    at all, or whether a diagnosis is simply permanent once recorded.
    """
    header("1.11  Diabetes conditions with a STOP (resolved) date")
    q(con, """
        SELECT count(*)                                       AS n_rows,
               count(STOP)                                    AS with_stop,
               round(100.0 * count(STOP) / count(*), 1)       AS pct_resolved
        FROM conditions
        WHERE lower(DESCRIPTION) LIKE '%diabet%'
    """)


def main():
    con = duckdb.connect()
    con.sql(f"CREATE VIEW conditions   AS SELECT * FROM read_csv_auto('{RAW}/conditions.csv')")
    con.sql(f"CREATE VIEW observations AS SELECT * FROM read_csv_auto('{RAW}/observations.csv')")

    # row_counts(con)
    # diabetes_codes(con)
    # a1c_profile(con)
    resolved_fraction(con)


if __name__ == "__main__":
    main()
