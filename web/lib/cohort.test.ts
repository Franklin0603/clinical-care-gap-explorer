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

import {
  DIRECTORY_DEFAULTS, PATIENT_SORTS, cohortOptionCounts, filterPatients, readDirectory,
  sortPatients, writeDirectory,
} from "./cohort.ts";

const ALL = { ...NO_FILTERS } as const;

test("the directory's segments are views of one cohort", () => {
  const n = (status: "all" | "current" | "gap" | "never" | "overdue") =>
    filterPatients(rows, { ...ALL, status }).length;
  assert.equal(n("all"), gold.cohort);
  assert.equal(n("current") + n("gap"), gold.cohort, "current and open gap partition the cohort");
  assert.equal(n("gap"), gold.open_gaps);
  assert.equal(n("never") + n("overdue"), n("gap"), "never and overdue partition the gaps");
  assert.equal(n("never"), gold.never_tested);
});

test("Care Gaps and Patients agree on who matches", () => {
  // filterGaps is filterPatients over the gap rows; any filter combination
  // must give Care Gaps exactly the open-gap subset of what Patients shows.
  for (const insulin of ["all", "yes", "no"] as const) {
    for (const band of ["all", ...AGE_BANDS] as const) {
      const f = { ...ALL, insulin, band };
      assert.deepEqual(
        filterGaps(rows, f).map((r) => r.patient_id),
        filterPatients(rows, { ...f, status: "gap" }).map((r) => r.patient_id),
        `${insulin} ${band}`,
      );
    }
  }
});

test("filters combine, and the option counts match what they would leave", () => {
  const f = { ...ALL, status: "current" as const, band: "45-64" as const };
  const counts = cohortOptionCounts(rows, f, "insulin", ["yes", "no"]);
  assert.equal(counts.get("yes")! + counts.get("no")!, filterPatients(rows, f).length);
  assert.equal(counts.get("yes"), filterPatients(rows, { ...f, insulin: "yes" }).length);
});

test("the default sort is neutral: MRN order, not priority", () => {
  const byMrn = sortPatients(rows, "mrn").map((r) => String(r.mrn));
  assert.deepEqual(byMrn, [...byMrn].sort((a, b) => a.localeCompare(b)));
  assert.equal(DIRECTORY_DEFAULTS.sort, "mrn");
});

test("every sort keeps everyone, puts missing values last, and is deterministic", () => {
  for (const by of Object.keys(PATIENT_SORTS) as (keyof typeof PATIENT_SORTS)[]) {
    const a = sortPatients(rows, by), b = sortPatients([...rows].reverse(), by);
    assert.equal(a.length, rows.length, by);
    assert.deepEqual(a.map((r) => r.patient_id), b.map((r) => r.patient_id), `${by} deterministic`);
  }
  const a1c = sortPatients(rows, "a1c-high");
  const firstNull = a1c.findIndex((r) => lastA1cValue(r) === null);
  assert.ok(a1c.slice(firstNull).every((r) => lastA1cValue(r) === null), "no result sorts last");
  const od = sortPatients(rows, "overdue");
  assert.equal(daysOverdue(od[0]), Math.max(...rows.map((r: Parameters<typeof daysOverdue>[0]) => daysOverdue(r) ?? -1)));
  const st = sortPatients(rows, "status").map((r) => gapStatus(r));
  assert.equal(st.indexOf("current"), gold.open_gaps, "gaps first, then current");
});

test("directory state survives a round trip through the URL", () => {
  const s = { ...DIRECTORY_DEFAULTS, status: "overdue" as const, setting: "ambulatory",
              band: "65-75" as const, insulin: "no" as const, query: "bc50", sort: "age" as const, page: 2 };
  assert.deepEqual(readDirectory(new URLSearchParams(writeDirectory(s))), s);
  assert.equal(writeDirectory(DIRECTORY_DEFAULTS), "", "defaults stay out of the address");
  const junk = readDirectory(new URLSearchParams("status=bogus&sort=risk&age=99&page=-3"));
  assert.deepEqual(junk, DIRECTORY_DEFAULTS, "unknown values fall back to defaults");
});

import { gapsSeenWithin, monitoringByAgeBand, monitoringBySetting, pct1, pctText } from "./cohort.ts";

test("analytics breakdowns reconcile with the cohort and with Home", () => {
  for (const groups of [monitoringByAgeBand(rows), monitoringBySetting(rows)]) {
    const sum = (k: "total" | "current" | "gaps" | "never" | "overdue") => groups.reduce((n, g) => n + g[k], 0);
    assert.equal(sum("total"), summary.total);
    assert.equal(sum("current"), summary.current);
    assert.equal(sum("gaps"), summary.openGaps);
    assert.equal(sum("never"), summary.neverTested);
    assert.equal(sum("overdue"), summary.gapPreviouslyTested);
    for (const g of groups) {
      assert.equal(g.current + g.gaps, g.total, g.key);
      assert.equal(g.never + g.overdue, g.gaps, g.key);
      assert.equal(g.gapRate, pct1(g.gaps, g.total), g.key);
    }
  }
  // Age bands are the same numbers Home's chart and the pipeline report.
  assert.deepEqual(
    monitoringByAgeBand(rows).map((g) => ({ band: g.key, patients: g.total, gaps: g.gaps })),
    goldBands,
  );
  const settings = monitoringBySetting(rows);
  assert.ok(settings.every((g, i) => i === 0 || settings[i - 1].total >= g.total), "largest first");
});

test("percentages always carry one decimal", () => {
  assert.equal(pctText(1, 5), "20.0%");
  assert.equal(pctText(25, 116), "21.6%");
  assert.equal(pctText(21, 25), "84.0%");
  assert.equal(pctText(0, 0), "0.0%");
});

test("recently seen open gaps are a subset of open gaps", () => {
  const six = gapsSeenWithin(rows, gold.asof, 6);
  assert.ok(six <= gold.open_gaps);
  assert.ok(gapsSeenWithin(rows, gold.asof, 1200) === gold.open_gaps, "everyone was seen at some point");
  assert.ok(gapsSeenWithin(rows, gold.asof, 1) <= six);
});

import { latestA1cDistribution } from "./cohort.ts";

test("the A1c distribution places every recorded result once and no missing one", () => {
  const d = latestA1cDistribution(rows);
  assert.equal(d.bins.reduce((n, b) => n + b.n, 0), d.withResult);
  assert.equal(d.withResult + d.without, gold.cohort);
  assert.equal(d.without, gold.never_tested, "no result = never tested, the same 21");
  for (let i = 1; i < d.bins.length; i++) assert.equal(d.bins[i].lo, d.bins[i - 1].lo + 1, "contiguous one-point ranges");
  assert.deepEqual(latestA1cDistribution([]), { bins: [], withResult: 0, without: 0 });
});
