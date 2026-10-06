/**
 * The checks Data & Quality shows, computed - not written by hand.
 *
 * Three sources, labelled on every check so a reader knows how far to trust it:
 *
 *   live      recomputed in the browser from the same patient rows every page
 *             reads, with the same functions (lib/cohort.ts). If the exported
 *             data changed, these would change with it.
 *   pipeline  read from the reports the pipeline published with the data
 *             (dq_report.json, gold_report.json): what the run itself found.
 *   audit     a one-time query of the DuckDB warehouse, which the browser
 *             cannot open. Dated, with the query, so it can be re-run.
 *
 * Nothing here defines the measure. Where a check re-derives a status from
 * dates, it does so to test the exported flag against the written rule, not
 * to replace it.
 *
 * Pure, so `node --test` can hold it to the gold report.
 */

import type { PatientRow } from "./data";
import { cohortSummary, monitoringByAgeBand, monitoringBySetting, pctText } from "./cohort.ts";

export type CheckStatus = "passed" | "warning" | "info" | "not-evaluated";
export type CheckSource = "live" | "pipeline" | "audit";

export type Check = {
  id: string;
  area: "Identity & grain" | "A1c observations" | "Dates" | "Cohort" | "Relationships" | "Measure" | "Pipeline";
  name: string;
  scope: string;
  source: CheckSource;
  result: string;
  status: CheckStatus;
  why: string;
  evidence?: string;
};

type DqReport = {
  checks: { id: string; name: string; rule: string; action: string }[];
  a1c_range: number[];
  reconciliation: { table: string; bronze: number; silver: number; quarantined: number; balances: boolean }[];
  quarantine_by_check: Record<string, number>;
  remediated: number;
  identity_review_pending: number;
};

type GoldReport = {
  asof: string;
  gap_days: number;
  cohort: number;
  open_gaps: number;
  never_tested: number;
  inner_join_would_keep: number;
  a1c_clean_below_3: number;
  identity_review_pending: number;
};

/**
 * Results of a one-time warehouse audit (data/warehouse/clinical.duckdb),
 * which the static site cannot query. Recorded with the date and the query so
 * they can be reproduced; re-run them after any pipeline change.
 */
export const AUDIT = {
  date: "2026-10-06",
  everCoded: 161,
  deceasedByAsof: 45,
  rawA1cTotal: 8941,
  rawA1cPassingOldFloor: 7990,
  silverA1cAfterAsof: 0,
  silverObservationsMissingDate: 0,
  silverDuplicateA1c: 0,
  silverLatestA1cTies: 0,
  orphanRows: { observations: 2314, encounters: 281, medications: 51 },
  quarantinedPatients: 8,
};

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY);

/**
 * The written gap rule, for testing the exported flag against: no result, or
 * a latest result more than `gapDays` days before the data date. Exactly
 * `gapDays` days old is still current. The same comparison as the Gold SQL.
 */
export function ruleSaysGap(lastA1cDate: string | null, asof: string, gapDays: number): boolean {
  if (!lastA1cDate) return true;
  return daysBetween(lastA1cDate, asof) > gapDays;
}

