# What's left

Everything that can be built is built and deployed. Four things remain, and all
four need you rather than code: two are on camera, one is your floor experience,
one is your own recall.

| # | What | Time | Why it can't be done for you |
|---|------|------|------------------------------|
| 1 | The role matrix (task 6.1) | 20 min | It's your unit, not a textbook's |
| 2 | The Learning Log — 19 of 21 unanswered | 90 min | It's the interview, written down |
| 3 | The 90-second Loom (7.10) | 45 min | Your voice, your project |
| 4 | The three-minute test (7.11) | 15 min | Needs another person |

Do them in that order. The matrix changes what the Loom shows, and the Learning
Log is what makes the Loom sound like you know it rather than read it.

---

## 1 — The role matrix

`pipeline/access.py` holds the matrix as data. What's in there now is the
starting matrix from `ACCESS_CONTROL.md` plus reasoning about derived columns —
it is **not** your experience, and that doc says outright that your version is
more credible than its own.

Three questions to answer. Each is one line to change.

**Does a PCT really see the gap flag but not the value?** The current build says
yes: you're told a patient needs a draw, not what the last number was. If results
were on the board on your unit, that's wrong and worth changing.

**Is "unit" the right scoping?** Synthea has no rostering, so the code uses the
care setting of the patient's most recent encounter as a proxy — a PCT sees the
70 ambulatory patients. If your unit was a floor, a panel, or a service line, the
predicate changes.

**Does a nurse see condition history?** `ACCESS_CONTROL.md` says "partial". The
build gives them none, which may be stricter than reality.

When it's settled, the README's line — *"The matrix draws on my time as a patient
care technician"* — becomes true of the specifics, not just the framing.

---

## 2 — The Learning Log

**19 of 21 questions are unanswered.** This is the largest remaining item and the
one most likely to get skipped, because nothing breaks if you don't do it.

It is also, functionally, the interview. Every question on that sheet is one
somebody will ask, and the answer exists somewhere in this repo — writing it in
your own words is the step that moves it from the repo into your head.

The two already answered (#2 synthetic data, #13 reproducibility) came out of
things that actually went wrong. The rest have the same material available:

| Concept | Where the answer already is |
|---|---|
| Medallion architecture | `load_bronze.py` docstring; `DATA_DICTIONARY.md` |
| Clinical code systems | `CLINICAL_CONCEPTS.md`, the mental-model table |
| HEDIS / quality measures | `DECISIONS.md` D13; the D5/D6 definitions |
| Ground truth and evaluation | `corrupt.py` docstring; `FINDINGS.md` DQ results |
| Idempotency | `corrupt.py` — reload-first, and why |
| Quarantine over dropping | `validate.py` principle 1; the reconciliation assert |
| Referential integrity | DQ2 in `validate.py` |
| Patient identity resolution | DQ6; why nothing is auto-merged |
| Remediation vs overwriting | D4, the eAG rule |
| Null handling in SQL | DQ5's three-valued logic; the inner-join finding |
| Cohort definition | D5, and the 73 complication-only patients |
| Minimum necessary | `access.py` docstring |
| Server-side authorization | Why build-time partitioning satisfies V6.1 |
| Row vs column security | 70 / 106 / 116 and 7 / 17 / 19 |
| Audit logging | The access log on P4 — refusals included |
| SQL injection / SELECT-only | The `WITH ... DELETE` bypass a test caught |
| Text-to-SQL failure modes | The two confidently-wrong answers V7.1 found |
| Honest error handling | The scope check; "I can't answer that, but here's what I can" |
| Scale trade-offs | The at-scale section in `DATA_QUALITY_SPEC.md` |

Rate yourself honestly. A 2 you admit to is more useful than a 4 you guessed.

---

## 3 — The 90-second Loom

Ninety seconds is shorter than it sounds: roughly 220 spoken words. The whole
budget goes on four beats, and there is no room for a preamble.

**Do not open by explaining Synthea.** Open on the number.

### Shot list

| Time | On screen | Say roughly this |
|---|---|---|
| 0:00–0:12 | P1, top of page | "This finds diabetic patients overdue for an A1c test. Twenty-five of a hundred and sixteen have an open gap — and twenty-one of those have never been tested at all." |
| 0:12–0:30 | Scroll to the inner-join chart | "Those twenty-one are the interesting part. Three ordinary mistakes would each have hidden the same people. This one is changing a left join to an inner join — the report loses eighty-four percent of its findings and doesn't error." |
| 0:30–0:55 | Click through to P2, scroll to the quarantine table | "The query is easy. Trusting it isn't. I broke two hundred and forty-nine rows on purpose in six realistic ways, logged exactly what I broke, then scored my own checks against that list. Six of six. Every rejected row is here with the reason — nothing is silently dropped, and the pipeline fails if the arithmetic doesn't balance." |
| 0:55–1:15 | P3, click PCT → Physician → back | "Access is scoped by role. A technician sees seventy patients and seven columns; a physician sees a hundred and sixteen and nineteen. That's not the browser hiding things — each role loads a different file, built by a query that never selected the restricted columns." |
| 1:15–1:30 | P4, click a chip, then type `DROP TABLE patients` | "Every answer shows the SQL that produced it, running in the browser. And it only runs a single SELECT." *(let the refusal land on screen — don't narrate it)* |

### Rehearsal notes

- **Record the second take, not the first.** The first one finds where you ramble.
- **Have the tabs open already.** Watching a page load is four dead seconds.
- **The `DROP TABLE` refusal is the ending.** Stop talking and let it show. Trying
  to add a closing sentence is what pushes this over ninety.
- If you run long, cut the P3 beat first — it's the one that survives being read
  about instead of watched.

Put the link in the README under **Live demo**, beside the URL.

---

## 4 — The three-minute test

Hand the URL to someone with no healthcare or data background. Three minutes. No
explanation from you, and don't sit next to them narrating.

Then ask them to explain it back.

**Pass:** they can say what it does and why the middle part matters, without using
the word "pipeline".

**If they can't**, it's a P1 problem, not a P4 problem. The usual fix is one
clearer sentence at the top — not more content. Resist adding a paragraph.

Worth listening for specifically: do they understand that the **twenty-one
never-tested patients** are the point? That's the finding the whole project turns
on. If it reads as a technical detail rather than the headline, P1 is burying it.

---

## Already done

For completeness, so nothing gets re-checked: all seven days' tasks apart from
the four above, every V-number validation that doesn't need a human, both cohort
definitions, all twelve decisions, the Metrics sheet, the DQ Matrix, and a clean
clone verified end to end — jar download included — producing identical numbers
in 180 seconds.
