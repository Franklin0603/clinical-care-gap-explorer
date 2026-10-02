"""The same two checks as smoke_test.py, with every failure handled.

Kept as a reference rather than as the thing you run. smoke_test.py is sixteen
lines and answers the question on a good day; this one answers it on a bad day,
and the difference between the two files is the interesting part.

Five things it does that the short version does not, each of which came from an
actual failure rather than from imagining one:

1.  Reads the text blocks by type, not resp.content[0].text. A model that
    thinks emits a ThinkingBlock first, so index 0 is whatever came out first
    and carries .text only some of the time. The short version has this fix
    too, because without it the script simply does not run.

2.  Names the workspace problem. A user-scoped key (sk-ant-usr-...) belongs to
    the organisation rather than to one workspace, so the API returns a 400
    about an anthropic-workspace-id header. That reads as nonsense unless you
    already know what it means.

3.  Prints e.message rather than the exception. The repr of a failed request
    can carry headers, and headers carry the key. This is the one to copy into
    anything that logs API errors.

4.  Opens the warehouse read-only, so a notebook kernel holding the write lock
    does not fail the check for a reason that has nothing to do with the
    warehouse being sound.

5.  Runs both checks and exits on the worst result, so a dead key cannot hide a
    missing warehouse.

And one bug that only appeared while testing the failure paths: Path.relative_to
raises instead of giving up, so the "there is no warehouse" message became a
ValueError traceback whenever DB pointed outside the repo. An error handler that
crashes is worse than none, because it fires exactly when somebody is already
lost.

    PYTHONPATH=src python -m caregap.scripts.smoke_test_hardened
"""

import os
import sys

import anthropic
import duckdb
from dotenv import load_dotenv

from caregap.config import DB, ROOT

# claude-sonnet-4-5 still answers, but the API returns a deprecation warning on
# every call and it reaches end-of-life on 2026-11-30.
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")
PROMPT = "Say hello in five words."


def short(path):
    """A repo-relative path when it is one, the full path otherwise.

    Path.relative_to raises rather than giving up, so the plain version turned
    a clear "there is no warehouse" message into a ValueError traceback the
    moment DB pointed anywhere else.
    """
    try:
        return path.relative_to(ROOT)
    except ValueError:
        return path


def ok(label, detail):
    print(f"  ok    {label:11} {detail}")
    return True


def bad(label, detail):
    print(f"  FAIL  {label:11} {detail}")
    return False


def check_api():
    load_dotenv()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        return bad("anthropic",
                   "No ANTHROPIC_API_KEY. Copy .env.example to .env and fill it in.")

    # A user-scoped key (sk-ant-usr-...) belongs to the organisation rather than
    # to one workspace, so the API cannot tell which workspace to bill unless a
    # header names one. A workspace-scoped key carries that itself.
    workspace = os.environ.get("ANTHROPIC_WORKSPACE_ID")
    client = anthropic.Anthropic(
        default_headers={"anthropic-workspace-id": workspace} if workspace else None,
    )

    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=100,
            messages=[{"role": "user", "content": PROMPT}],
        )
    except anthropic.AuthenticationError:
        return bad("anthropic", "The key was rejected. Check ANTHROPIC_API_KEY in .env.")
    except anthropic.NotFoundError:
        return bad("anthropic", f"No model called {MODEL!r} on this account.")
    except anthropic.APIStatusError as e:
        # e.message, never the exception: the repr of a failed request can carry
        # headers, and headers carry the key.
        if "workspace" in str(e.message).lower():
            return bad("anthropic",
                       "This key is not scoped to a workspace. Either create an API "
                       "key inside a workspace (it starts sk-ant-api), or add "
                       "ANTHROPIC_WORKSPACE_ID=wrkspc_... to .env.")
        return bad("anthropic", f"{e.status_code}: {e.message}")
    except anthropic.APIConnectionError as e:
        return bad("anthropic", f"Could not reach the API: {e.__cause__}")

    # Not resp.content[0].text. A model that thinks puts a ThinkingBlock first,
    # so index 0 is whatever the model emitted first and carries .text only some
    # of the time. Pick the text blocks out by type.
    said = "".join(b.text for b in resp.content if b.type == "text").strip()
    if not said:
        kinds = ", ".join(sorted({b.type for b in resp.content})) or "nothing"
        return bad("anthropic", f"The reply carried no text block, only: {kinds}")

    return ok("anthropic",
              f"{MODEL} said {said!r} "
              f"({resp.usage.input_tokens} in, {resp.usage.output_tokens} out)")


def check_warehouse():
    """The second half of the question: is there anything to query yet?

    config exposes module-level constants, not a cfg object, and the warehouse
    path is DB. There is no cfg.warehouse_path.
    """
    if not DB.exists():
        return bad("warehouse",
                   f"Nothing at {short(DB)}. Run `make run` to build it.")

    try:
        # read_only matters. A notebook kernel holding the write lock would
        # otherwise fail this for a reason that has nothing to do with whether
        # the warehouse is sound.
        con = duckdb.connect(str(DB), read_only=True)
    except duckdb.IOException as e:
        return bad("warehouse", f"Could not open it: {str(e).splitlines()[0]}")

    try:
        patients, gaps = con.execute(
            "SELECT count(*), count(*) FILTER (WHERE gap_flag) FROM care_gap_a1c"
        ).fetchone()
    except duckdb.CatalogException:
        return bad("warehouse",
                   "Opened, but there is no care_gap_a1c table. The run stopped "
                   "before Gold; try `make run`.")
    finally:
        con.close()

    return ok("warehouse", f"{patients} patients, {gaps} with an open gap")


def main():
    print("\nSmoke test\n----------")
    results = [check_api(), check_warehouse()]
    print()
    if not all(results):
        sys.exit(1)


if __name__ == "__main__":
    main()
