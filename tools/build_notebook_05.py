"""Write notebooks/05_text_to_sql.ipynb.

The notebook is the artefact; this just assembles it, so the cells can be
written as readable Python strings instead of hand-edited JSON. Run it once,
then execute the notebook to attach the outputs.

    python tools/build_notebook_05.py
    .venv/bin/jupyter nbconvert --execute --inplace --to notebook \
        --ExecutePreprocessor.kernel_name=clinicalgap notebooks/05_text_to_sql.ipynb
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "notebooks" / "05_text_to_sql.ipynb"


def lines(text):
    """nbformat wants each source line to keep its newline; split() drops them,
    which glues the whole cell onto one line and makes it a SyntaxError."""
    return text.splitlines(keepends=True)


def md(text):
    return {"cell_type": "markdown", "metadata": {}, "source": lines(text.strip())}


def code(text):
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": lines(text.strip("\n")),
    }


CELLS = [
    md("""
# 05 · Text to SQL, scored

**The question this notebook exists to answer: would a model write better SQL
than the ten hand-written queries the question page ships?**

[ADR-0012](../docs/decisions/0012-no-language-model.md) said no model. The
reasoning was about deployment, not capability: the site is a static export, so
a key in the browser is a public key. That argument still holds for the deployed
page. It says nothing about whether the model could do the job, and until now
nobody had checked.

This is where that gets checked, and it is cheap to check properly because the
project already has the hard part. `web/lib/chips.ts` carries ten questions with
hand-written SQL that is known to be right. That is an evaluation set. So the
measurement here is the same shape as the catch rate in `02_validate.ipynb`:
score the thing against ground truth rather than reading its output and feeling
impressed.

**The test:** give Claude the schema and a question, take the SQL it writes, run
it, and compare the *answer* to what the hand-written query returns.

Not compare the SQL. There are many correct ways to write any of these, and
string-matching would score formatting rather than correctness.
"""),
    code("""
import sys
sys.path.insert(0, "../src")

import json, re, textwrap
from pathlib import Path

import anthropic
import duckdb
import pandas as pd
from dotenv import load_dotenv

from caregap.config import DB

pd.set_option("display.width", 200)
pd.set_option("display.max_colwidth", 70)

load_dotenv(Path("..") / ".env")
client = anthropic.Anthropic()
MODEL = "claude-sonnet-5"

# Read-only. The model is about to write SQL that gets executed against this
# connection; it is not getting a writable one.
con = duckdb.connect(str(DB), read_only=True)
print(DB.name, "·", con.execute("SELECT count(*) FROM care_gap_a1c").fetchone()[0], "patients")
"""),
    md("""
## 1 · What the model is allowed to see

A model cannot guess that `gap_flag` means "no A1c in 365 days as of a frozen
date", and if it has to guess it will quietly invent something plausible. So the
prompt carries the schema and the few definitions that are not inferable from
column names.

The view names match what the web app registers, so SQL that works here works
there without translation.
"""),
    code('''
# Exactly what web/lib/sql.ts registers, so a query that works here works there.
# The first version pointed `patients` at the care_gap_a1c table instead, which
# is the same rows without mrn, sex and unit - so four of the ten preset queries
# failed to run at all and the model got the blame for it.
PARQUET = Path("../web/public/data")
VIEWS = {
    "patients": f"parquet_scan('{PARQUET}/care_gap_full.parquet')",
    "quarantine": "quarantine",
    "identity_review": "identity_review",
    "remediation_log": "remediation_log",
}

for view, source in VIEWS.items():
    if view != source:          # a view onto a table of the same name binds to itself
        con.execute(f"CREATE OR REPLACE TEMP VIEW {view} AS SELECT * FROM {source}")

print(len(con.execute("DESCRIBE patients").fetchall()), "columns on patients")

def schema_text():
    """The CREATE TABLE lines, which is the densest honest description there is."""
    out = []
    for view in VIEWS:
        cols = con.execute(f"DESCRIBE {view}").fetchall()
        fields = ",\\n  ".join(f"{c[0]} {c[1]}" for c in cols)
        out.append(f"CREATE TABLE {view} (\\n  {fields}\\n);")
    return "\\n\\n".join(out)

SCHEMA = schema_text()
print(SCHEMA[:600], "...")
'''),
    code('''
# The handful of facts the column names do not carry. Each one is a definition
# somebody had to decide, and each has an ADR behind it.
NOTES = """
Definitions this data uses, which you cannot infer from the column names:

