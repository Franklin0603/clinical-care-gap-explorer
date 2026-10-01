# Shareable pages

Self-contained HTML. Open any of them by double-clicking — no server, no build
step, no network needed for the content.

| | Size | What it is |
|---|---:|---|
| `findings.html` | 450 KB | The seven findings with their charts. **The one to send someone.** |
| `clinical-concepts.html` | 21 KB | The domain primer, for a reader with no healthcare background |
| `architecture.html` | 17 KB | How the five stages fit together |

`findings.html` is large because its four charts are embedded as data URIs
rather than linked. That is deliberate: a file that still works after being
emailed, copied to a stick, or opened from a Downloads folder is worth the
weight, and a shared page with broken images is worse than no page. The other
two draw their diagrams as inline SVG and CSS, so they stay small.

Fonts load from Google and fall back to Georgia and the system stacks when the
network is blocked — the pages read correctly either way.

## Rebuilding

```bash
make html
```

The templates are in [`../../tools/`](../../tools/), sharing one stylesheet so
the three read as a set. The build refuses a template with an unfilled
placeholder, and warns when a figure `findings.html` states no longer matches
`data/gold_report.json` — the prose stays prose, but drift shows up rather than
going quiet.

Regenerate after changing a headline number or redrawing a chart in
[`notebooks/03_gold.ipynb`](../../notebooks/03_gold.ipynb).
