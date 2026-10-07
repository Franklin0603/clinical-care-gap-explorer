/**
 * Ask AI against the numbers every other page shows. The expected values
 * come from the gold report and the shared cohort functions, not from
 * literals, except where the brief names them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { Answer, Block, Ctx, Data } from "./engine.ts";
import { answer } from "./engine.ts";

const load = (f: string) => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf8"));
const rows = load("care_gap_full.json");
const gold = load("gold_report.json");
const history = load("patient_detail.json");
const data: Data = { rows, asof: gold.asof };

/** Run a conversation, returning each answer. */
function chat(...qs: string[]): Answer[] {
  let ctx: Ctx = {};
  const out: Answer[] = [];
  for (const q of qs) {
    let r = answer(q, ctx, data);
    if ("needs" in r) r = answer(q, ctx, { ...data, history });
    assert.ok(!("needs" in r));
    out.push(r as Answer);
    ctx = (r as Answer).ctx;
  }
  return out;
}
const metric = (a: Answer) => a.blocks.find((b): b is Extract<Block, { kind: "metric" }> => b.kind === "metric");
const kinds = (a: Answer) => a.blocks.map((b) => b.kind);
const text = (a: Answer) => JSON.stringify(a.blocks);

test("validation: the headline numbers", () => {
  assert.equal(metric(chat("How many patients are in the cohort?")[0])!.value, String(gold.cohort));
  assert.equal(metric(chat("How many currently have an open A1C gap?")[0])!.value, String(gold.open_gaps));
  assert.equal(metric(chat("How many open gaps have never been tested?")[0])!.value, String(gold.never_tested));
  assert.equal(metric(chat("What percentage of the cohort is current?")[0])!.value, "78.4%");
  assert.equal(metric(chat("How many patients are overdue?")[0])!.value, String(gold.open_gaps - gold.never_tested));
});

test("validation: \"never-tested\" with a hyphen means never tested, not everyone", () => {
  for (const q of ["Show me never-tested patients.", "List the never-tested patients", "Which patients have never been tested?"]) {
    const a = chat(q)[0];
    assert.equal(metric(a)!.value, String(gold.never_tested), q);
    const list = a.blocks.find((b): b is Extract<Block, { kind: "patients" }> => b.kind === "patients")!;
    assert.equal(list.ids.length, gold.never_tested, q);
  }
  const how = chat("Show me never-tested patients.", "How did you calculate this?")[1];
  assert.match(text(how), new RegExp(`${gold.never_tested} patients`));
});

test("validation: age band with the highest gap rate is 45-64, 15 of 51", () => {
  const a = chat("Which age group has the highest observed gap rate?")[0];
  const m = metric(a)!;
  assert.equal(m.value, "29.4%");
  assert.match(m.label, /45–64/);
  assert.match(m.detail!, /15 of 51/);
  assert.ok(kinds(a).includes("groups"));
  assert.match(text(a), /18–44 \(1 of 5\)/, "the small band is named with its denominator");
  assert.equal(a.title, "Gap rate by age band");
});

test("validation: care setting keeps denominators and does not crown a 1-of-1 group", () => {
  const a = chat("Which care setting has the highest gap rate?")[0];
  const m = metric(a)!;
  assert.match(m.label, /Outpatient/);
  assert.match(m.label, /10\+ patients/);
  assert.match(m.detail!, /7 of 17/);
  const lim = a.blocks.find((b) => b.kind === "limitation");
  assert.ok(lim && /Skilled nursing shows 100\.0%, but that is 1 of 1/.test(JSON.stringify(lim)));
});

test("never tested: count and list, with the evidence-aware wording", () => {
  const [a] = chat("Which patients have never had an A1C?");
  assert.equal(metric(a)!.value, String(gold.never_tested));
  const list = a.blocks.find((b) => b.kind === "patients") as { ids: string[] };
  assert.equal(list.ids.length, gold.never_tested);
  for (const id of list.ids) assert.equal(rows.find((r: { patient_id: string }) => r.patient_id === id).last_a1c_date, null);
  assert.match(text(a), /no A1C result appears in the available data/);
  assert.match(text(a), /\/care-gaps\?status=never/);
  assert.equal(a.title, "Never-tested patients");
});

test("follow-ups narrow the previous population", () => {
  const [, b] = chat("Which age group has the highest gap rate?", "How many of them were seen recently?");
  const m = metric(b)!;
  const band = rows.filter((r: { age: number }) => r.age >= 45 && r.age <= 64);
  const seen = band.filter((r: { last_encounter_date: string }) => r.last_encounter_date >= "2026-02-23");
  assert.equal(m.value, String(seen.length));
  assert.match(m.detail!, /Of 51 patients aged 45–64/);
  assert.match(text(b), /Of the 15 with an open A1C gap/);

  const [, c, d] = chat("How many patients have an open gap?", "Show them", "Which of them were seen in the last 6 months?");
  assert.equal((c.blocks.find((x) => x.kind === "patients") as { ids: string[] }).ids.length, gold.open_gaps);
  assert.equal(metric(d)!.value, "24", "matches Analytics: 24 of 25 seen in six months");
});

