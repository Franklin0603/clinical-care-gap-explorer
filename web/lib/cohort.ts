/**
 * Derived views of the care-gap cohort, for any page that needs them.
 *
 * Pure functions over the rows the pipeline exported: no imports at runtime,
 * so `node --test` can check them against gold_report.json, the pipeline's own
 * account of the same numbers. Nothing here re-implements the measure. Whether
 * a patient has a gap is `gap_flag`, decided in Gold; how urgent is `priority`,
 * also decided in Gold. These functions only count, partition and order what
 * the pipeline already decided.
 */

import type { PatientRow } from "./data";

/* ----------------------------------------------------------------- status */

/**
 * The three monitoring states, which are mutually exclusive.
 *
 *   current  an A1C within the last 365 days            (gap_flag false)
 *   overdue  a previous A1C, but not within 365 days     (gap_flag true)
 *   never    no A1C on file at all                       (gap_flag true)
 *
 * "Never tested" is a subset of "open gap", not a separate bucket beside it:
 * all 21 never-tested patients are among the 25 open gaps. A chart that showed
 * current / open gap / never tested as three slices of one whole would count
 * those 21 twice.
 */
export type GapStatus = "current" | "overdue" | "never";

export function gapStatus(r: PatientRow): GapStatus {
  if (r.last_a1c_date === null || r.last_a1c_date === undefined) return "never";
  return r.gap_flag ? "overdue" : "current";
}

/** The last A1C value, or null when there is none. Never 0: Number(null) is 0,
 *  and a 0% A1C reads as a result when the finding is that there is no result. */
export function lastA1cValue(r: PatientRow): number | null {
  if (r.last_a1c_value === null || r.last_a1c_value === undefined) return null;
  const v = Number(r.last_a1c_value);
  return Number.isFinite(v) ? v : null;
}

/** Days overdue exists only for a patient with an earlier result. The never
 *  tested have no due date to be late against, so this is null for them. */
export function daysOverdue(r: PatientRow): number | null {
  if (r.days_overdue === null || r.days_overdue === undefined) return null;
  const v = Number(r.days_overdue);
  return Number.isFinite(v) ? v : null;
}

/** The identifier shown for a patient: the first eight characters of the MRN.
 *  Synthetic data has no names, and none are invented. */
export const shortMrn = (r: PatientRow) => String(r.mrn).slice(0, 8);

/* ------------------------------------------------------------------ bands */

/** The HEDIS diabetes measure's boundaries (ADR-0011), not round decades. */
export const AGE_BANDS = ["18-44", "45-64", "65-75", "76+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export function ageBand(age: number): AgeBand {
  return age < 45 ? "18-44" : age < 65 ? "45-64" : age <= 75 ? "65-75" : "76+";
}

/* ---------------------------------------------------------------- summary */

const DAY = 86_400_000;

/** Whole days from one ISO date to another. Both parse as UTC midnight, so
 *  the difference is exact whatever zone the reader is in. */
function daysFrom(fromIso: string, toIso: string) {
  return Math.round((Date.parse(String(toIso).slice(0, 10)) - Date.parse(String(fromIso).slice(0, 10))) / DAY);
}

export type CohortSummary = {
  total: number;
  openGaps: number;
  neverTested: number;
  /** Open gap, with an earlier A1C on file. openGaps = this + neverTested. */
  gapPreviouslyTested: number;
  current: number;
  /** Current today, but next due within 90 days of the as-of date. */
  dueWithin90: number;
  /** One decimal place, as the gold report rounds it. 0 for an empty cohort. */
  gapRatePct: number;
};

export function cohortSummary(rows: PatientRow[], asof: string): CohortSummary {
  let openGaps = 0, neverTested = 0, current = 0, dueWithin90 = 0;
  for (const r of rows) {
    const s = gapStatus(r);
    if (s === "never") neverTested++;
    if (r.gap_flag) openGaps++;
    if (s === "current") {
      current++;
      if (r.next_due_date && daysFrom(asof, String(r.next_due_date)) <= 90) dueWithin90++;
    }
  }
  return {
    total: rows.length,
    openGaps,
    neverTested,
    gapPreviouslyTested: openGaps - neverTested,
    current,
    dueWithin90,
    gapRatePct: rows.length ? Math.round((openGaps / rows.length) * 1000) / 10 : 0,
  };
}

/* --------------------------------------------------------------- worklist */

/**
 * Open gaps in the pipeline's own priority order.
 *
 * `priority` is Gold's worklist rank: patients never tested first, because they
 * have no result at all, then the most overdue. It is used rather than sorting
 * by days overdue here, because that would be a second, competing ranking
 * written in the UI - and it would put the never-tested last, since they have
 * no days-overdue figure to sort on.
 */