- The as-of date is frozen at 2026-08-23. "Today" means that date. Never use
  current_date; the data stops there and a wall-clock today would make the
  answer drift every day the report is read.
- gap_flag is true when a patient has had no A1c result in the 365 days before
  the as-of date. A patient never tested at all also has gap_flag true, and has
  last_a1c_date IS NULL.
- days_overdue and next_due_date are null unless gap_flag is true.
- last_a1c_controlled is true when the most recent A1c was below 7 percent.
- priority ranks only the patients with an open gap, 1 being most urgent. It is
  null for everyone else.
- patients is already restricted to the diabetic cohort alive on the as-of date.
  Do not filter it further for diabetes.
- When grouping by age, use the HEDIS bands this project reports on: 18-44,
  45-64, 65-75, 76+. They are the measure's boundaries, not round decades.
"""

SYSTEM = f"""You write DuckDB SQL against a small clinical warehouse.

{SCHEMA}

{NOTES}

Rules:
- Answer with one SELECT statement and nothing else. No prose, no markdown
  fences, no trailing semicolon.
- A single statement only. Never more than one.
- Read-only. Never write, delete, alter, attach or copy.
- Prefer returning a few named columns over SELECT *.
"""

print(SYSTEM[-700:])
'''),
    md("""
## 2 · The guard

The model's SQL is about to be executed. Everything the question page argues
about untrusted SQL applies here with more force, because here the statement was
written by something trying to be helpful rather than by somebody who knows what
the tables are.

This mirrors `guardSelectOnly` in `web/lib/sql.ts`, including the part that
matters: a statement beginning with `WITH` can still be a `DELETE`, so the CTE
list is walked past before deciding what the statement actually does. That bug
was found by a test, not by reading the code.

> Prototyped here, then extracted to `caregap.agent.guard` once it worked, with
> `tests/test_guard.py` probing the same statements as `web/lib/sql.test.ts` so
> the two implementations cannot drift. The version below is the working one and
> is left as the record; the module is what the agent imports. Running it here
> also turned up a case the web guard never sees: a model refusing in prose,
> where taking the first word produces a refusal reading "it is a I".
"""),
    code('''
def main_verb(sql: str):
    """The operation a statement performs, looking past any CTE list."""
    first = re.match(r"\\s*([a-z]+)", sql, re.I)
    if not first:
        return None
    if first.group(1).upper() != "WITH":
        return first.group(1).upper()

    i, depth = first.end(), 0
    while i < len(sql):
        ch = sql[i]
        if ch == "'":
            i += 1
            while i < len(sql) and sql[i] != "'":
                i += 1
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                rest = sql[i + 1:].lstrip()
                if rest.startswith(","):
                    i = len(sql) - len(rest) + 1
                    continue
                m = re.match(r"([a-z]+)", rest, re.I)
                return m.group(1).upper() if m else None
        i += 1
    return None


def guard(raw: str):
    """(ok, sql_or_reason). One SELECT, nothing stacked behind it."""
    sql = raw.strip()
    sql = re.sub(r"^```(?:sql)?|```$", "", sql, flags=re.M).strip()   # models fence things
    bare = re.sub(r"/\\*.*?\\*/", " ", sql, flags=re.S)
    bare = re.sub(r"--[^\\n]*", " ", bare).strip().rstrip(";")
    masked = re.sub(r"'(?:[^']|'')*'", "''", bare)

    if ";" in masked:
        return False, "more than one statement"
    verb = main_verb(masked)
    if verb != "SELECT":
        return False, f"not a SELECT, it is a {verb or 'statement of another kind'}"
    return True, bare


# The case that matters, and the one a naive check lets through.
for probe in [
    "SELECT count(*) FROM patients",
    "SELECT 1; DROP TABLE patients",
    "WITH x AS (SELECT 1) DELETE FROM patients",
    "```sql\\nSELECT 1\\n```",
]:
    ok, out = guard(probe)
    print(f"  {'pass' if ok else 'STOP'}  {probe[:46]:48} -> {out[:40]}")
'''),
    md("""
## 3 · The evaluation set