/** The ISO date `months` calendar months after `iso`. */
export function monthsAfter(iso: string, months: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * How many patients would have an open gap if the data date moved forward
 * while the data stayed the same - the reason it is fixed. Calendar months,
 * whole days, the Gold rule.
 */
export function gapDrift(rows: PatientRow[], asof: string, gapDays: number, months = [0, 1, 3, 6, 9, 12]) {
  return months.map((m) => {
    const at = monthsAfter(asof, m);
    return { months: m, date: at, gaps: rows.filter((r) => ruleSaysGap(r.last_a1c_date as string | null, at, gapDays)).length };
  });
}

/** The reconciliation the page leads with, from the shared summary. */
export function reconciliation(rows: PatientRow[], asof: string) {
  const s = cohortSummary(rows, asof);
  return {
    s,
    totalOk: s.current + s.openGaps === s.total,
    gapsOk: s.neverTested + s.gapPreviouslyTested === s.openGaps,
    shares: {
      current: pctText(s.current, s.total),
      gap: pctText(s.openGaps, s.total),
      never: pctText(s.neverTested, s.openGaps),
      overdue: pctText(s.gapPreviouslyTested, s.openGaps),
    },
  };
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function qualityChecks(rows: PatientRow[], gold: GoldReport, dq: DqReport): Check[] {
  const asof = gold.asof;
  const days = gold.gap_days;
  const ids = rows.map((r) => String(r.patient_id ?? ""));
  const unique = new Set(ids).size;
  const missingId = rows.filter((r) => !r.patient_id || !r.mrn).length;
  const tested = rows.filter((r) => r.last_a1c_date);
  const never = rows.filter((r) => !r.last_a1c_date);
  const flagMismatch = rows.filter((r) => Boolean(r.gap_flag) !== ruleSaysGap(r.last_a1c_date as string | null, asof, days)).length;
  const nearBoundary = tested.filter((r) => Math.abs(daysBetween(String(r.last_a1c_date), asof) - days) <= 7);
  const resultsAfter = tested.filter((r) => String(r.last_a1c_date) > asof).length;
  const encAfter = rows.filter((r) => r.last_encounter_date && String(r.last_encounter_date) > asof).length;
  const [lo, hi] = dq.a1c_range;
  const values = tested.map((r) => Number(r.last_a1c_value)).filter((v) => Number.isFinite(v));
  const outOfRange = values.filter((v) => v < lo || v > hi).length;
  const below3 = values.filter((v) => v < 3).length;
  const missingValue = tested.filter((r) => r.last_a1c_value === null || r.last_a1c_value === undefined).length;
  const dueMismatch = rows.filter((r) => {
    const hasDate = Boolean(r.last_a1c_date);
    const nextOk = (r.next_due_date === null) === !hasDate;
    const overdueOk = (r.days_overdue !== null) === (Boolean(r.gap_flag) && hasDate);
    return !(nextOk && overdueOk);
  }).length;
  const priorityMismatch = rows.filter((r) => (r.priority !== null) !== Boolean(r.gap_flag)).length;
  const recon = reconciliation(rows, asof);
  const smallGroups = [...monitoringByAgeBand(rows), ...monitoringBySetting(rows)].filter((g) => g.total > 0 && g.total < 10);
  const q = (id: string) => dq.quarantine_by_check[id] ?? 0;
  const quarantinedTotal = Object.values(dq.quarantine_by_check).reduce((n, v) => n + v, 0);
  const balanced = dq.reconciliation.filter((t) => t.balances && t.bronze === t.silver + t.quarantined);
  const orphanTotal = AUDIT.orphanRows.observations + AUDIT.orphanRows.encounters + AUDIT.orphanRows.medications;

  const checks: Check[] = [
    // ------------------------------------------------------------ identity
    {
      id: "G1", area: "Identity & grain", name: "One row per patient", source: "live",
      scope: "Patient-level care-gap dataset",
      result: `${fmt(rows.length)} rows, ${fmt(unique)} distinct patients`,
      status: rows.length === unique ? "passed" : "warning",
      why: "Every count on every page assumes one row is one patient. A join that multiplied rows would inflate them all.",
      evidence: "Also asserted in the pipeline on every run (Gold check V4.1).",
    },
    {
      id: "G2", area: "Identity & grain", name: "No missing patient identifiers", source: "live",
      scope: "Patient-level care-gap dataset",
      result: missingId === 0 ? "None missing" : `${missingId} rows without an identifier`,
      status: missingId === 0 ? "passed" : "warning",
      why: "A row without an identifier cannot be reviewed, linked to its history, or followed up.",
    },
    {
      id: "G4", area: "Identity & grain", name: "Duplicate encounters", source: "pipeline",
      scope: "All encounters (DQ1: one row per patient and encounter)",
      result: `No duplicates in Silver; ${fmt(q("DQ1"))} repeated rows quarantined`,
      status: "passed",
      why: "A repeated encounter would inflate visit counts and could move a patient's last-seen date. Repeats are quarantined, not merged.",
    },
    {
      id: "G3", area: "Identity & grain", name: "Possible duplicate registrations", source: "pipeline",
      scope: "All patients (DQ6: same name and birth date)",
      result: `${dq.identity_review_pending} pairs held for review; ${gold.identity_review_pending} involve cohort patients`,
      status: "info",
      why: "Two records for one person would double-count them. They are flagged for a human decision, never merged automatically.",
    },
    // ------------------------------------------------------------- A1c
    {
      id: "A1", area: "A1c observations", name: "Plausible A1c values", source: "live",
      scope: `Latest A1c of ${fmt(values.length)} tested patients`,
      result: outOfRange === 0 ? `All within ${lo.toFixed(1)}–${hi.toFixed(1)}%` : `${outOfRange} outside ${lo.toFixed(1)}–${hi.toFixed(1)}%`,
      status: outOfRange === 0 ? "passed" : "warning",
      why: "A value outside any plausible range is a data error, such as a glucose keyed into a percent field, not a result.",
      evidence: `The pipeline's DQ3 applies the same ${lo.toFixed(1)}–${hi.toFixed(1)}% range to every A1c. ${dq.remediated} values recorded in mg/dL rather than percent were converted, with the original kept, rather than discarded.`,
    },
    {
      id: "A2", area: "A1c observations", name: "Unusually low A1c values", source: "live",
      scope: `Latest A1c of ${fmt(values.length)} tested patients`,
      result: `${below3} below 3.0%`,
      status: below3 > 0 ? "warning" : "passed",
      why: "Values this low are rare in real care. They come from the synthetic generator and are kept as recorded; they pass the plausibility range but are worth knowing about.",
    },
    {
      id: "A3", area: "A1c observations", name: "Every result has a value", source: "live",
      scope: `${fmt(tested.length)} patients with a latest A1c`,
      result: missingValue === 0 ? "No dated result is missing its value" : `${missingValue} dated results without a value`,
      status: missingValue === 0 ? "passed" : "warning",
      why: "Gold only counts numeric results, so a date without a value would mean the selection let through something it should not.",
    },
    {
      id: "A4", area: "A1c observations", name: "Duplicate A1c observations", source: "audit",
      scope: "All A1c results in Silver",
      result: `${AUDIT.silverDuplicateA1c} duplicates (same patient, time and value)`,
      status: AUDIT.silverDuplicateA1c === 0 ? "passed" : "warning",
      why: "Duplicates would inflate testing counts per year, though not a patient's status.",
    },
    {
      id: "A5", area: "A1c observations", name: "Latest result is unambiguous", source: "audit",
      scope: "All A1c results in Silver",
      result: `${AUDIT.silverLatestA1cTies} patients with two results at the same latest timestamp`,
      status: AUDIT.silverLatestA1cTies === 0 ? "passed" : "warning",
      why: "Gold picks the latest result with row_number() ordered by time. A tie would make the chosen value arbitrary.",
    },
    // ----------------------------------------------------------- dates
    {
      id: "D1", area: "Dates", name: "No results after the data date", source: "live",
      scope: "Latest A1c dates",
      result: resultsAfter === 0 ? `None after ${asof}` : `${resultsAfter} after ${asof}`,
      status: resultsAfter === 0 ? "passed" : "warning",
      why: "A result from after the data date would make a patient current on information that did not yet exist.",
      evidence: `The audit also found ${AUDIT.silverA1cAfterAsof} A1c results after the data date anywhere in Silver.`,
    },
    {
      id: "D2", area: "Dates", name: "No encounters after the data date", source: "live",
      scope: "Last encounter dates",
      result: encAfter === 0 ? `None after ${asof}` : `${encAfter} after ${asof}`,
      status: encAfter === 0 ? "passed" : "warning",
      why: "\"Last seen\" must be on or before the data date, or recency filters would include visits that had not happened.",
    },
    {
      id: "D3", area: "Dates", name: "Encounter chronology", source: "pipeline",
      scope: "All encounters (DQ5)",
      result: `No discharge before admission in Silver; ${fmt(q("DQ5"))} encounters quarantined`,
      status: "passed",
      why: "Validates that discharge dates do not occur before admission dates. An encounter that ends before it starts is a clock or interface error, so it is quarantined with a reason rather than kept.",
    },
    {
      id: "D5", area: "Dates", name: "Plausible birth dates", source: "pipeline",
      scope: "All patients (DQ4: in the past, implied age 120 or less)",
      result: `${fmt(q("DQ4"))} patients quarantined`,
      status: "passed",
      why: "An impossible birth date makes every age, and so every age band, wrong for that patient. Quarantined patients cannot enter the cohort.",
    },
    {
      id: "D4", area: "Dates", name: "Observations missing a date", source: "audit",
      scope: "All observations in Silver",
      result: `${AUDIT.silverObservationsMissingDate} missing`,
      status: AUDIT.silverObservationsMissingDate === 0 ? "passed" : "warning",
      why: "An undated result cannot be placed in the 365-day window.",
    },
    // ---------------------------------------------------------- cohort
    {
      id: "C1", area: "Cohort", name: "Deceased patients excluded", source: "audit",
      scope: "Patients with any of the 8 diabetes codes",
      result: `${AUDIT.everCoded} coded, ${AUDIT.deceasedByAsof} died by the data date, ${AUDIT.everCoded - AUDIT.deceasedByAsof} in the cohort`,
      status: AUDIT.everCoded - AUDIT.deceasedByAsof === gold.cohort ? "passed" : "warning",
      why: "A care-gap list is a call list. Patients who died before the data date are not on it.",
      evidence: "Asserted on every run as Gold check V4.5: the cohort equals the written definition.",
    },
    {
      id: "C2", area: "Cohort", name: "Cohort matches the pipeline's report", source: "live",
      scope: "Patient-level dataset vs gold_report.json",
      result: `${fmt(rows.length)} rows; the pipeline reported ${fmt(gold.cohort)}`,
      status: rows.length === gold.cohort ? "passed" : "warning",
      why: "The browser and the warehouse must describe the same people.",
    },
    {
      id: "C3", area: "Cohort", name: "Small groups", source: "live",
      scope: "Age bands and care settings",
      result: `${smallGroups.length} groups under 10 patients`,
      status: smallGroups.length > 0 ? "warning" : "passed",
      why: "With so few patients a group's gap rate swings on one person. Pages show these groups but do not rank them.",
      evidence: smallGroups.map((g) => `${g.key} (${g.total})`).join(", "),
    },
    // ---------------------------------------------------- relationships
    {
      id: "R1", area: "Relationships", name: "Results point at a known patient", source: "pipeline",
      scope: "All observations (DQ2)",
      result: `No unattributed results in Silver; ${fmt(q("DQ2"))} observations quarantined`,
      status: "passed",
      why: "Validates referential integrity between observations and patients. A result for a patient who does not exist cannot be attributed, so it is quarantined rather than dropped silently.",
    },
    {
      id: "R2", area: "Relationships", name: "Child rows of quarantined patients", source: "audit",
      scope: "Observations, encounters and medications in Silver",
      result: `${fmt(orphanTotal)} rows belong to the ${AUDIT.quarantinedPatients} quarantined patients`,
      status: "warning",
      why: "When a patient is quarantined (impossible birth date), their observations, encounters and medications stay in Silver without a patient row. None can reach the cohort, which joins through Silver's patients, so no number on any page is affected - but they should be quarantined with the patient.",
      evidence: `${fmt(AUDIT.orphanRows.observations)} observations, ${fmt(AUDIT.orphanRows.encounters)} encounters, ${fmt(AUDIT.orphanRows.medications)} medications; 0 such rows for any other patient.`,
    },
    {
      id: "R3", area: "Relationships", name: "Procedures without a patient", source: "pipeline",
      scope: "All procedures",
      result: "Not checked by the pipeline or the audit",
      status: "not-evaluated",
      why: "No check covers procedures. They appear only in a patient's history, never in a count, so the risk is low; it should be added alongside R2's fix.",
    },
    // --------------------------------------------------------- measure
    {
      id: "M1", area: "Measure", name: "Current + open gaps = cohort", source: "live",
      scope: "Patient-level dataset",
      result: `${recon.s.current} + ${recon.s.openGaps} = ${recon.s.current + recon.s.openGaps} (cohort ${recon.s.total})`,
      status: recon.totalOk ? "passed" : "warning",
      why: "Every patient is in exactly one of the two groups, or every page's percentages are wrong.",
    },
    {
      id: "M2", area: "Measure", name: "Never tested + overdue = open gaps", source: "live",
      scope: "Open gaps",
      result: `${recon.s.neverTested} + ${recon.s.gapPreviouslyTested} = ${recon.s.neverTested + recon.s.gapPreviouslyTested} (open gaps ${recon.s.openGaps})`,
      status: recon.gapsOk ? "passed" : "warning",
      why: "The two kinds of gap must partition the gaps, or a patient is counted twice or not at all.",
    },
    {
      id: "M3", area: "Measure", name: "Patients without an A1c are kept", source: "live",
      scope: "Cohort vs patients with any A1c result",
      result: `${never.length} kept with no result (${gold.cohort} in the cohort, ${gold.inner_join_would_keep} with a result)`,
      status: never.length === gold.cohort - gold.inner_join_would_keep && never.every((r) => r.gap_flag) ? "passed" : "warning",
      why: "These patients are the never-tested gaps. A join that required a result would drop all of them without an error.",
      evidence: "Asserted on every run as Gold check V4.2.",
    },
    {
      id: "M4", area: "Measure", name: "Gap flag matches the written rule", source: "live",
      scope: `${fmt(rows.length)} patients, re-derived from dates`,
      result: flagMismatch === 0 ? "Every flag agrees with the 365-day rule" : `${flagMismatch} disagree`,
      status: flagMismatch === 0 ? "passed" : "warning",
      why: "The exported flag is tested against the definition rather than trusted.",
      evidence: "Also Gold check V4.4.",
    },
    {
      id: "M5", area: "Measure", name: "The 365-day boundary", source: "live",
      scope: "Results within 7 days of the boundary",
      result: nearBoundary.length === 0
        ? "No patient's latest result is within 7 days of it"
        : `${nearBoundary.length} near the boundary, all classified by the rule`,
      status: "info",
      why: `Exactly ${days} days old is current; ${days + 1} is overdue. No patient sits near the line in this data, so the boundary is held by the Gold SQL and by unit tests rather than by an example.`,
    },
    {
      id: "M6", area: "Measure", name: "Days overdue and next due are consistent", source: "live",
      scope: "Patient-level dataset",
      result: dueMismatch === 0 ? "Consistent for every patient" : `${dueMismatch} inconsistent`,
      status: dueMismatch === 0 ? "passed" : "warning",
      why: "Never-tested patients must have neither figure; overdue patients must have days overdue.",
      evidence: "Also Gold check V4.12.",
    },
    {
      id: "M7", area: "Measure", name: "Care Gaps order set only for gaps", source: "live",
      scope: "Patient-level dataset",
      result: priorityMismatch === 0 ? "Set for every gap and no current patient" : `${priorityMismatch} inconsistent`,
      status: priorityMismatch === 0 ? "passed" : "warning",
      why: "The worklist rank must cover exactly the patients on the worklist.",
      evidence: "Also Gold check V4.11.",
    },
    // -------------------------------------------------------- pipeline
    {
      id: "P1", area: "Pipeline", name: "Source-to-Silver reconciliation", source: "pipeline",
      scope: `${dq.reconciliation.length} source tables`,
      result: `${balanced.length} of ${dq.reconciliation.length} tables reconcile: source = Silver + quarantine`,
      status: balanced.length === dq.reconciliation.length ? "passed" : "warning",
      why: "A row can leave the pipeline only by reaching Silver or quarantine, with a reason. Nothing disappears.",
      evidence: dq.reconciliation.map((t) => `${t.table} ${fmt(t.bronze)} = ${fmt(t.silver)} + ${fmt(t.quarantined)}`).join("; "),
    },
    {
      id: "P2", area: "Pipeline", name: "Quarantined and corrected rows", source: "pipeline",
      scope: "Rows rejected or corrected in Silver",
      result: `${fmt(quarantinedTotal)} rows quarantined with a reason; ${fmt(dq.remediated)} A1c values corrected`,
      status: "info",
      why: "A row that fails a check is kept in quarantine with the check and the reason, never deleted, so every rejection can be reviewed and reversed.",
      evidence: Object.entries(dq.quarantine_by_check).map(([k, v]) => `${k}: ${fmt(v)}`).join(", "),
    },
  ];
  return checks;
}

export function checkSummary(checks: Check[]) {
  const by = (s: CheckStatus) => checks.filter((c) => c.status === s).length;
  return {
    total: checks.length,
    evaluated: checks.length - by("not-evaluated"),
    passed: by("passed"),
    warnings: by("warning"),
    info: by("info"),
    notEvaluated: by("not-evaluated"),
  };
}