export function needingAttention(rows: PatientRow[], limit = 5): PatientRow[] {
  return rows
    .filter((r) => r.gap_flag)
    .sort((a, b) => Number(a.priority ?? Infinity) - Number(b.priority ?? Infinity))
    .slice(0, limit);
}

/* ------------------------------------------------------------- breakdowns */

export type BandRow = { band: AgeBand; patients: number; gaps: number };

/** Patients and gaps per age band, all four bands present and in order. */
export function gapsByAgeBand(rows: PatientRow[]): BandRow[] {
  const out = new Map<AgeBand, BandRow>(
    AGE_BANDS.map((band) => [band, { band, patients: 0, gaps: 0 }]),
  );
  for (const r of rows) {
    const b = out.get(ageBand(Number(r.age)))!;
    b.patients += 1;
    if (r.gap_flag) b.gaps += 1;
  }
  return [...out.values()];
}

/* --------------------------------------------------------- care-gap queue */

/** The care setting of the patient's last encounter, as the data spells it,
 *  to the words a care team would use. Unknown values show as themselves. */
export const SETTING_LABELS: Record<string, string> = {
  ambulatory: "Ambulatory",
  outpatient: "Outpatient",
  wellness: "Wellness",
  urgentcare: "Urgent care",
  emergency: "Emergency",
  snf: "Skilled nursing",
  hospice: "Hospice",
  unknown: "Unknown",
};

export const settingLabel = (unit: unknown) =>
  unit === null || unit === undefined ? "Unknown" : SETTING_LABELS[String(unit)] ?? String(unit);

/**
 * Filters over the cohort, shared by Care Gaps and Patients so the two pages
 * cannot disagree about who matches.
 *
 *   status   all, current, gap (any open gap), never, overdue - views of the
 *            three monitoring states, never a fourth
 *   query    the start of the MRN, ignoring case and spaces
 *   setting  care setting of the last encounter, as the data spells it
 *   band     age band
 *   insulin  an insulin prescription active on the data date (on_insulin),
 *            documented or not. "Not documented" is not "not on insulin".
 */
export type StatusFilter = "all" | "current" | "gap" | "never" | "overdue";

export type PatientFilters = {
  status: StatusFilter;
  query: string;
  setting: string;
  band: AgeBand | "all";
  insulin: "all" | "yes" | "no";
};

/** Care Gaps' filters: the same, minus the statuses that mean "no gap". */
export type GapFilters = PatientFilters & { status: "all" | "never" | "overdue" };

export const NO_FILTERS: GapFilters = { status: "all", query: "", setting: "all", band: "all", insulin: "all" };

function matchesStatus(r: PatientRow, s: StatusFilter) {
  if (s === "all") return true;
  if (s === "gap") return Boolean(r.gap_flag);
  return gapStatus(r) === s;
}

/** Every patient, narrowed by every filter that is set. Filters that are not
 *  set ("all", or an empty search) do nothing. */
export function filterPatients(rows: PatientRow[], f: PatientFilters): PatientRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (!matchesStatus(r, f.status)) return false;
    if (q && !String(r.mrn).toLowerCase().startsWith(q)) return false;
    if (f.setting !== "all" && String(r.unit) !== f.setting) return false;
    if (f.band !== "all" && ageBand(Number(r.age)) !== f.band) return false;
    if (f.insulin !== "all" && Boolean(r.on_insulin) !== (f.insulin === "yes")) return false;
    return true;
  });
}

/** Open gaps only, narrowed the same way. */
export function filterGaps(rows: PatientRow[], f: GapFilters): PatientRow[] {
  return filterPatients(rows.filter((r) => r.gap_flag), f);
}

/**
 * Sort orders for the queue.
 *
 *   priority     the pipeline's rank (never tested first, then most overdue)
 *   seen-recent  last seen most recently first: still in contact, easiest to reach
 *   seen-oldest  last seen longest ago first: most at risk of being lost
 *
 * No "most overdue" order: 21 of the 25 have never been tested and so have no
 * days-overdue figure, and the four who do are already ordered that way within
 * priority. Every order ends on patient_id, so ties never shuffle.
 */
export type GapSort = "priority" | "seen-recent" | "seen-oldest";

export const GAP_SORTS: Record<GapSort, string> = {
  priority: "Priority",
  "seen-recent": "Recently seen",
  "seen-oldest": "Longest since seen",
};