Ten questions, each with SQL a human wrote and checked. Read straight out of the
web app so the two cannot drift: if somebody edits a preset query, this notebook
starts scoring against the edited one.
"""),
    code('''
chips_src = Path("../web/lib/chips.ts").read_text()
CHIPS = [
    {"q": q, "sql": " ".join(sql.split())}
    for q, sql in re.findall(r'\\{\\s*q:\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*,\\s*sql:\\s*`([^`]*)`',
                             chips_src, re.S)
]
print(f"{len(CHIPS)} questions with known-good SQL\\n")
for c in CHIPS:
    print(" ·", c["q"])
'''),
    md("""
## 4 · Ask the model

One call per question. No examples in the prompt, no retries: the point is to
see what it does unaided, because a number produced after three attempts and a
hint is not the number anyone should plan around.
"""),
    code('''
def ask(question: str) -> str:
    resp = client.messages.create(
        model=MODEL,
        max_tokens=600,
        system=SYSTEM,
        messages=[{"role": "user", "content": question}],
    )
    # Not content[0]: a thinking model puts a ThinkingBlock there.
    return "".join(b.text for b in resp.content if b.type == "text").strip()


generated = []
for c in CHIPS:
    sql = ask(c["q"])
    ok, checked = guard(sql)
    generated.append({**c, "model_sql": sql, "guard_ok": ok, "guard": checked})
    print(f"  {'ok  ' if ok else 'STOP'} {c['q'][:52]:54} {len(sql):>4} chars")
'''),
    md("""
## 5 · Score it on the answer, not the text

Two queries are equivalent here if they return the same values. Column *names*
are allowed to differ — a model calling it `total` instead of `patients` is a
labelling choice, not a wrong answer — so the comparison is on the sorted values,
with floats rounded, because `21.6` and `21.60000000000001` are the same number.
"""),
    code('''
def result_of(sql: str):
    df = con.execute(sql).fetchdf()
    # Compare values, not labels: sort columns by position, rows by content.
    vals = df.map(lambda v: round(v, 4) if isinstance(v, float) else v)
    rows = [tuple(str(x) for x in r) for r in vals.itertuples(index=False)]
    return sorted(rows), list(df.columns), df


rows = []
for g in generated:
    status, detail, truth_df, model_df = "", "", None, None
    if not g["guard_ok"]:
        status, detail = "refused", g["guard"]
    else:
        try:
            truth, _, truth_df = result_of(g["sql"])
        except Exception as e:                      # the preset is wrong, not the model
            status, detail = "preset broke", str(e).splitlines()[0][:60]
            truth = None
        if truth is not None:
            try:
                got, _, model_df = result_of(g["guard"])
                if got == truth:
                    status = "match"
                else:
                    # Several presets return more than the question asked for:
                    # "how many have an open gap" also returns the cohort size
                    # and the rate. A model answering only what was asked is not
                    # wrong, so a second tier asks whether every value the preset
                    # produced is somewhere in the model's answer.
                    truth_vals = {v for row in truth for v in row}
                    got_vals = {v for row in got for v in row}
                    covered = truth_vals <= got_vals
                    status = "covers" if covered else "differs"
                    detail = (f"answers the question with fewer columns"
                              if covered else
                              f"{len(truth)} row(s) expected, {len(got)} returned")
            except Exception as e:
                status, detail = "error", str(e).splitlines()[0][:60]
    rows.append({"question": g["q"], "result": status, "detail": detail,
                 "truth_df": truth_df, "model_df": model_df})

score = pd.DataFrame([{k: r[k] for k in ("question", "result", "detail")} for r in rows])
matched = (score["result"] == "match").sum()
covers = (score["result"] == "covers").sum()
print(f"\\n  {matched} of {len(score)} identical to the hand-written query")
print(f"  {covers} more returned the same figures in a different shape")
print(f"  {len(score) - matched - covers} disagreed or failed\\n")
score
'''),
    md("""
## 6 · Look at every disagreement

A score is a claim until you read the cases behind it. Each mismatch is either
the model being wrong, or the model being right in a way the comparison is too
blunt to see — and those are different conclusions.
"""),
    code('''
for r in rows:
    if r["result"] == "match":
        continue
    print("=" * 78)
    print(r["question"], " —— ", r["result"], r["detail"])
    g = next(x for x in generated if x["q"] == r["question"])
    print("\\n  hand-written:\\n   ", textwrap.shorten(g["sql"], 320))
    print("\\n  model:\\n", textwrap.indent(g["model_sql"], "    "))
    if r["truth_df"] is not None:
        print("\\n  expected:"); print(textwrap.indent(r["truth_df"].head(6).to_string(), "    "))
    if r["model_df"] is not None:
        print("\\n  got:"); print(textwrap.indent(r["model_df"].head(6).to_string(), "    "))
    print()
'''),
    md("""
