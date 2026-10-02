// The per-patient record behind a table row: A1c series, medications, procedures.
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

/** Control threshold. Below 7% is the usual target for a non-frail adult. */
export const A1C_TARGET = 7;

/** A1c tests per calendar year, which is where a lapse in testing shows up. */
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

/** The date insulin first appears, for a marker on the A1c series. */
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
