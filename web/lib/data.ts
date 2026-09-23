// Build-time data access (Decision D9).
//
// Every number on the site comes from these imports, which are the artefacts
// pipeline/export_web.py writes. Nothing here is typed by hand - if the pipeline
// is re-run with a different seed, every figure on the site moves with it.

import goldReport from "@/public/data/gold_report.json";
import dqReport from "@/public/data/dq_report.json";
import reconciliation from "@/public/data/reconciliation.json";
import quarantine from "@/public/data/quarantine.json";
import identityReview from "@/public/data/identity_review.json";
import remediationLog from "@/public/data/remediation_log.json";
import careGap from "@/public/data/care_gap_a1c.json";

export type Recon = {
  name: string;
  bronze: number;
  silver: number;
  quarantined: number;
  balances: boolean;
};

export type QuarantineRow = {
  source_table: string;
  source_row_id: string;
  failure_reason: string;
  check_id: string;
  quarantined_at: string;
};

export type IdentityRow = {
  candidate_a_mrn: string;
  candidate_b_mrn: string;
  match_fields: string;
  confidence: number;
  status: string;
};

export type RemediationRow = {
  source_row_id: string;
  field: string;
  original_value: string;
  corrected_value: string;
  remediation_rule: string;
};

export const gold = goldReport;
export const dq = dqReport;
export const recon = reconciliation as Recon[];
export const quarantineRows = quarantine as QuarantineRow[];
export const identityRows = identityReview as IdentityRow[];
export const remediationRows = remediationLog as RemediationRow[];
export const cohort = careGap;

/** Bronze/Silver totals across all five tables, summed rather than restated. */
export const layerTotals = recon.reduce(
  (a, r) => ({
    bronze: a.bronze + r.bronze,
    silver: a.silver + r.silver,
    quarantined: a.quarantined + r.quarantined,
  }),
  { bronze: 0, silver: 0, quarantined: 0 },
);

/** The six checks, joined to what each one actually caught. */
export const checks = [
  { id: "DQ1", name: "Encounter uniqueness", rule: "One row per patient and encounter", defect: "D1", cause: "An interface replayed the message" },
  { id: "DQ2", name: "Referential integrity", rule: "Every observation points at a patient that exists", defect: "D2", cause: "A result arrived with an unresolvable patient id" },
  { id: "DQ3", name: "A1c plausibility", rule: "A1c between 2.0 and 20.0 percent", defect: "D3", cause: "A glucose in mg/dL keyed into a percent field" },
  { id: "DQ4", name: "Birth date sanity", rule: "In the past, implied age 120 or less", defect: "D4", cause: "A registration typo in the year" },
  { id: "DQ5", name: "Encounter chronology", rule: "Discharge is not before admission", defect: "D5", cause: "Clock drift between two systems" },
  { id: "DQ6", name: "Patient identity", rule: "No two patients share name and birth date", defect: "D6", cause: "The same person registered twice" },
].map((c) => {
  const row = (dq.catch as { defect: string; caught: number; injected: number }[]).find(
    (x) => x.defect === c.defect,
  );
  return { ...c, injected: row?.injected ?? 0, caught: row?.caught ?? 0 };
});

export const fmt = (n: number) => n.toLocaleString("en-US");
