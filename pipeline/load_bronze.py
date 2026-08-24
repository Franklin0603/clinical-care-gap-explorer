"""Load the raw Synthea CSVs into DuckDB as the Bronze layer (task 1.12).

Bronze is a photocopy. Everything arrives as text, nothing is cast, deduped,
filtered or renamed - the only additions are the two lineage columns. Typing and
validation happen in Silver on Day 3, where a value that will not cast lands in
`quarantine` with a reason instead of vanishing.

Safe to re-run: every table is CREATE OR REPLACE.

    IMPORTANT - run order from Day 2 onward. Re-running this script after
    corrupt.py rebuilds Bronze from the clean CSVs, which wipes the injected
    defects. That is correct behaviour, but a Day 3 catch rate of zero is
    exactly what it looks like when you forget.

Run from the repo root:

    python pipeline/load_bronze.py
"""

import os

import duckdb

RAW = "data/raw/csv"
DB = "data/warehouse/clinical.duckdb"

# Five of the eighteen CSVs - Decision D15. The rest are billing ledgers or
# clinical data with no bearing on an A1c gap; claims_transactions.csv alone is
# over a million rows. Listed explicitly rather than globbed, so that adding a
# table stays a decision.
SOURCES = [
    "patients",
    "encounters",
    "conditions",
    "observations",
    "medications",
]

LINEAGE = ("_loaded_at", "_source_file")


def header(title):
    print(f"\n{title}\n{'-' * len(title)}")


def csv_row_count(path):
    """Count data rows in a file, without going through DuckDB.

    V1.5 compares Bronze against the CSV. Counting with read_csv_auto would ask
    the loader to check its own work, so count the newlines directly.
    """
    newlines = 0
    last = b"\n"
    with open(path, "rb") as fh:
        while chunk := fh.read(1 << 20):
            newlines += chunk.count(b"\n")
            last = chunk[-1:]
    if last != b"\n":  # final row with no trailing newline
        newlines += 1
    return newlines - 1  # drop the header


def load(con, name):
    """Load one CSV into bronze_<name>, as text, with lineage attached."""
    path = f"{RAW}/{name}.csv"
    con.sql(f"""
        CREATE OR REPLACE TABLE bronze_{name} AS
        SELECT *,
               current_timestamp AS _loaded_at,
               '{name}.csv'      AS _source_file
        FROM read_csv_auto('{path}', all_varchar = true)
    """)


def verify(con):
    """V1.5 faithful copy, V1.6 lineage populated, V1.7 untyped.

    Printed as a table on every run - a mismatch you have to notice is a
    mismatch you will miss.
    """
    header("Bronze")
    print(f"  {'table':22} {'rows':>10} {'csv':>10}  {'lineage':>7}  {'text':>5}")

    ok = True
    for name in SOURCES:
        table = f"bronze_{name}"
        rows = con.sql(f"SELECT count(*) FROM {table}").fetchone()[0]
        expected = csv_row_count(f"{RAW}/{name}.csv")

        # V1.6 - both lineage columns populated on every row
        missing = con.sql(f"""
            SELECT count(*) FROM {table}
            WHERE _loaded_at IS NULL OR _source_file IS NULL
        """).fetchone()[0]

        # V1.7 - every *source* column is still text. The two lineage columns
        # are ours, and _loaded_at is deliberately a timestamp.
        typed = con.sql(f"""
            SELECT count(*) FROM (DESCRIBE {table})
            WHERE column_type <> 'VARCHAR' AND column_name NOT IN {LINEAGE}
        """).fetchone()[0]

        good = rows == expected and missing == 0 and typed == 0
        ok = ok and good
        flag = "" if good else "   <-- CHECK"
        print(
            f"  {table:22} {rows:>10,} {expected:>10,}"
            f"  {'ok' if missing == 0 else 'NULL':>7}"
            f"  {'ok' if typed == 0 else 'TYPED':>5}{flag}"
        )

    print()
    print("  V1.5 rows match CSV   V1.6 lineage populated   V1.7 source columns text")
    return ok


def main():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    con = duckdb.connect(DB)

    for name in SOURCES:
        load(con, name)

    ok = verify(con)
    con.close()

    print(f"\n  {DB}")
    if not ok:
        raise SystemExit("Bronze load failed its checks - see the rows marked CHECK above.")


if __name__ == "__main__":
    main()