## 7 · Try the questions the presets cannot answer

The ten above are the ones the page already handles, so matching them only shows
the model is not worse. The interesting question is whether it covers the long
tail — the things a clinician asks that nobody wrote a preset for.

These have no ground truth. Read the SQL, not just the answer.
"""),
    code('''
OPEN_ENDED = [
    "Which patients on insulin are overdue and were last seen more than six months ago?",
    "What is the median A1c for patients who are up to date, versus those overdue?",
    "Are the never-tested patients older or younger than the rest of the cohort?",
    "How many patients would still have an open gap if the threshold were 18 months instead of 12?",
]

for q in OPEN_ENDED:
    sql = ask(q)
    ok, checked = guard(sql)
    print("=" * 78); print(q); print()
    print(textwrap.indent(sql, "  "))
    if not ok:
        print(f"\\n  STOPPED: {checked}\\n"); continue
    try:
        print(textwrap.indent(con.execute(checked).fetchdf().head(8).to_string(), "  "), "\\n")
    except Exception as e:
        print(f"\\n  failed to run: {str(e).splitlines()[0]}\\n")
'''),
    md("""
## 8 · What this run found

Numbers from the run whose outputs are saved above. They will move between
runs; the shapes of the disagreements are the durable part.

**Two of ten identical, one more returning the same figures in a different
shape.** That sounds bad and mostly is not. Read the cases in section 6 and they
fall into three piles.

**Pile one: the model answered the question, the preset answered more.** Asked
"how many patients have an open A1c gap", the model returns 25. The preset
returns 116, 25 and 21.6% — cohort size and rate as well. The preset is more
useful on a dashboard; the model is a better answer to the sentence.

**Pile two: genuine ambiguity nobody had resolved.** "Who has a gap, by care
setting" — the preset groups every patient and counts gaps alongside, so a unit
with one patient and no gaps still appears. The model filtered to patients with
a gap, so that unit vanished. Both are defensible readings and the question does
not say which. The age bands were the same kind of problem until the prompt was
told which bands this project reports on, which is ADR-0011 and not something a
model can infer.

**Pile three, and the reason this matters: one silently wrong answer.**

> *Which patient records are waiting on a human decision?*

The identity review queue lives in its own table and holds six pairs. The model
queried `patients.identity_review_pending` instead and returned **zero rows**.

Not an error, not a refusal. An empty table, which on a clinical page reads as
"nothing needs review". The six duplicate-patient pairs that a human is supposed
to adjudicate would simply not be mentioned. That is the expensive failure mode
for this kind of work, and it is invisible unless you already know the answer.

## So does ADR-0012 change?

**No, and now for a tested reason rather than an assumed one.**

The deployment argument was never in doubt: the site is a static export, a key
in the browser is a public key, and that has not moved. What this run adds is
that the capability argument does not rescue it either. On the ten questions
somebody already wrote correct SQL for, the model was not reliably better, and
on one of them it was confidently, silently wrong in exactly the way a care-gap
list cannot afford.

The preset page refuses what it does not recognise. That is a worse experience
and a safer failure, and section 6 is the evidence for preferring it.

**What would change the answer.** Not a better model — better grounding. The one
real error was a routing mistake: the right data was one table away. A version
worth revisiting would describe what each table is *for* rather than just its
columns, run the same ten questions as a regression test, and refuse to answer
when the generated SQL returns nothing, since on this data an empty result is
nearly always a wrong query rather than a true "none".
"""),
    code("""
con.close()
print("warehouse closed")
"""),
]

nb = {
    "cells": CELLS,
    "metadata": {
        "kernelspec": {
            "display_name": "Python (clinicalGap .venv)",
            "language": "python",
            "name": "clinicalgap",
        },
        "language_info": {"name": "python", "version": "3.12.2"},
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}

OUT.write_text(json.dumps(nb, indent=1) + "\n")
print(f"wrote {OUT.relative_to(ROOT)}  ({len(CELLS)} cells)")
