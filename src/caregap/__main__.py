"""Entry point for `python -m caregap`.

The project also installs a `caregap` console script, but that depends on pip's
editable-install .pth file being read. On a synced macOS folder those files can
carry the UF_HIDDEN flag, and Python's site module deliberately skips hidden
.pth files - so the package installs cleanly and then cannot be imported.

`PYTHONPATH=src python -m caregap` needs none of that, which makes it the form
the Makefile and CI use.
"""

from caregap.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
