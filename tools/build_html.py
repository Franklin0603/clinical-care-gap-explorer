"""Build the shareable HTML pages in docs/html/.

These are self-contained: the charts are embedded as data URIs rather than
linked, so a page still works when it has been emailed, copied to a USB stick,
or opened from a Downloads folder with no network. That costs about 450 KB per
page and is the whole point - a shared file with broken images is worse than no
file.

Run after regenerating the charts or changing a headline figure:

    make html

The template lives beside this script. Figures in it are written out rather
than interpolated, because this page is read by people rather than built from
the warehouse - but `make html` prints the live numbers next to what the page
claims, so a drift shows up rather than going quiet.
"""

import base64
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "html"
IMG = ROOT / "docs" / "img"

PAGES = {
    "findings.html": {
        "template": "findings.template.html",
        "images": {
            "FUNNEL": "01_cohort_funnel.png",
            "JOIN": "02_inner_join.png",
            "FLOOR": "04_a1c_floor.png",
            "DRIFT": "06_asof_drift.png",
        },
    },
}

# Figures the page states, and where the live value comes from. Checked, not
# injected - the page is prose and should read as prose.
CLAIMS = [
    ("cohort",        "gold_report.json", "cohort"),
    ("open gaps",     "gold_report.json", "open_gaps"),
    ("never tested",  "gold_report.json", "never_tested"),
    ("gap rate %",    "gold_report.json", "gap_rate_pct"),
]


def embed(template: Path, images: dict) -> str:
    html = template.read_text()
    for key, filename in images.items():
        path = IMG / filename
        if not path.exists():
            raise SystemExit(f"Missing chart: {path}\nRun notebooks/03_gold.ipynb to rebuild them.")
        data = base64.b64encode(path.read_bytes()).decode()
        html = html.replace("{{" + key + "}}", f"data:image/png;base64,{data}")
    left = re.findall(r"\{\{(\w+)\}\}", html)
    if left:
        raise SystemExit(f"Unfilled placeholders in {template.name}: {left}")
    return html


def check_claims(html: str) -> list[str]:
    """Warn when a number on the page is no longer what the pipeline produces."""
    warnings = []
    for label, filename, key in CLAIMS:
        path = ROOT / "data" / filename
        if not path.exists():
            return [f"no {filename} yet — run `make run` to check the page's figures"]
        value = json.loads(path.read_text())[key]
        if str(value) not in html:
            warnings.append(f"page does not mention {label} = {value}")
    return warnings


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in PAGES.items():
        html = embed(Path(__file__).parent / spec["template"], spec["images"])
        (OUT / name).write_text(html)
        print(f"  docs/html/{name}  {len(html) / 1024:.0f} KB, "
              f"{len(spec['images'])} charts embedded")
        for w in check_claims(html):
            print(f"    ! {w}")
    print(f"\n  open with:  open {OUT.relative_to(ROOT)}/findings.html")


if __name__ == "__main__":
    sys.exit(main())