export function sortGaps(rows: PatientRow[], by: GapSort): PatientRow[] {
  const seen = (r: PatientRow) => (r.last_encounter_date ? String(r.last_encounter_date) : "");
  const tie = (a: PatientRow, b: PatientRow) => String(a.patient_id).localeCompare(String(b.patient_id));
  const cmp: Record<GapSort, (a: PatientRow, b: PatientRow) => number> = {
    priority: (a, b) => Number(a.priority ?? Infinity) - Number(b.priority ?? Infinity),
    // ISO dates sort as strings. A missing date sorts as oldest.
    "seen-recent": (a, b) => seen(b).localeCompare(seen(a)),
    "seen-oldest": (a, b) => seen(a).localeCompare(seen(b)),
  };
  return [...rows].sort((a, b) => cmp[by](a, b) || tie(a, b));
}

/** How many open gaps each option of a filter would leave, given the others.
 *  Shown beside each option so a choice that empties the list says so first. */
export function optionCounts<K extends keyof GapFilters>(
  rows: PatientRow[], f: GapFilters, key: K, values: GapFilters[K][],
): Map<GapFilters[K], number> {
  return new Map(values.map((v) => [v, filterGaps(rows, { ...f, [key]: v }).length]));
}

/** The same, over the whole cohort, for the Patients directory. */
export function cohortOptionCounts<K extends keyof PatientFilters>(
  rows: PatientRow[], f: PatientFilters, key: K, values: PatientFilters[K][],
): Map<PatientFilters[K], number> {
  return new Map(values.map((v) => [v, filterPatients(rows, { ...f, [key]: v }).length]));
}

/* ------------------------------------------------------ patients directory */

/**
 * Directory sorts. Patients is a register, not a queue, so the default is the
 * MRN: stable, neutral, and the same for everyone. Every other order is one a
 * reader picks, and each ends on patient_id so ties never shuffle.
 *
 *   mrn          MRN, A to Z (default)
 *   age          oldest first
 *   seen-recent  last seen most recently first
 *   a1c-high     latest A1C, highest first; no result last
 *   status       never tested, then overdue, then current
 *   overdue      days overdue, most first; patients with none last
 */
export type PatientSort = "mrn" | "age" | "seen-recent" | "a1c-high" | "status" | "overdue";

export const PATIENT_SORTS: Record<PatientSort, string> = {
  mrn: "MRN",
  age: "Age, oldest first",
  "seen-recent": "Last seen, most recent",
  "a1c-high": "Latest A1C, highest first",
  status: "Gap status",
  overdue: "Days overdue, most first",
};

const STATUS_ORDER: Record<GapStatus, number> = { never: 0, overdue: 1, current: 2 };

/** Nulls last whichever way the sort runs: a missing value is not a small one. */
const desc = (a: number | null, b: number | null) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : b - a;

export function sortPatients(rows: PatientRow[], by: PatientSort): PatientRow[] {
  const id = (r: PatientRow) => String(r.patient_id);
  const seen = (r: PatientRow) => (r.last_encounter_date ? String(r.last_encounter_date) : "");
  const cmp: Record<PatientSort, (a: PatientRow, b: PatientRow) => number> = {
    mrn: (a, b) => String(a.mrn).localeCompare(String(b.mrn)),
    age: (a, b) => Number(b.age) - Number(a.age),
    "seen-recent": (a, b) => seen(b).localeCompare(seen(a)),
    "a1c-high": (a, b) => desc(lastA1cValue(a), lastA1cValue(b)),
    status: (a, b) => STATUS_ORDER[gapStatus(a)] - STATUS_ORDER[gapStatus(b)],
    overdue: (a, b) => desc(daysOverdue(a), daysOverdue(b)),
  };
  return [...rows].sort((a, b) => cmp[by](a, b) || id(a).localeCompare(id(b)));
}

/* ------------------------------------------------------------ URL state */

/**
 * Directory state <-> the address bar, so a filtered view can be linked,
 * refreshed and walked back through. Defaults are left out of the URL, so the
 * unfiltered page is plain /patients/. Anything unrecognised falls back to its
 * default rather than producing an empty list from a typo.
 */
export type DirectoryState = PatientFilters & { sort: PatientSort; page: number };

export const DIRECTORY_DEFAULTS: DirectoryState = {
  status: "all", query: "", setting: "all", band: "all", insulin: "all", sort: "mrn", page: 1,
};

const STATUS_VALUES: StatusFilter[] = ["all", "current", "gap", "never", "overdue"];

