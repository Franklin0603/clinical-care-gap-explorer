# Day 7 — Ask It Anything, Then Ship

**~3 hours · Tracker IDs 7.1 – 7.11**

## Why today exists

P4 turns a natural-language question into SQL over the Gold tables, shows the
generated SQL above every answer, and refuses anything that isn't a single
SELECT. Then you fill the README, sweep for errors, deploy, and record the Loom.

P4 is last because it's the most cuttable. If earlier days ran long, this is the
page that shrinks — ten working chips and no free-text box still demonstrates the
idea.

Two things today are not optional:

- **The generated SQL is always visible.** It's what makes the answer auditable
  instead of magic.
- **Five deliberately bad questions return five clean sentences.** That's an
  explicit success criterion in the PRD, and it's the thing a reviewer will
  actually try.

## Learning objectives

By tonight you should be able to say, without notes:

- How you stop the model inventing a table that doesn't exist — and what happens
  when it does anyway
- Why an allowlist beats blocking dangerous keywords
- Why "I can't answer that, but here's what I can" beats a wrong answer

---

## Tasks

### 7.1 — Ten preset question chips

Chips are the demo path. Someone with thirty seconds clicks a chip — make those
ten your best answers.

Cover the range: the headline gap count, the never-tested subgroup, breakdown by
age, something about the data quality layer, something a role can't see.

### 7.2 — Natural language to SQL over Gold

Scope it to the Gold tables only. Small schema, better accuracy, and quarantined
data can't leak into an answer.

Pass the schema in the prompt. Use a current Claude model — if you're unsure
which, ask me and I'll check the current model IDs rather than guessing from
memory.

**Look this up:** text-to-SQL prompting, passing schema as context, tool use vs
plain completion, structured outputs

### 7.3 — Show the SQL above every answer

Chip answers and free-text answers alike. Non-negotiable per the PRD.

### 7.4 — SELECT-only enforcement

FR5. Reject anything that isn't a single SELECT statement.

**Assume hostile input.** A reviewer *will* try to drop a table — that's the fun
part of a demo like this, and they'll be pleased when it refuses properly.

Think about layers: an allowlist on the parsed statement type beats a blocklist
of scary words (`DROP` appears innocently inside a string literal; `DELETE`
spelled with a comment in the middle defeats a regex). A read-only database
connection underneath means even a bypass can't do damage.

**Look this up:** SQL injection, allowlist vs blocklist validation, parsing vs
regex, read-only connections, stacked queries

### 7.5 — Five adversarial questions

Try, at minimum:

1. An out-of-scope clinical question ("what should this patient's insulin dose be?")
2. A request for a field no role can see
3. A destructive statement ("drop the patients table")
4. Gibberish
5. A question about data that isn't in Gold ("what did the doctor write in the note?")

Each must return **one plain sentence** naming what the tool *can* answer. FR6.

Number 5 matters more than it looks — clinical notes are an explicit non-goal in
the PRD, so the honest refusal is also a statement about scope.

### 7.6 — Audit log

`role, question, generated_sql, row_count, run_at`. Surface it on P2.

Access logging is a real requirement in clinical systems and costs you almost
nothing to show.

**Look this up:** audit controls in clinical systems

### 7.7 — Error sweep

Click through all four pages trying to break them. No stack trace may be
reachable. G4 and FR6.

**Look this up:** React error boundaries, Next.js error handling

### 7.8 — Fill the README

Every blank in `README_TEMPLATE.md`, from the Metrics and DQ Matrix sheets.

### 7.9 — "What I'd do differently at scale"

Both in the README and in `DATA_QUALITY_SPEC.md`.

**This is where a senior reviewer decides how you think.** Name specific tools
and specific trade-offs, not generalities. The spec itself suggests candidates:
running checks as a Great Expectations or dbt test suite instead of hand-rolled
Python; partitioning by load date; alerting on catch-rate drift rather than
absolute counts; making quarantine reprocessable.

Add what you actually hit this week. Real friction you encountered is more
convincing than a list of tools you've read about.

### 7.10 — Final deploy, then the Loom

Ninety seconds. Script it: the question, the dirty data, the catch rate, the role
switch. Rehearse once — ninety seconds is shorter than it sounds.

### 7.11 — The three-minute test

Show it to a non-technical person. Can they explain what it does afterwards?

---

## Validation

### V7.1 — The five bad questions
**Check:** run all five from 7.5 against the deployed app
**Expect:** five plain sentences, each naming what the tool *can* answer. Zero
stack traces. Zero wrong answers presented confidently.
**If it fails:** this is an explicit PRD success criterion — fix before shipping.

