/**
 * The ten preset questions (task 7.1).
 *
 * Each one carries the SQL it runs — nothing is generated, so what is displayed
 * is exactly what executes. Four of them reference columns a PCT cannot see, on
 * purpose: selecting PCT and clicking one shows the restriction working at the
 * data layer rather than being described in a caption.
 */
export type Chip = { q: string; sql: string; note?: string };

export const CHIPS: Chip[] = [
  {
    q: "How many patients have an open A1c gap?",
    sql: `SELECT count(*) AS patients,
       count(*) FILTER (WHERE gap_flag) AS open_gaps,
       round(100.0 * count(*) FILTER (WHERE gap_flag) / count(*), 1) AS gap_rate_pct
FROM patients`,
  },
  {
    q: "How many have never been tested at all?",
    sql: `SELECT count(*) AS never_tested
FROM patients
WHERE last_a1c_date IS NULL`,
    note: "Restricted for a PCT — the column is not in that role's data.",
  },
  {
    q: "What is the gap rate by age band?",
    sql: `SELECT CASE WHEN age < 45 THEN '18-44'
            WHEN age < 65 THEN '45-64'
            WHEN age <= 75 THEN '65-75'
            ELSE '76+' END AS age_band,
       count(*) AS patients,
       count(*) FILTER (WHERE gap_flag) AS gaps
FROM patients
GROUP BY 1
ORDER BY 1`,
  },
  {
    q: "Which patients are most overdue?",
    sql: `SELECT mrn, age, days_overdue, last_a1c_date, last_a1c_value
FROM patients
WHERE gap_flag AND days_overdue IS NOT NULL
ORDER BY days_overdue DESC
LIMIT 10`,
    note: "Restricted for a PCT.",
  },
  {
    q: "Who has a gap, by care setting?",
    sql: `SELECT unit,
       count(*) AS patients,
       count(*) FILTER (WHERE gap_flag) AS gaps
FROM patients
GROUP BY 1
ORDER BY gaps DESC`,
  },
  {
    q: "Which patients with a gap are on insulin?",
    sql: `SELECT mrn, age, on_insulin, active_med_count
FROM patients
WHERE gap_flag AND on_insulin
LIMIT 10`,
    note: "Restricted for a PCT.",
  },
  {
    q: "Why were rows held back from the report?",
    sql: `SELECT check_id, failure_reason, count(*) AS n_rows
FROM quarantine
GROUP BY 1, 2
ORDER BY n_rows DESC`,
  },
  {
    q: "Which patient records are waiting on a human decision?",
    sql: `SELECT candidate_a_mrn, candidate_b_mrn, match_fields, confidence, status
FROM identity_review
ORDER BY confidence DESC`,
  },
  {
    q: "What values were corrected, and from what?",
    sql: `SELECT source_row_id, original_value, corrected_value, remediation_rule
FROM remediation_log
LIMIT 5`,
  },
  {
    q: "Show the oldest patients with an open gap",
    sql: `SELECT mrn, age, sex, unit, last_encounter_date
FROM patients
WHERE gap_flag
ORDER BY age DESC
LIMIT 10`,
  },
];

/**
 * The free-text box matches a question against the chips above by keyword, and
 * refuses everything else with one sentence (FR6, task 7.5).
 *
 * This is a matcher, not a language model — the page says so. Anything it does
 * not recognise gets an honest refusal naming what it can answer, which is a
 * better failure than a confident wrong number.
 */
const INTENTS: { keys: string[]; chip: number }[] = [
  // Keys name the *subject*, never the question form. "how many" as a key made
  // any counting question match this chip regardless of what it asked about.
  { keys: ["gap", "overdue", "open", "cohort", "gap rate"], chip: 0 },
  { keys: ["never", "no test", "not tested", "untested"], chip: 1 },
  { keys: ["age", "old", "band", "decade"], chip: 2 },
  { keys: ["most overdue", "longest", "worst", "priority", "days overdue"], chip: 3 },
  { keys: ["unit", "setting", "clinic", "ward"], chip: 4 },
  { keys: ["insulin", "medication", "meds", "drug"], chip: 5 },
  { keys: ["quarantine", "held back", "rejected", "dropped", "failure"], chip: 6 },
  { keys: ["duplicate", "identity", "same person", "review", "merge"], chip: 7 },
  { keys: ["corrected", "remediat", "fixed", "250"], chip: 8 },
  { keys: ["oldest", "eldest"], chip: 9 },
];

/**
 * Questions this page must refuse before it tries to match them.
 *
 * Keyword matching alone is not enough, and testing found why: "what should this
 * patient's insulin dose be?" contains "insulin", matched the medication
 * question, and returned a confident table of patients. A clinical-advice
 * question answered with data is worse than no answer at all, so advice-seeking
 * phrasing is caught first and refused on its own terms.
 */
const OUT_OF_SCOPE: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\b(should|dose|dosage|prescrib|titrat|recommend|advis|treat|diagnos|is it safe|ought to|how much .* (give|take))\b/i,
    reason:
      "This does not give clinical advice. It reports who is overdue for a test and what the data quality layer did — it cannot tell you what to do about any patient. That is a decision for a clinician with the whole record in front of them.",
  },
  {
    pattern: /\b(note|narrative|dictation|transcript|chart note|free[- ]?text|imaging|x-?ray|radiolog|scan|claim|billing|insurance)\b/i,
    reason:
      "That data is not here. Clinical notes, imaging and claims are explicit non-goals for this project — the warehouse holds structured conditions, observations, medications and encounters only. Ask about the care-gap cohort or the data quality layer instead.",
  },
  {
    // Plausible clinical subjects that are simply not in this warehouse. Testing
    // found "how many patients had a colonoscopy?" matching on the phrase "how
    // many" and returning the diabetes gap count - a confidently wrong answer.
    pattern: /\b(colonoscop|mammogra|screening|cholesterol|lipid|blood pressure|bp\b|vaccin|immunis|immuniz|smoking|bmi|weight|allerg|procedure|surgery|admission rate|readmission)\b/i,
    reason:
      "This only answers questions about the diabetes A1c care gap and the data quality layer behind it. Other measures, procedures and vitals are in the warehouse but not in the tables this page can query, so there is no honest answer to give.",
  },
  {
    pattern: /\b(ssn|social security|address|phone|email|next of kin|contact details)\b/i,
    reason:
      "No role here can see contact or identifying details beyond a record number, and the source data has none anyway. What is available is age, sex, care setting, and the care-gap fields this role is permitted.",
  },
];

export function checkScope(input: string): string | null {
  for (const rule of OUT_OF_SCOPE) if (rule.pattern.test(input)) return rule.reason;
  return null;
}

export function matchIntent(input: string): Chip | null {
  const q = input.toLowerCase();
  let best: { chip: number; score: number } | null = null;
  for (const intent of INTENTS) {
    const score = intent.keys.filter((k) => q.includes(k)).length;
    if (score > 0 && (!best || score > best.score)) best = { chip: intent.chip, score };
  }
  return best ? CHIPS[best.chip] : null;
}

export const REFUSAL =
  "I can't answer that one. This page answers questions about the diabetes care-gap cohort — how many patients have an open gap, who is overdue, the breakdown by age or care setting — and about the data quality layer: what was quarantined, what was corrected, and which records are awaiting an identity decision. It has no clinical notes, no imaging, no claims, and it gives no clinical advice. You can also type a SELECT statement directly.";