test("the brief's example prompt", () => {
  const [a] = chat("Show patients with an open gap who were seen in the last 6 months.");
  assert.equal(metric(a)!.value, "24");
  assert.ok(kinds(a).includes("patients"));
});

test("SQL and method only on request, and they describe the last answer", () => {
  const [a, b, c] = chat("How many patients have never been tested?", "How did you calculate this?", "Show me the SQL");
  assert.ok(!kinds(a).includes("sql"), "no SQL by default");
  assert.ok(kinds(b).includes("method"));
  assert.match(text(b), /Never tested: no A1C result anywhere/);
  const sql = c.blocks.find((x) => x.kind === "sql") as { sql: string };
  assert.match(sql.sql, /last_a1c_date IS NULL/);
  assert.equal(chat("Show me the SQL")[0].blocks[0].kind, "text", "nothing to show before a question");
});

test("limitations: orders, dose, advice, risk", () => {
  const lim = (q: string) => { const [a] = chat(q); assert.equal(a.blocks[0].kind, "limitation", q); return text(a); };
  assert.match(lim("Which patients had an A1C ordered but never completed it?"), /does not contain an orders table/);
  assert.match(lim("What insulin dose is this patient taking?"), /does not contain confirmed medication dose/);
  assert.match(lim("What should we prescribe for patient bc501e5b?"), /can't give clinical advice/);
  assert.match(lim("Who is the highest risk patient?"), /no risk or urgency score/);
  assert.match(lim("How many patients are uncontrolled?"), /not whether results are at goal/);
});

test("a patient by MRN, and a dose follow-up about them", () => {
  const [a, b] = chat("Tell me about bc501e5b", "What insulin dose is this patient taking?");
  assert.ok(kinds(a).includes("patient"));
  assert.match(text(a), /2,175 days past due/);
  assert.match(text(a), /\/patients\/bc501e5b/);
  assert.match(text(b), /not doses/);
});

test("testing over time asks for the history, then answers with partial years named", () => {
  assert.deepEqual(answer("How has A1C testing changed over time?", {}, data), { needs: "history" });
  const [a] = chat("How has A1C testing changed over time?");
  assert.equal(metric(a)!.value, "3,392");
  const y = a.blocks.find((b) => b.kind === "years") as { partial: string[]; rows: { tests: number }[] };
  assert.deepEqual(y.partial, ["2016", "2026"]);
  assert.match(text(a), /partial years/);
});

test("an unanswerable question gets an honest refusal, not a number", () => {
  const [a] = chat("What's the weather in Boston?");
  assert.ok(!kinds(a).includes("metric"));
  assert.match(text(a), /can't answer that/);
});

test("statements that change data are refused, not read as questions", () => {
  for (const q of ["DELETE FROM patients", "drop table patients", "UPDATE patients SET gap_flag = false"]) {
    const [a] = chat(q);
    assert.equal(a.blocks[0].kind, "limitation", q);
    assert.ok(!kinds(a).includes("metric"), q);
    assert.match(text(a), /read-only/);
  }
});

test("wording: whole cohort, percentages, and re-showing a follow-up keeps its denominator", () => {
  const [a] = chat("How many patients are in the cohort?");
  assert.equal(metric(a)!.label, "patients in the diabetes cohort");
  assert.ok(!/100\.0%/.test(metric(a)!.detail!));
  assert.equal(metric(chat("What percentage of the cohort is current?")[0])!.label, "of the cohort are current patients");
  const [, , c] = chat("How many patients have an open gap?", "How many of them were seen in the last 6 months?", "Show them");
  assert.match(metric(c)!.detail!, /Of 25 patients with an open A1C gap/);
});

test("phase 8.1: the brief's context chain keeps its reference", () => {
  const [a, b, c] = chat(
    "Which age group has the highest gap rate?",
    "How many of them were seen in the last 6 months?",
    "How many of those have an open gap?",
  );
  assert.match(metric(a)!.label, /45–64/);
  assert.match(metric(a)!.detail!, /15 of 51/);
  assert.equal(metric(a)!.value, "29.4%");
  // "them" = patients aged 45-64.
  const band = rows.filter((r: { age: number }) => r.age >= 45 && r.age <= 64);
  const seen = band.filter((r: { last_encounter_date: string }) => r.last_encounter_date >= "2026-02-23");
  assert.equal(metric(b)!.value, String(seen.length));
  assert.match(metric(b)!.label, /aged 45–64, seen in the last 6 months/);
  // "those" = that seen-recently 45-64 group; now narrowed to open gaps.
  const gapSeen = seen.filter((r: { gap_flag: boolean }) => r.gap_flag);
  assert.equal(metric(c)!.value, String(gapSeen.length));
  assert.match(metric(c)!.label, /open A1C gap aged 45–64, seen in the last 6 months/);
  assert.match(metric(c)!.detail!, new RegExp(`Of ${seen.length} patients aged 45–64`));
});

test("phase 8.1: SQL on request says it was not executed", () => {
  const [, sql] = chat("How many patients have never been tested?", "Show me the SQL");
  assert.match(text(sql), /equivalent representation, not the query that was run/);
  assert.match(text(sql), /Not executed to produce the answer/);
  const [, , ySql] = chat("How has A1C testing changed over time?", "How did you calculate this?", "Show me the SQL");
  assert.match(text(ySql), /does not load/);
});
