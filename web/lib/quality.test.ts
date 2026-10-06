import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { AUDIT, checkSummary, gapDrift, monthsAfter, qualityChecks, reconciliation, ruleSaysGap } from "./quality.ts";

const load = (f: string) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));
const rows = load("care_gap_full.json");
const gold = load("gold_report.json");
const dq = load("dq_report.json");

test("reconciliation: 116 = 91 + 25 and 25 = 21 + 4, from the shared summary", () => {
  const r = reconciliation(rows, gold.asof);
  assert.deepEqual([r.s.total, r.s.current, r.s.openGaps, r.s.neverTested, r.s.gapPreviouslyTested], [116, 91, 25, 21, 4]);
  assert.ok(r.totalOk && r.gapsOk);
  assert.deepEqual(r.shares, { current: "78.4%", gap: "21.6%", never: "84.0%", overdue: "16.0%" });
});

test("the boundary: exactly 365 days is current, 366 is overdue, no result is a gap", () => {
  assert.equal(ruleSaysGap("2025-08-23", "2026-08-23", 365), false, "365 days");
  assert.equal(ruleSaysGap("2025-08-22", "2026-08-23", 365), true, "366 days");
  assert.equal(ruleSaysGap(null, "2026-08-23", 365), true);
  assert.equal(ruleSaysGap("2024-08-23", "2025-08-23", 365), false, "across a non-leap year");
});

test("every exported flag agrees with the written rule", () => {
  for (const r of rows) assert.equal(r.gap_flag, ruleSaysGap(r.last_a1c_date, gold.asof, gold.gap_days), r.patient_id);
});

test("drift: same data, later dates, more gaps - reproducible", () => {
  const d = gapDrift(rows, gold.asof, gold.gap_days);
  assert.equal(d[0].gaps, gold.open_gaps, "today matches the report");
  assert.deepEqual(d.map((x) => x.gaps), [25, 29, 37, 50, 74, 116]);
  for (let i = 1; i < d.length; i++) assert.ok(d[i].gaps >= d[i - 1].gaps, "never falls");
  assert.equal(monthsAfter("2026-08-23", 6), "2027-02-23");
});

test("checks: real results, honest statuses, a summary that adds up", () => {
  const checks = qualityChecks(rows, gold, dq);
  const s = checkSummary(checks);
  assert.equal(s.passed + s.warnings + s.info + s.notEvaluated, s.total);
  assert.equal(s.evaluated, s.total - s.notEvaluated);
  assert.equal(new Set(checks.map((c) => c.id)).size, checks.length, "unique ids");
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
  for (const id of ["G1", "G2", "M1", "M2", "M3", "M4", "M6", "M7", "P1", "P2", "C1", "C2", "D1", "D2", "A1"]) {
    assert.equal(byId[id].status, "passed", `${id}: ${byId[id].result}`);
  }
  assert.equal(byId.A2.status, "warning", "13 latest values below 3.0%");
  assert.match(byId.A2.result, /^13 /);
  assert.equal(byId.R2.status, "warning");
  assert.equal(byId.R3.status, "not-evaluated");
  assert.equal(byId.C3.status, "warning");
  assert.equal(AUDIT.everCoded - AUDIT.deceasedByAsof, gold.cohort);
  assert.equal(AUDIT.rawA1cTotal - gold.a1c_clean_below_3, AUDIT.rawA1cPassingOldFloor, "951 + 7,990 = 8,941");
});
