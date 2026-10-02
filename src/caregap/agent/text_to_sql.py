"""Ask a question in English, get the SQL and the answer.

Prototyped and scored in `notebooks/05_text_to_sql.ipynb`. On the ten questions
the web app answers with hand-written SQL, this agrees with two exactly and
returns the same figures in a different shape on a third. Read that notebook
before trusting anything this prints.

Local on purpose. ADR-0012 keeps the shipped question page free of a model,
because the site is a static export and a key in the browser is a public key.
Nothing here changes that; this runs on a machine that already has a key in
.env.

    PYTHONPATH=src python -m caregap.agent.text_to_sql "who is on insulin and overdue?"
    PYTHONPATH=src python -m caregap.agent.text_to_sql           # a default question
"""

import sys

import anthropic
import duckdb
from dotenv import load_dotenv

from caregap.agent.guard import guard_select_only
from caregap.config import ASOF, DB, GAP_DAYS, WEB_DATA

MODEL = "claude-sonnet-5"

# The same four views the web app registers, so a query that works here works
# there unchanged. `patients` is the published export rather than the
# care_gap_a1c table, because that is what the site queries and it is the one
# carrying mrn, sex and unit.
VIEWS = {
    "patients": f"parquet_scan('{WEB_DATA / 'care_gap_full.parquet'}')",
    "quarantine": "quarantine",
    "identity_review": "identity_review",
    "remediation_log": "remediation_log",
}

# What each table is *for*, which the schema does not say. Asked which records
# are waiting on a human decision, the model queried
# patients.identity_review_pending instead of the identity_review table and
# returned zero rows - reading as "nothing to review" while six duplicate pairs
# sat unadjudicated. Describing the tables is the fix for that class of error,
# and it is why this block exists rather than just the DDL.
PURPOSE = """
patients          one row per diabetic patient alive on the as-of date; the
                  care-gap report itself. Already filtered to the cohort, so
                  never filter it again for diabetes.
quarantine        rows a data quality check rejected, with the reason and the
                  check that caught them. Use for "why is X missing".
identity_review   pairs of patient records that look like the same human,
                  waiting for somebody to decide. Use for anything about
                  duplicates or records awaiting a human decision. The flag on
                  patients only marks that a patient is in a pair; the pairs
                  themselves are here.
remediation_log   values a check corrected rather than rejected, with the
                  original and corrected value.
"""

RULES = f"""
Definitions you cannot infer from column names:

- The as-of date is frozen at {ASOF}. "Today" means that date. Never use
  current_date; the data stops there.
- gap_flag is true when a patient has had no A1c result in the {GAP_DAYS} days
  before the as-of date. A patient never tested at all also has gap_flag true,
  with last_a1c_date IS NULL.
- days_overdue and next_due_date are null unless gap_flag is true.
- last_a1c_controlled is true when the most recent A1c was below 7 percent.
- priority ranks only patients with an open gap, 1 being most urgent.
- When grouping by age, use the bands this project reports on: 18-44, 45-64,
  65-75, 76+. Those are the HEDIS measure's boundaries, not round decades.

Rules:
- Answer with one SELECT statement and nothing else. No prose, no markdown
  fences, no trailing semicolon.
- A single statement, read-only. Never write, delete, alter, attach or copy.
- Prefer a few named columns over SELECT *.
"""


def looks_empty(df) -> bool:
    """No rows, or a single row that is all zero and null.

    Checking only for no rows misses the case this most needs to catch. A
    question answered with COUNT(*) returns one row containing 0, which is a
    perfectly good "none" and also exactly what a query against the wrong table
    produces. Both deserve a second look, and the aggregate form is the one
    somebody is most likely to read as a fact.
    """
    if len(df) == 0:
        return True
    if len(df) != 1:
        return False
    return all(v is None or v == 0 or (isinstance(v, float) and v != v)
               for v in df.iloc[0].tolist())


def connect():
    """Read-only. The model is about to write SQL that gets executed."""
    con = duckdb.connect(str(DB), read_only=True)
    for view, source in VIEWS.items():
        if view != source:      # a view onto a table of its own name recurses
            con.execute(f"CREATE OR REPLACE TEMP VIEW {view} AS SELECT * FROM {source}")
    return con


def schema_of(con) -> str:
    """CREATE TABLE lines: the densest honest description of a schema there is."""
    blocks = []
    for view in VIEWS:
        cols = con.execute(f"DESCRIBE {view}").fetchall()
        fields = ",\n  ".join(f"{row[0]} {row[1]}" for row in cols)
        blocks.append(f"CREATE TABLE {view} (\n  {fields}\n);")
    return "\n\n".join(blocks)


def system_prompt(con) -> str:
    return (f"You write DuckDB SQL against a small clinical warehouse.\n\n"
            f"{schema_of(con)}\n\nWhat each table is for:\n{PURPOSE}\n{RULES}")


def write_sql(client, con, question: str) -> str:
    resp = client.messages.create(
        model=MODEL,
        max_tokens=600,
        system=system_prompt(con),
        messages=[{"role": "user", "content": question}],
    )
    # Not content[0]: a model that thinks puts a ThinkingBlock there, and that
    # block has no .text at all.
    return "".join(b.text for b in resp.content if b.type == "text").strip()


def answer(question: str) -> int:
    load_dotenv()
    client = anthropic.Anthropic()
    con = connect()
    try:
        sql = write_sql(client, con, question)
        checked = guard_select_only(sql)

        print(f"\n{question}\n")
        print(checked.sql if checked.ok else sql)

        if not checked.ok:
            print(f"\n  refused: {checked.reason}")
            return 1

        df = con.execute(checked.sql).fetchdf()
        print()
        print(df.head(25).to_string(index=False) if len(df) else "  (no rows)")

        if looks_empty(df):
            # A nothing-answer is right about as often as it is a query that went
            # to the wrong table, and the two are indistinguishable from the
            # output. Flagging it is the difference between a wrong answer and a
            # checked one.
            print("\n  Nothing came back. On this data that is as likely to be a "
                  "query against the wrong table as a true none, so read the SQL "
                  "above before repeating the number.")
        return 0
    finally:
        con.close()


def main():
    question = " ".join(sys.argv[1:]) or "How many patients have an open A1c gap?"
    raise SystemExit(answer(question))


if __name__ == "__main__":
    main()
