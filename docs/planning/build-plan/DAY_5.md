# Day 5 — Make It Visible

**~3 hours · Tracker IDs 5.1 – 5.10**

## Why today exists

The pipeline works. Nobody can see it. Today you build the app shell, P1
Overview, and P2 Pipeline & Data Quality — and you deploy.

**P2 before P3.** The data quality work is the differentiator, so it gets built
while you still have energy and time. If a day runs long later, P3 and P4 shrink;
P2 doesn't.

**Deploy today, not on Day 7.** Deployment always surprises you. Finding out on
Day 5 costs an hour. Finding out on Day 7 costs the project.

## Learning objectives

By tonight you should be able to say, without notes:

- Why you chose live queries vs. a static export, and what it costs you
- What "the data quality work is visible, not implied" means in page terms

---

## Tasks

### 5.1 — Scaffold Next.js in `web/`

Keep it plain. The content is the point.

### 5.2 — Decide how the app reads the data (Decision D9)

Two routes:

- **Query DuckDB at request time** — P4's SQL is genuinely live, but you need a
  runtime that can hold a database file, and serverless filesystems are
  ephemeral and read-only in ways that will bite you.
- **Export Gold to JSON at build time** — deploys anywhere, instant, but P4 has
  to run its SQL against something. You'd need an in-browser or in-process query
  engine, or you accept that P4 queries a snapshot.

**Decide before you build P2, not after.** This determines where you can deploy
and how P4 works on Day 7. Do a five-minute spike to prove your choice works,
then commit to it.

**Look this up:** serverless filesystem constraints, Next.js static export,
DuckDB in Node vs Python, DuckDB-WASM

### 5.3 — The synthetic-data banner

One shared component, on every page including error states. FR7.

**Why one component:** so it can't drift, and so it can't be missing from the
one page someone screenshots.

### 5.4 — P1 Overview

Headline number (___ of ___ diabetic patients with an open A1c gap), one-sentence
description, architecture diagram, links to the other three pages.

**The headline number must be read from Gold, not typed in.** If you hardcode it
you will forget, regenerate the data, and publish a wrong number.

Goal G1: a viewer with no context understands the pipeline in under 3 minutes.
This page carries most of that load.

### 5.5 — P2: layer counts and the six checks

Bronze -> Silver -> Gold with row counts. The six checks with pass/fail and
counts.

### 5.6 — P2: the quarantine table

Every rejected row with its `failure_reason`.

**This is the page that proves "nothing is silently dropped."** Showing the
rejects *is* the argument. Don't summarise them into a count — a count is a
claim, a table is evidence.

Make `failure_reason` readable by a human who doesn't write SQL.

### 5.7 — P2: the identity review queue

Duplicate MRNs awaiting a human decision, with match fields and confidence,
status `pending`.

Add a sentence saying these are deliberately not auto-merged and why. The
restraint is the point — make sure a reader understands it's a choice, not a
missing feature.

### 5.8 — P2: one before/after remediation example

Original value, corrected value, and the rule that changed it.

One concrete example explains remediation faster than three paragraphs.

### 5.9 — P2: the catch rate

The number, and — if it's below 100% — which defect got through and why.

### 5.10 — Deploy

Get a public URL today.

**Look this up:** Vercel deploys, build-time vs runtime data, environment
variables

---

## Validation

### V5.1 — Every number on screen came from the pipeline
**Check:** grep your web source for hardcoded digits that should be dynamic —
the headline count, layer counts, catch rate
**Expect:** none. Every figure traces to Gold or a metrics artefact.
**If it fails:** regenerate the data with a different seed and reload. Any number
that doesn't move was hardcoded.

### V5.2 — Screen numbers match the warehouse
**Check:** for three numbers on P2, run the equivalent query yourself and compare
**Expect:** identical
**If it fails:** usually a stale build-time export. Which is exactly the failure
mode Decision D9 was about — note it.

### V5.3 — The banner is genuinely everywhere
**Check:** load all four routes, plus a deliberately broken URL (a 404), plus a
page in an error state
**Expect:** the synthetic-data notice on every one. FR7 says every page.
**If it fails:** it's in a page component instead of the shared layout.

### V5.4 — Quarantine shows rows, not a summary
**Check:** open P2 and look at the quarantine section
**Expect:** actual rejected rows with readable reasons — you can point at one and
say what happened to it
**If it fails:** you built a count. The count is the claim you're trying to
support; it can't be its own evidence.

### V5.5 — Failure reasons read like sentences
**Check:** read every distinct `failure_reason` on screen out loud
**Expect:** a non-technical person understands each one
**If it fails:** if it says `ValueError: could not convert string to float`,
that's a stack trace fragment on your portfolio site. G4 says every failure path
returns a plain sentence.

### V5.6 — The public URL actually works
**Check:** open the deployed URL on your phone, on cellular data, in a private
window
**Expect:** loads, with real data, no console errors
**If it fails — works locally, not deployed:** almost always the data-access
decision (D9). Better to hit this now than on Day 7.

### V5.7 — Cold-start check
**Check:** leave the deployment alone for ten minutes, then load it
**Expect:** loads in a reasonable time
**If it fails:** a cold start that takes 30 seconds is what a recruiter sees when
they click your link. Know about it now.

### V5.8 — Three-minute test
**Check:** hand the URL to someone with no context and time them
**Expect:** in under three minutes they can say what the project does and why
the middle part matters (G1)
**If it fails:** P1 is doing too little. Usually the fix is one clearer sentence
at the top, not more content.

### V5.9 — Mobile is not broken
**Check:** open P2 on a phone
**Expect:** the quarantine table is readable or scrollable, nothing overflows
**If it fails:** people will open your link on a phone. A table blowing out the
viewport is the first thing they'll see.

### V5.10 — No stack trace is reachable yet
**Check:** hit a bad route, and if you have query params, pass nonsense
**Expect:** a human sentence
**If it fails:** note it and fix on Day 7's error sweep — but don't forget it.

---

## Ship gate

- [ ] A public URL loads P1 and P2 with real data
- [ ] No hardcoded numbers (V5.1)
- [ ] The synthetic-data banner is on every page including errors
- [ ] Quarantine rows are visible with readable reasons
- [ ] Decision D9 recorded with its trade-off
- [ ] Day 5 committed

## Common ways Day 5 goes wrong

**You hardcode "47" while wiring up the layout** and never replace it. Then you
regenerate on Day 6 and your headline is a lie. V5.1 catches this.

**You leave deployment for Day 7** and discover your data-access approach can't
work on the host you picked, on the last day.

**You summarise quarantine into a count** because the table looks messy. The
mess is the evidence.

**You spend two hours on styling** and P2 never gets its identity queue. The
content is what's being evaluated.
