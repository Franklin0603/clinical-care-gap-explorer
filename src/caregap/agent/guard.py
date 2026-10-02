"""Only a single SELECT is allowed to run.

There are now two of these: `guardSelectOnly` in `web/lib/sql.ts` guards the SQL
a reader types into the question page, and this one guards the SQL a model
writes. They cannot be one implementation because one runs in a browser and one
runs in Python, so what keeps them honest is a shared corpus of cases:
`tests/test_guard.py` and `web/lib/sql.test.ts` probe the same statements and
must agree about every one.

Duplicating the logic is a cost. Duplicating it *silently* would be the actual
problem, which is what the shared corpus is for.

The approach is an allowlist on what the statement *is*, not a blocklist of
words it contains:

  - A blocklist on "DROP" rejects `WHERE mrn LIKE '%drop%'`, which is harmless.
  - A check that reads only the first statement passes `SELECT 1; DROP TABLE x`.
  - `WITH x AS (SELECT 1) DELETE FROM patients` begins with WITH, contains
    SELECT, and deletes rows. DuckDB accepts it. That one defeated the first
    version of the web guard and was caught by writing the test, not by reading
    the code.

Underneath this the connection is read-only, so a bypass has nothing to damage.
The guard is the first line, not the only one.
"""

import re
from dataclasses import dataclass


# Every keyword a statement can legitimately begin with. Anything else means the
# input is not SQL at all, which matters because a model asked to do something
# destructive answers in prose: "I can't do that...". Taking the first word of
# that gives a refusal reading "it is a I", which is true and useless.
STATEMENT_VERBS = frozenset({
    "SELECT", "WITH", "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
    "TRUNCATE", "GRANT", "REVOKE", "COPY", "ATTACH", "DETACH", "PRAGMA", "SET",
    "CALL", "EXPLAIN", "DESCRIBE", "SHOW", "USE", "BEGIN", "COMMIT", "ROLLBACK",
    "VACUUM", "ANALYZE", "EXPORT", "IMPORT", "INSTALL", "LOAD", "CHECKPOINT",
    "VALUES", "TABLE", "FROM", "PIVOT", "UNPIVOT", "SUMMARIZE",
})


@dataclass(frozen=True)
class Guard:
    ok: bool
    sql: str = ""
    reason: str = ""


def main_verb(sql: str) -> str | None:
    """What the statement actually does, looking past any CTE list.

    For most statements that is the first word. For WITH it is not, so the CTE
    list is walked - tracking parenthesis depth and skipping string literals -
    and the keyword after it is the one that counts.
    """
    first = re.match(r"\s*([a-z]+)", sql, re.I)
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
                rest = sql[i + 1:]
                stripped = rest.lstrip()
                if stripped.startswith(","):          # another CTE follows
                    i += 1 + (len(rest) - len(stripped))
                    continue
                word = re.match(r"([a-z]+)", stripped, re.I)
                return word.group(1).upper() if word else None
        i += 1
    return None


def strip_fences(raw: str) -> str:
    """Models wrap SQL in markdown even when told not to."""
    return re.sub(r"^\s*```(?:sql)?\s*|\s*```\s*$", "", raw.strip(), flags=re.I).strip()


def guard_select_only(raw: str) -> Guard:
    """Accept one SELECT. Refuse everything else, with a reason worth reading."""
    sql = strip_fences(raw)
    if not sql:
        return Guard(False, reason=(
            "There is no statement to run. The model returned nothing, or "
            "everything it returned was prose rather than SQL."
        ))

    # Comments first, so they cannot hide a separator, then string literals are
    # masked so a semicolon *inside* a value is not read as one. `WHERE note =
    # 'a;b'` is legitimate and has to keep working.
    bare = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    bare = re.sub(r"--[^\n]*", " ", bare).strip()
    bare = re.sub(r";+\s*$", "", bare).strip()
    masked = re.sub(r"'(?:[^']|'')*'", "''", bare)

    if not bare:
        return Guard(False, reason=(
            "There is no statement to run, only comments."
        ))

    if ";" in masked:
        return Guard(False, reason=(
            "That is more than one statement. Only a single SELECT runs here, so "
            "a second statement after a semicolon is refused even when the first "
            "one is harmless."
        ))

    verb = main_verb(masked)
    if verb is None or verb not in STATEMENT_VERBS:
        opening = " ".join(bare.split()[:12])
        return Guard(False, reason=(
            "That is not SQL. The model answered in prose instead of returning a "
            f"statement, beginning: {opening!r}"
        ))
    if verb != "SELECT":
        return Guard(False, reason=(
            f"This runs SELECT statements only, and that one is a {verb}. "
            f"Nothing here can write, delete or alter data."
        ))

    return Guard(True, sql=bare)