export function readDirectory(p: { get(k: string): string | null }): DirectoryState {
  const pick = <T extends string>(v: string | null, allowed: readonly T[], d: T) =>
    v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : d;
  const page = Number(p.get("page"));
  return {
    status: pick(p.get("status"), STATUS_VALUES, "all"),
    query: p.get("q") ?? "",
    setting: p.get("setting") ?? "all",
    band: pick(p.get("age"), [...AGE_BANDS, "all"] as const, "all"),
    insulin: pick(p.get("insulin"), ["all", "yes", "no"] as const, "all"),
    sort: pick(p.get("sort"), Object.keys(PATIENT_SORTS) as PatientSort[], "mrn"),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function writeDirectory(s: DirectoryState): string {
  const p = new URLSearchParams();
  if (s.status !== "all") p.set("status", s.status);
  if (s.query.trim()) p.set("q", s.query.trim());
  if (s.setting !== "all") p.set("setting", s.setting);
  if (s.band !== "all") p.set("age", s.band);
  if (s.insulin !== "all") p.set("insulin", s.insulin);
  if (s.sort !== "mrn") p.set("sort", s.sort);
  if (s.page > 1) p.set("page", String(s.page));
  return p.toString();
}

/* -------------------------------------------------------------- analytics */

/** A share as a percentage to one decimal place, the precision every page
 *  uses. 0 when the denominator is 0, never NaN. */
export const pct1 = (n: number, of: number) => (of ? Math.round((n / of) * 1000) / 10 : 0);

/** The same, as text: always one decimal, so 20% reads "20.0%" beside "29.4%". */
export const pctText = (n: number, of: number) => `${pct1(n, of).toFixed(1)}%`;

/** One subgroup's monitoring picture. Gap rate is gaps / total in the group. */
export type GroupRow = {
  key: string;
  total: number;
  current: number;
  gaps: number;
  never: number;
  overdue: number;
  gapRate: number;
};

/**
 * Monitoring status by any grouping of the cohort - age band, care setting.
 * Statuses come from gapStatus, so a patient counted as overdue here is
 * overdue on every other page. `order` fixes the row order and includes empty
 * groups; without it, groups appear in the order first met.
 */
export function monitoringBy(
  rows: PatientRow[], groupOf: (r: PatientRow) => string, order?: readonly string[],
): GroupRow[] {
  const m = new Map<string, GroupRow>();
  const blank = (key: string): GroupRow => ({ key, total: 0, current: 0, gaps: 0, never: 0, overdue: 0, gapRate: 0 });
  for (const k of order ?? []) m.set(k, blank(k));
  for (const r of rows) {
    const k = groupOf(r);
    if (!m.has(k)) m.set(k, blank(k));
    const g = m.get(k)!;
    const s = gapStatus(r);
    g.total += 1;
    g[s] += 1;
    if (s !== "current") g.gaps += 1;
  }
  for (const g of m.values()) g.gapRate = pct1(g.gaps, g.total);
  return [...m.values()];
}

export const monitoringByAgeBand = (rows: PatientRow[]) =>
  monitoringBy(rows, (r) => ageBand(Number(r.age)), AGE_BANDS);

/** By care setting of the last encounter, largest group first so the eye
 *  lands on the settings that hold most of the cohort; a one-patient setting
 *  sorted by rate would top the chart at 100%. A missing setting is its own
 *  group, "unknown", rather than dropped. */
export const monitoringBySetting = (rows: PatientRow[]) =>
  monitoringBy(rows, (r) => (r.unit === null || r.unit === undefined ? "unknown" : String(r.unit)))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));

/** Open gaps whose last encounter falls within `months` calendar months of the
 *  data date: patients who were recently seen, yet have no A1C in a year. */
export function gapsSeenWithin(rows: PatientRow[], asof: string, months: number) {
  const since = monthsBefore(asof, months);
  return rows.filter((r) => r.gap_flag && r.last_encounter_date && String(r.last_encounter_date) >= since).length;
}

/** The calendar date `months` months before an ISO date, as ISO. The same
 *  arithmetic as SQL's `DATE x - INTERVAL n MONTH`. */
export function monthsBefore(asof: string, months: number): string {
  const d = new Date(`${asof.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/**
 * Each patient's latest recorded A1C, counted into equal one-point ranges
 * (2.0-2.9%, 3.0-3.9%, ...) from the lowest value to the highest. The ranges
 * are arithmetic, not clinical: nothing here labels a range controlled,
 * uncontrolled or risky. Patients with no result are counted separately and
 * never placed in a range - a missing value is not a low one.
 */
export type A1cBin = { lo: number; hi: number; label: string; n: number };

export function latestA1cDistribution(rows: PatientRow[]) {
  const values = rows.map(lastA1cValue).filter((v): v is number => v !== null);
  const without = rows.length - values.length;
  if (values.length === 0) return { bins: [] as A1cBin[], withResult: 0, without };
  const lo = Math.floor(Math.min(...values)), hi = Math.floor(Math.max(...values));
  const bins: A1cBin[] = [];
  for (let b = lo; b <= hi; b++) bins.push({ lo: b, hi: b + 0.9, label: `${b}.0–${b}.9%`, n: 0 });
  for (const v of values) bins[Math.floor(v) - lo].n += 1;
  return { bins, withResult: values.length, without };
}
