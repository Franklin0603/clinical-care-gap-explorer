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
 *   current  an A1c within the last 365 days            (gap_flag false)
 *   overdue  a previous A1c, but not within 365 days     (gap_flag true)
 *   never    no A1c on file at all                       (gap_flag true)
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

/** The last A1c value, or null when there is none. Never 0: Number(null) is 0,
 *  and a 0% A1c reads as a result when the finding is that there is no result. */
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
  /** Open gap, with an earlier A1c on file. openGaps = this + neverTested. */
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
};

export const settingLabel = (unit: unknown) =>
  unit === null || unit === undefined ? "Unknown" : SETTING_LABELS[String(unit)] ?? String(unit);

export type GapFilters = {
  status: "all" | "never" | "overdue";
  /** Matched against the start of the MRN, ignoring case and spaces. */
  query: string;
  setting: string;
  band: AgeBand | "all";
  insulin: "all" | "yes" | "no";
};

export const NO_FILTERS: GapFilters = { status: "all", query: "", setting: "all", band: "all", insulin: "all" };

/** Open gaps only, narrowed by every filter that is set. Filters that are not
 *  set ("all", or an empty search) do nothing. */
export function filterGaps(rows: PatientRow[], f: GapFilters): PatientRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (!r.gap_flag) return false;
    if (f.status !== "all" && gapStatus(r) !== f.status) return false;
    if (q && !String(r.mrn).toLowerCase().startsWith(q)) return false;
    if (f.setting !== "all" && String(r.unit) !== f.setting) return false;
    if (f.band !== "all" && ageBand(Number(r.age)) !== f.band) return false;
    if (f.insulin !== "all" && Boolean(r.on_insulin) !== (f.insulin === "yes")) return false;
    return true;
  });
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