### V7.2 — Destructive statements are refused
**Check:** try `DROP TABLE patients`, `DELETE FROM care_gap_a1c`,
`SELECT 1; DROP TABLE patients`, and a question phrased to *ask* for deletion
rather than stating it
**Expect:** all refused, including the stacked statement
**If it fails:** the stacked one is the interesting failure — a check that
validates only the first statement passes it. That's exactly the bug an
allowlist-on-parse avoids and a regex doesn't.

### V7.3 — SQL is visible on every answer
**Check:** click three chips and ask two free-text questions
**Expect:** generated SQL shown above all five
**If it fails:** usually the chips take a shortcut path that skips the display.

### V7.4 — The SQL shown is the SQL that ran
**Check:** copy the displayed SQL, run it yourself against Gold, compare results
**Expect:** identical
**If it fails:** you're displaying the model's output but executing something
modified. That's worse than showing nothing — it's showing something untrue.

### V7.5 — Hallucinated tables fail gracefully
**Check:** ask for something plausible but absent — "how many patients had a
colonoscopy?"
**Expect:** either an honest refusal, or a SQL error caught and returned as a
sentence. Never a raw exception.
**If it fails:** the model will invent table names; that's expected. What
matters is what your app does next.

### V7.6 — Answers are actually correct
**Check:** for the three chips whose answers you can verify from the Metrics
sheet, compare
**Expect:** exact match
**If it fails:** a confidently wrong number is the worst outcome on this page. If
a chip is unreliable, cut it — nine good chips beat ten with one liar.

### V7.7 — The audit log records everything
**Check:** ask three questions including a refused one, then look at the log
**Expect:** three rows with role, question, SQL (or null with a reason for the
refusal), row count, timestamp
**If it fails:** if refusals aren't logged, the log doesn't show what you'd
actually want in a clinical system — attempted access matters as much as
successful access.

### V7.8 — No stack trace anywhere
**Check:** every page, bad routes, malformed params, and the chat with empty
input
**Expect:** human sentences throughout
**If it fails:** G4 says every failure path. One raw exception undoes a lot of
careful work.

### V7.9 — The README has no blanks left
**Check:** grep the README for `___`
**Expect:** none
**If it fails:** blanks read as abandoned. Most people read the README instead of
opening the app.

### V7.10 — README numbers match the live app
**Check:** compare the headline gap number, catch rate, and layer counts in the
README against the deployed pages
**Expect:** identical
**If it fails:** you regenerated data after writing the README. Pick the current
numbers and update both.

### V7.11 — Clean clone works
**Check:** clone your repo into a fresh directory and follow your own README's
"Run it" instructions exactly, as written
**Expect:** it works, with no step you had to remember
**If it fails:** this is what a reviewer experiences. An undocumented step is the
difference between "impressive" and "couldn't get it running."

### V7.12 — The Loom is under 90 seconds
**Check:** record it and time it
**Expect:** under 90 seconds, covering: the question, the dirty data, the catch
rate, the role switch
**If it fails:** cut the setup. Start with the headline number on screen, not
with explaining what Synthea is.

### V7.13 — The three-minute test
**Check:** a non-technical person, three minutes, then ask them to explain it
back
**Expect:** they can, without using the word "pipeline"
**If it fails:** it's a P1 problem, not a P4 problem.

### V7.14 — Final language sweep
**Check:** grep the whole repo for "HIPAA", "compliant", "compliance", "secure",
"production-ready", "real patient"
**Expect:** every hit is a sentence that qualifies or negates the claim
**If it fails:** fix before you share the link. This is the last chance.

---

## Ship gate — the project is done when

- [ ] Deployed at a public URL that works from a phone
- [ ] Five bad questions return five clean sentences (V7.1)
- [ ] Generated SQL shown on every answer, and it's the SQL that ran
- [ ] README states the catch rate and the architecture, with no blanks
- [ ] A clean clone runs from the README alone
- [ ] 90-second Loom recorded and linked
- [ ] A non-technical person can explain it after three minutes
- [ ] Learning Log has no scores of 3 or below left unaddressed

## Common ways Day 7 goes wrong

**You run out of time on P4** and ship a broken chat. Ten working chips and no
free-text box is a better outcome than a free-text box that errors.

**You show SQL but execute something else.** V7.4.

**A chip returns a wrong number** and nobody notices because it looks plausible.
Verify against the Metrics sheet.

**Blocklist filtering** that a stacked statement walks straight through.

**You leave the README blanks** because the app is the "real" deliverable. Most
people read the README and never open the app.

---

## After Day 7

Two things worth doing while it's fresh:

**Close your Learning Log gaps.** Anything rated 3 or below is a question you
can't currently answer out loud. Those are the questions you'll be asked.

**Write down the thing that surprised you.** Every project has one — a defect
that was harder to catch than expected, a join that fanned out, a decision you
changed halfway. That story is more memorable in an interview than any
architecture diagram, and you will forget it within a month if you don't write
it down now.
