/**
 * The patient workspace's summaries, against the record they summarise.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { a1cSummary, insulinDoc, testsPerYear } from "./patientDetail.ts";

const load = (f: string) =>
  JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));
const rows = load("care_gap_full.json");
const detail = load("patient_detail.json");

test("every patient in the report has a detail record", () => {
  for (const r of rows) assert.ok(detail[r.patient_id], r.patient_id);
});

test("the pipeline's on_insulin agrees with an active insulin row in the history", () => {
  // on_insulin is computed in Gold; the medication list in publish. If they
  // disagreed, the workspace header and its Medications tab would contradict.
  for (const r of rows) {
    const active = detail[r.patient_id].meds.some((m: { insulin: boolean; ended: string | null }) => m.insulin && !m.ended);
    assert.equal(Boolean(r.on_insulin), active, r.patient_id);
  }
});

test("insulin documentation never claims more than the data", () => {
  const docs = rows.map((r: { on_insulin: boolean; patient_id: string }) => insulinDoc(r.on_insulin, detail[r.patient_id].meds));
  assert.ok(docs.includes("active") && docs.includes("past") && docs.includes("none"));
  assert.equal(insulinDoc(false, null), "unknown", "not loaded yet is not 'none'");
  assert.equal(insulinDoc(true, null), "active");
});

test("the A1c summary is the series' own last and second-last points", () => {
  for (const r of rows) {
    const a1c = detail[r.patient_id].a1c;
    const s = a1cSummary(a1c);
    if (r.last_a1c_date === null) {
      assert.equal(s, null, `${r.patient_id} never tested has no series`);
      continue;
    }
    assert.ok(s, r.patient_id);
    assert.equal(s.latest.d, r.last_a1c_date, `${r.patient_id} latest date matches Gold`);
    assert.equal(s.latest.v, r.last_a1c_value, `${r.patient_id} latest value matches Gold`);
    assert.equal(s.count, a1c.length);
  }
});

test("tests per year draws the empty years", () => {
  const perYear = testsPerYear([{ d: "2019-03-01", v: 7 }, { d: "2022-05-01", v: 8 }]);
  assert.deepEqual(perYear.map((y) => y.year), ["2019", "2020", "2021", "2022"]);
  assert.deepEqual(perYear.map((y) => y.tests), [1, 0, 0, 1]);
  assert.deepEqual(testsPerYear([]), []);
});

import { cohortTestsByYear } from "./patientDetail.ts";

test("cohort testing by year counts every result once and keeps empty years", () => {
  const { years, first, last } = cohortTestsByYear(detail);
  const total = Object.values(detail).reduce((n: number, d) => n + (d as { a1c: unknown[] }).a1c.length, 0);
  assert.equal(years.reduce((n, y) => n + y.tests, 0), total);
  assert.equal(years[0].year, first!.slice(0, 4));
  assert.equal(years.at(-1)!.year, last!.slice(0, 4));
  for (let i = 1; i < years.length; i++) assert.equal(Number(years[i].year), Number(years[i - 1].year) + 1, "no year skipped");
  for (const y of years) assert.ok(y.patients <= y.tests && y.patients <= rows.length, y.year);
  const gap = cohortTestsByYear({ a: { a1c: [{ d: "2018-01-01", v: 7 }, { d: "2021-01-01", v: 7 }], meds: [], procs: [] } });
  assert.deepEqual(gap.years.map((y) => y.tests), [1, 0, 0, 1]);
  assert.deepEqual(cohortTestsByYear({}).years, []);
});
