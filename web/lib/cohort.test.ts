/**
 * The dashboard's numbers against the pipeline's own.
 *
 * Home derives its figures from the exported rows. gold_report.json is the
 * pipeline's independent account of the same figures, computed in SQL. If the
 * two ever disagree, one of them has a bug, and a care team would be looking at
 * a number that the warehouse does not back up. This is the check that they
 * agree - not a snapshot of 116 and 25, which would go stale on the next seed.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { AGE_BANDS, ageBand, cohortSummary, gapStatus, gapsByAgeBand, needingAttention } from "./cohort.ts";
import { longDate } from "./dates.ts";

const load = (f: string) =>
  JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));

const rows = load("care_gap_full.json");
const gold = load("gold_report.json");
const goldBands = load("age_bands.json");
const summary = cohortSummary(rows, gold.asof);

test("the summary matches the gold report, figure by figure", () => {
  assert.equal(summary.total, gold.cohort, "cohort size");
  assert.equal(summary.openGaps, gold.open_gaps, "open gaps");
  assert.equal(summary.neverTested, gold.never_tested, "never tested");
  assert.equal(summary.gapRatePct, gold.gap_rate_pct, "gap rate");
  assert.equal(summary.dueWithin90, gold.due_within_90_days, "due within 90 days");
});

test("the three monitoring states partition the cohort exactly once", () => {
  // The status chart draws these as parts of one whole, so a patient in two
  // buckets, or in none, would be a chart that lies.
  assert.equal(summary.current + summary.gapPreviouslyTested + summary.neverTested, summary.total);
  const counts = { current: 0, overdue: 0, never: 0 };
  for (const r of rows) counts[gapStatus(r)]++;
  assert.deepEqual(counts, {
    current: summary.current, overdue: summary.gapPreviouslyTested, never: summary.neverTested,
  });
});

test("never tested is a subset of open gaps, not a separate bucket", () => {
  for (const r of rows) if (gapStatus(r) === "never") assert.equal(r.gap_flag, true, r.mrn);
});

test("the worklist is open gaps only, in the pipeline's priority order", () => {
  const top = needingAttention(rows, 5);
  assert.equal(top.length, 5);
  assert.ok(top.every((r) => r.gap_flag === true));
  const ranks = top.map((r) => Number(r.priority));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  assert.equal(ranks[0], 1, "starts at the top of the pipeline's ranking");
  assert.equal(needingAttention(rows, 999).length, gold.open_gaps, "and contains every gap");
});

test("age bands cover everyone once, at the measure's boundaries", () => {
  const bands = gapsByAgeBand(rows);
  assert.deepEqual(bands.map((b) => b.band), [...AGE_BANDS]);
  assert.deepEqual(bands, goldBands, "the pipeline's own age_bands.json");
  assert.equal(bands.reduce((n, b) => n + b.patients, 0), gold.cohort);
  assert.equal(bands.reduce((n, b) => n + b.gaps, 0), gold.open_gaps);
  for (const [age, band] of [[44, "18-44"], [45, "45-64"], [64, "45-64"], [65, "65-75"],
                             [75, "65-75"], [76, "76+"]] as const) {
    assert.equal(ageBand(age), band, `age ${age}`);
  }
});

test("an empty cohort gives zeros, not NaN", () => {
  // The empty states on Home depend on this: a 0/0 gap rate would render "NaN%".
  const empty = cohortSummary([], gold.asof);
  assert.deepEqual(empty, {
    total: 0, openGaps: 0, neverTested: 0, gapPreviouslyTested: 0,
    current: 0, dueWithin90: 0, gapRatePct: 0,
  });
  assert.deepEqual(needingAttention([], 5), []);
  assert.ok(gapsByAgeBand([]).every((b) => b.patients === 0 && b.gaps === 0));
});

test("dates format without a timezone shift", () => {
  assert.equal(longDate("2026-08-23"), "Aug 23, 2026");
  assert.equal(longDate("2026-01-01"), "Jan 1, 2026");
  assert.equal(longDate(null), null);
});

import { NO_FILTERS, daysOverdue, filterGaps, lastA1cValue, optionCounts, settingLabel, sortGaps } from "./cohort.ts";

test("the queue holds every open gap and nothing else", () => {
  const all = filterGaps(rows, NO_FILTERS);
  assert.equal(all.length, gold.open_gaps);
  assert.equal(filterGaps(rows, { ...NO_FILTERS, status: "never" }).length, gold.never_tested);
  assert.equal(filterGaps(rows, { ...NO_FILTERS, status: "overdue" }).length, gold.open_gaps - gold.never_tested);
});

test("each filter narrows, and the option counts add back up", () => {
  const settings = [...new Set(filterGaps(rows, NO_FILTERS).map((r) => String(r.unit)))];
  const bySetting = optionCounts(rows, NO_FILTERS, "setting", settings);
  assert.equal([...bySetting.values()].reduce((a, b) => a + b, 0), gold.open_gaps);
  const byBand = optionCounts(rows, NO_FILTERS, "band", [...AGE_BANDS]);
  assert.equal([...byBand.values()].reduce((a, b) => a + b, 0), gold.open_gaps);
  const byInsulin = optionCounts(rows, NO_FILTERS, "insulin", ["yes", "no"]);
  assert.equal(byInsulin.get("yes")! + byInsulin.get("no")!, gold.open_gaps);
});

test("search matches the start of an MRN, case and spaces ignored", () => {
  const first = String(needingAttention(rows, 1)[0].mrn);
  const hit = filterGaps(rows, { ...NO_FILTERS, query: `  ${first.slice(0, 8).toUpperCase()} ` });
  assert.deepEqual(hit.map((r) => r.mrn), [first]);
  assert.equal(filterGaps(rows, { ...NO_FILTERS, query: "zzzz" }).length, 0);
});

test("sorting reorders without losing anyone, and priority matches Home", () => {
  const gaps = filterGaps(rows, NO_FILTERS);
  for (const by of ["priority", "seen-recent", "seen-oldest"] as const) {
    assert.equal(sortGaps(gaps, by).length, gaps.length, by);
  }
  assert.deepEqual(
    sortGaps(gaps, "priority").slice(0, 5).map((r) => r.patient_id),
    needingAttention(rows, 5).map((r) => r.patient_id),
  );
  const recent = sortGaps(gaps, "seen-recent").map((r) => String(r.last_encounter_date));
  assert.deepEqual(recent, [...recent].sort().reverse());
  // Same order whatever order the rows arrive in, so ties never shuffle.
  for (const by of ["priority", "seen-recent", "seen-oldest"] as const) {
    assert.deepEqual(sortGaps([...gaps].reverse(), by).map((r) => r.patient_id),
                     sortGaps(gaps, by).map((r) => r.patient_id), `${by} is deterministic`);
  }
});

test("care settings read as words", () => {
  assert.equal(settingLabel("snf"), "Skilled nursing");
  assert.equal(settingLabel("urgentcare"), "Urgent care");
  assert.equal(settingLabel("somewhere-new"), "somewhere-new");
  assert.equal(settingLabel(null), "Unknown");
});

test("a missing result stays missing, never a zero", () => {
  for (const r of rows) {
    if (gapStatus(r) === "never") {
      assert.equal(lastA1cValue(r), null, r.mrn);
      assert.equal(daysOverdue(r), null, r.mrn);
    }
  }
  assert.equal(lastA1cValue({ last_a1c_value: null }), null);
  assert.equal(lastA1cValue({ last_a1c_value: 7.2 }), 7.2);
  assert.equal(daysOverdue({ days_overdue: 0 }), 0, "a real zero survives");
});
