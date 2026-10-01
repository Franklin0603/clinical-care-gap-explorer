# ADR-0002 · Pin four time flags, not just the seed

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-20 |
| **Affects** | reproducibility of every number |

## Context

The README claims the numbers are reproducible. Four weeks after the original
run, the same command was run again to check.

It produced **1,151 patients instead of 1,142**, with every table 4–6% larger.

## Options considered

- **`-s` alone** — what was originally done; pins the patient generator only
- **All four time flags** — also pins clinicians, the simulation's "now", and when it stops

## Decision

```bash
-s  20260823   # patient generator
-cs 20260823   # clinician assignment
-r  20260823   # the simulation's idea of "now"
-e  20260823   # when the simulation stops
```

Each additional flag was found by pinning one and seeing what still moved.

## Consequences

With all four pinned, two runs produce identical content.

Two lessons that outlive this project:

- **The seed controls the data, not the calendar.** Any generator with a notion
  of "now" needs "now" pinned too — run it a month later and it simulates a
  month more history.
- **"Reproducible" means same content, not same bytes.** Synthea exports from
  several threads, so row order varies. Comparing checksums reported a
  difference that did not exist. The right check is a sorted diff.

---

*Evidence: Verified by a clean clone: `make generate` from nothing reproduces 116 / 25 / 21 in 180 seconds*
