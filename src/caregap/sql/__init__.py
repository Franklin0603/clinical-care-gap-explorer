"""SQL that is long enough to deserve its own file.

Not all of it. A query of six lines reads better beside the paragraph
explaining why it exists, and the check predicates in domain/checks.py are
declarations rather than queries - splitting a check from its own rule would
cost more than it buys. What lives here are the three statements long enough
that reading them inside a Python string was the worse option: the Bronze load,
the Silver build, and the Gold care-gap query.

Placeholders are `{name}` and filled by `load()`. The loader refuses a template
with an unfilled placeholder rather than passing a literal `{asof}` to DuckDB,
because the resulting parser error names a position in generated SQL and says
nothing about which parameter was forgotten.
"""

import string
from pathlib import Path

SQL_DIR = Path(__file__).parent


class TemplateError(Exception):
    """A SQL template was given the wrong parameters."""


def load(name: str, **params) -> str:
    """Read `name` from this directory and fill its placeholders.

        load("gold/care_gap_a1c.sql", asof="2026-08-23", dx_codes="'44054006'")

    Raises TemplateError naming the missing or unused parameters, so a mistake
    surfaces here rather than as a DuckDB parser error on generated text.
    """
    path = SQL_DIR / name
    if not path.exists():
        raise TemplateError(f"No SQL template at {path}")
    template = path.read_text()

    wanted = {f for _, f, _, _ in string.Formatter().parse(template) if f}
    missing = wanted - set(params)
    unused = set(params) - wanted
    if missing:
        raise TemplateError(
            f"{name} needs {sorted(missing)}, which were not supplied. "
            f"It was given {sorted(params)}."
        )
    if unused:
        raise TemplateError(
            f"{name} was given {sorted(unused)}, which it does not use. "
            "Either the template or the caller is out of date."
        )
    return template.format(**params)
