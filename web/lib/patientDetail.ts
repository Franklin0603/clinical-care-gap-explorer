// The per-patient record behind a table row: A1C series, medications, procedures.
//
// Fetched at runtime rather than imported. The other payloads on this site are
// static imports, which is right for a few hundred rows that every page needs,
// but this file is 812 KB and only matters once somebody clicks a patient.
// Importing it would put all of it in the page bundle and make the first paint
// of the Patients table wait on data most visitors never open.
//
// One fetch per session, shared: the promise is cached, so ten clicks on ten
// patients still make one request.

export type A1cPoint = { d: string; v: number };

export type MedRow = {
  name: string;
  code: string;
  started: string | null;
  ended: string | null;      // null means still active
  prescriptions: number;
  fills: number;             // dispenses; Synthea exports no dose
  insulin: boolean;
};

export type ProcRow = {
  name: string;
  code: string;
  times: number;
  first: string | null;
  last: string | null;
};

export type PatientDetail = { a1c: A1cPoint[]; meds: MedRow[]; procs: ProcRow[] };

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

let cache: Promise<Record<string, PatientDetail>> | null = null;

export function loadPatientDetail(): Promise<Record<string, PatientDetail>> {
  if (!cache) {
    cache = fetch(`${BASE}/data/patient_detail.json`).then((r) => {
      if (!r.ok) throw new Error(`patient_detail.json: ${r.status} ${r.statusText}`);
      return r.json() as Promise<Record<string, PatientDetail>>;
    });
    // A rejected cached promise would fail every later click with the first
    // error, so drop it and let the next click retry.
    cache.catch(() => { cache = null; });
  }
  return cache;
}

/* ------------------------------------------------------------------ shaping */

/** A reference line, not a verdict. 7% is a common goal for many adults with
 *  diabetes, but individual goals differ, so the charts call it a reference
 *  point and nothing here colours a patient by it. */
export const A1C_TARGET = 7;

/** A1C tests per calendar year, which is where a lapse in testing shows up. */
export function testsPerYear(a1c: A1cPoint[]) {
  const byYear = new Map<string, number>();
  for (const p of a1c) {
    const y = p.d.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  if (byYear.size === 0) return [];
  const years = [...byYear.keys()].sort();
  const lo = Number(years[0]);
  const hi = Number(years[years.length - 1]);
  // Fill the gap years. Without them a two-year silence renders as two
  // adjacent bars and reads as continuous testing.
  const out: { year: string; tests: number }[] = [];
  for (let y = lo; y <= hi; y++) {
    out.push({ year: String(y), tests: byYear.get(String(y)) ?? 0 });
  }
  return out;
}

/** Insulin fills per calendar year, the only supply trend this data supports. */
export function insulinPerYear(meds: MedRow[]) {
  const ins = meds.filter((m) => m.insulin && m.started);
  if (ins.length === 0) return [];
  const byYear = new Map<string, number>();
  for (const m of ins) {
    const y = m.started!.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + m.fills);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, fills]) => ({ year, fills }));
}

/** The date insulin first appears, for a marker on the A1C series. */
export function insulinStart(meds: MedRow[]): string | null {
  const dates = meds.filter((m) => m.insulin && m.started).map((m) => m.started!);
  return dates.length ? dates.sort()[0] : null;
}

/* --------------------------------------------------------------- box plot */

export type Box = {
  label: string;
  min: number; q1: number; median: number; q3: number; max: number;
  n: number;
};

/** Quantile by linear interpolation, on an already-sorted array. */
function quantile(sorted: number[], p: number) {
  if (sorted.length === 1) return sorted[0];
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/**
 * Five-number summary per group, for the distribution chart.
 *
 * Whiskers are min and max rather than 1.5 x IQR: the groups here are as small
 * as eight patients, where a Tukey fence would mark ordinary values as outliers
 * and invite a reader to dismiss them.
 */
export function boxes(groups: Map<string, number[]>): Box[] {
  const out: Box[] = [];
  for (const [label, raw] of groups) {
    const v = raw.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (v.length === 0) continue;
    out.push({
      label,
      min: v[0],
      q1: quantile(v, 0.25),
      median: quantile(v, 0.5),
      q3: quantile(v, 0.75),
      max: v[v.length - 1],
      n: v.length,
    });
  }
  return out;
}

/* ----------------------------------------------------------- summaries */

/**
 * What the medication data documents about insulin. Worded as documentation,
 * never as fact about the patient: an absent record is not proof of absence.
 *
 *   active   an insulin prescription with no end date on or after the as-of date
 *            (the pipeline's own on_insulin)
 *   past     insulin appears in the history, none active on the as-of date
 *   none     no insulin anywhere in the medication data
 *   unknown  not active, and the history has not loaded yet to say which
 */
export type InsulinDoc = "active" | "past" | "none" | "unknown";

export function insulinDoc(onInsulin: boolean, meds: MedRow[] | null): InsulinDoc {
  if (onInsulin) return "active";
  if (!meds) return "unknown";
  return meds.some((m) => m.insulin) ? "past" : "none";
}

export const INSULIN_DOC_TEXT: Record<InsulinDoc, { short: string; long: string }> = {
  active: {
    short: "Insulin documented",
    long: "An insulin prescription active on the data date is documented in the available medication data.",
  },
  past: {
    short: "Past insulin documented",
    long: "Insulin appears earlier in the available medication data, but no insulin prescription is active on the data date.",
  },
  none: {
    short: "No insulin documented",
    long: "No insulin is documented in the available medication data.",
  },
  unknown: {
    short: "No active insulin documented",
    long: "No insulin prescription active on the data date is documented in the available medication data.",
  },
};

/** The patient's own A1C history in a few numbers. */
export function a1cSummary(a1c: A1cPoint[]) {
  if (a1c.length === 0) return null;
  const latest = a1c[a1c.length - 1];
  return {
    count: a1c.length,
    latest,
    previous: a1c.length > 1 ? a1c[a1c.length - 2] : null,
    firstYear: a1c[0].d.slice(0, 4),
    lastYear: latest.d.slice(0, 4),
  };
}

/* ------------------------------------------------------- cohort history */

export type YearRow = {
  year: string;
  /** A1C results recorded in the year. */
  tests: number;
  /** Distinct patients with at least one recorded result in the year. */
  patients: number;
};

/**
 * A1C results and patients tested per calendar year, across every patient's
 * record, with the empty years drawn rather than skipped - the same rule as a
 * patient's own tests-per-year chart. Also returns the first and last result
 * dates, because the end years are only partly covered and must be labelled.
 */
export function cohortTestsByYear(all: Record<string, PatientDetail>) {
  const tests = new Map<string, number>();
  const who = new Map<string, Set<string>>();
  let first: string | null = null, last: string | null = null;
  for (const [pid, d] of Object.entries(all)) {
    for (const p of d.a1c) {
      const y = p.d.slice(0, 4);
      tests.set(y, (tests.get(y) ?? 0) + 1);
      if (!who.has(y)) who.set(y, new Set());
      who.get(y)!.add(pid);
      if (first === null || p.d < first) first = p.d;
      if (last === null || p.d > last) last = p.d;
    }
  }
  if (first === null || last === null) return { years: [] as YearRow[], first: null, last: null };
  const years: YearRow[] = [];
  for (let y = Number(first.slice(0, 4)); y <= Number(last.slice(0, 4)); y++) {
    const k = String(y);
    years.push({ year: k, tests: tests.get(k) ?? 0, patients: who.get(k)?.size ?? 0 });
  }
  return { years, first, last };
}
