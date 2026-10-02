"""Does the Anthropic API work from here?

One call, one sentence back. This is the thing you run when something else has
stopped working and you want to know whether the problem is your code or your
credentials, so it deliberately does nothing clever: no retries, no streaming,
no project code imported.

    python -m caregap.scripts.smoke_test

The key comes from .env, which is gitignored and must stay that way. Nothing
here prints it, including on failure.
"""

import os
import sys

import anthropic
from dotenv import load_dotenv

# claude-sonnet-4-5 still answers but the API now returns a deprecation
# warning on every call, with end-of-life on 2026-11-30.
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")
PROMPT = "Say hello in five words."


def main():
    load_dotenv()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit(
            "No ANTHROPIC_API_KEY.\n"
            "Put it in a .env file at the repo root:\n"
            "    ANTHROPIC_API_KEY=sk-ant-...\n"
            ".env is gitignored; do not commit it."
        )

    # A user-scoped key (sk-ant-usr-...) belongs to the organisation rather
    # than to one workspace, so the API cannot tell which workspace to bill and
    # rejects the call unless the header names one. A workspace-scoped key
    # (sk-ant-api...) carries that itself and needs nothing here.
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
        sys.exit("The key was rejected. Check ANTHROPIC_API_KEY in .env.")
    except anthropic.NotFoundError:
        sys.exit(f"No model called {MODEL!r} on this account.")
    except anthropic.APIStatusError as e:
        # Deliberately e.message and not the whole exception: the repr of a
        # request object can carry headers, and headers carry the key.
        if "workspace" in str(e.message).lower():
            sys.exit(
                "This key is not scoped to a workspace, so the API cannot tell "
                "which workspace to bill.\n\n"
                "Two ways to fix it, either is fine:\n"
                "  1. In the Anthropic Console, create an API key *inside a "
                "workspace* (it will start sk-ant-api, not sk-ant-usr) and put "
                "that in .env instead.\n"
                "  2. Keep this key and add the workspace to .env:\n"
                "         ANTHROPIC_WORKSPACE_ID=wrkspc_...\n"
                "     The id is in the Console URL when the workspace is open."
            )
        sys.exit(f"The API returned {e.status_code}: {e.message}")
    except anthropic.APIConnectionError as e:
        sys.exit(f"Could not reach the API: {e.__cause__}")

    print(resp.content[0].text)
    print(
        f"\n  {MODEL}  ·  {resp.usage.input_tokens} in, "
        f"{resp.usage.output_tokens} out  ·  stop: {resp.stop_reason}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
