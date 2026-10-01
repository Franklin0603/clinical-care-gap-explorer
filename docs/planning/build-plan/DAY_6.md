# Day 6 — Access By Role

**~3 hours · Tracker IDs 6.1 – 6.7**

## Why today exists

P3 shows the care-gap cohort filtered by clinical role — PCT, Nurse, Physician.
This is the page where your own experience shows up, and it's the one a
health-tech reviewer will look at hardest.

Two rules from `ACCESS_CONTROL.md` govern everything today:

**Never write "HIPAA compliant."** The phrase is *"models minimum-necessary
access by clinical role."* Compliance means BAAs, audit infrastructure, breach
procedures, training, physical safeguards, a real covered entity. A portfolio app
has none of that, and claiming otherwise is the fastest way to lose credibility
with someone who works in health tech.

**Filter server-side.** A reviewer will open dev tools. If restricted data is in
the payload, the demo argues against its own thesis.

## Learning objectives

By tonight you should be able to say, without notes:

- What the minimum necessary standard is, and why this demo is not HIPAA compliant
- Why hiding columns in the browser is not access control
- An example where column filtering alone still leaks information

---

## Tasks

### 6.1 — Rewrite the role matrix from your own experience

The matrix in `ACCESS_CONTROL.md` is a starting point. The doc says your version
is more credible than the one that's written there — because you worked the
floor as a PCT and the author of the doc didn't.

Adjust it to match how access actually worked on your unit. Then note in the
README that it reflects real unit practice, not a textbook.

**This is the part of the project only you can write.** Everything else is
technique. Make it specific enough that someone who has worked in a hospital
recognises it.

### 6.2 — Server-side filtering in the query layer

The restricted fields must never be selected, never leave the database, never
reach the browser.

Not: fetch everything and hide columns in the component. Not: `display: none`.
Not: filter in a client-side `useEffect`.

**Look this up:** server-side vs client-side authorization, why CSS is not
security, column-level security

### 6.3 — Row-level filtering too

A PCT sees fewer columns **and** only patients on their assigned unit. FR4 says
both.

Column-only filtering is the shortcut people take, and it's the one that gets
noticed — because a reviewer switches roles, sees the same row count, and knows
immediately you only did half of it.

**Look this up:** row-level security, predicate pushdown

### 6.4 — "Not available for this role" placeholders

When a role can't see a field, show a labelled placeholder rather than dropping
the column silently.

**The restriction being visible is the entire point.** A missing column teaches
the viewer nothing. A greyed cell saying "Not available for this role" teaches
them what the demo is about.

### 6.5 — Gap count by age band

Decide the banding first (Decision D11). Ten-year bands are conventional;
clinical bands are defensible if you can name the reasoning. "Because HEDIS
stratifies that way" beats "it looked nice."

**Look this up:** age banding in population health, HEDIS age stratification

### 6.6 — Test your own claim

Select PCT. Open dev tools. Inspect the actual network response.

**Do this before a reviewer does.** You're checking the exact thing a skeptical
person checks first.

### 6.7 — Commit

---

## Validation

### V6.1 — The payload is clean (the one that matters)
**Check:** with PCT selected, open the Network tab, find the request that carries
patient data, and read the raw response
**Expect:** no A1c values, no medication data, no full condition history — the
fields aren't null, they're **absent**
**If it fails:** the data left the server. Restricting it in the component means
anyone who opens dev tools sees everything, and your page claims otherwise. This
is the check the whole day exists for.

### V6.2 — Row counts change with role
**Check:** note the patient count as PCT, then as Physician
**Expect:** different numbers — a PCT sees only their unit
**If it fails:** you did column filtering only. FR4 requires both.

### V6.3 — Restrictions are visible, not silent
**Check:** as PCT, look for the A1c column
**Expect:** present and labelled "Not available for this role"
**If it fails:** you dropped the column. The viewer learns nothing, and the page
loses its argument.

### V6.4 — Role can't be spoofed from the client in a way that grants data
**Check:** try changing the role value in the request (query param, body,
whatever carries it) to `physician` while the UI says PCT
**Expect:** think about what happens. There's no auth — that's stated openly —
so the honest answer is that the selector is a demonstration control.
**What matters:** you *know* this and say it in the README, rather than being
surprised by it. "There is no authentication; the role selector is a
demonstration control" is already the language in `ACCESS_CONTROL.md`. Use it.

### V6.5 — The word "compliant" appears nowhere
**Check:** grep the whole repo — web source, README, docs — for "HIPAA",
"compliant", "compliance"
**Expect:** only in sentences that explicitly say this is **not** compliant, or
that name the minimum necessary standard
**If it fails:** fix immediately. One wrong sentence here costs more credibility
than any technical flaw on the site.

### V6.6 — The matrix is yours
**Check:** compare your matrix against the starting one in `ACCESS_CONTROL.md`
**Expect:** differences you can justify from experience
**If it fails:** if it's unchanged, you've skipped the one part of this project
nobody else could have written.

### V6.7 — The chart agrees with the table
**Check:** sum the gap counts across all age bands, compare to the total gap
count on P1
**Expect:** equal
**If it fails:** usually a band boundary that drops or double-counts patients at
the edges, or nulls falling outside every band.

### V6.8 — Age bands cover everyone
**Check:** count patients in Gold whose age falls into no band
**Expect:** zero
**If it fails:** open-ended top band missing, or an off-by-one at a boundary.

### V6.9 — Role switching is fast enough to demo
**Check:** switch roles a few times
**Expect:** quick enough that it reads as one interaction in a 90-second video
**If it fails:** if every switch is a slow round trip, the Day 7 Loom will feel
broken. Cache or pre-fetch, but keep the filtering server-side.

### V6.10 — The physician view is complete
**Check:** as Physician, confirm you see full condition history, full medication
history, and cross-unit patients
**Expect:** the fullest view, per your matrix
**If it fails:** if all three roles look similar, the demo has nothing to
demonstrate. The contrast between roles *is* the feature.

---

## Ship gate

- [ ] V6.1 passes — PCT payload contains no restricted fields
- [ ] Both row and column filtering work (V6.2)
- [ ] Placeholders visible for restricted fields
- [ ] The role matrix reflects your own experience
- [ ] No compliance claim anywhere in the repo (V6.5)
- [ ] Decisions D10 and D11 recorded
- [ ] Day 6 committed

## Common ways Day 6 goes wrong

**You filter in the component.** It looks identical on screen and fails the only
check that matters.

**Column-only filtering.** Row counts stay the same across roles and it's
obvious.

**You drop restricted columns instead of labelling them.** The page stops making
its own argument.

**You soften the language** to "HIPAA-aligned" or "HIPAA-ready" because it
sounds stronger. It reads as not knowing what compliance involves. "Models
minimum-necessary access" is the stronger sentence precisely because it's exact.
