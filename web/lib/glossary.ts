/**
 * Definitions for every term the dashboard uses that a reader without a
 * healthcare background would not know.
 *
 * One source for two surfaces: the <Term> component shows these inline where a
 * word appears, and the Introduction page lists them in full. A glossary that
 * only exists on its own page gets read by nobody — the need is contextual,
 * not sequential.
 */

export type Entry = {
  term: string;
  short: string;   // what the inline popover shows — one or two sentences
  long?: string;   // the extra paragraph the full list shows
  tag?: string;    // the code or standard behind it, if there is one
};

export const GLOSSARY: Record<string, Entry> = {
  a1c: {
    term: "A1c",
    tag: "LOINC 4548-4",
    short:
      "A blood test giving average blood sugar over about three months. Under 5.7% is normal, 5.7–6.4 prediabetes, 6.5 and above diabetes.",
    long:
      "It measures the fraction of haemoglobin that has sugar permanently attached. Red blood cells live about 120 days, so the number integrates roughly three months of exposure — a patient cannot fast the morning of the test and produce a good one. That is why it defines the care gap here and blood glucose does not.",
  },
  "care gap": {
    term: "Care gap",
    short:
      "A patient who qualifies for a routine piece of care and has not received it. Here: a diabetic with no A1c result in twelve months.",
    long:
      "The list gets handed to somebody who picks up a phone, which is what makes a wrong list expensive in both directions — a false positive wastes a call, a false negative leaves a patient invisible.",
  },
  cohort: {
    term: "Cohort",
    short:
      "The set of patients a measure applies to. Here: 116 people carrying any of eight diabetes codes who were alive on the as-of date.",
    long:
      "Getting it wrong invalidates everything downstream, which is why it lives in one file with every code written out and every exclusion explained. 161 patients carry a diabetes code; 45 of them died before the as-of date, and a care-gap list is a call list.",
  },
  snomed: {
    term: "SNOMED CT",
    tag: "e.g. 44054006",
    short:
      "The international vocabulary for diagnoses — a number per condition, used instead of free text.",
    long:
      'One system writes "Diabetes mellitus type 2", another "T2DM", another "NIDDM". All three mean the same thing and no text match catches them all, so healthcare stores the code and joins on that.',
  },
  loinc: {
    term: "LOINC",
    tag: "e.g. 4548-4",
    short: "The vocabulary for lab tests and measurements — what was measured.",
    long:
      "A LOINC code identifies a question, not an answer: 4548-4 means 'the proportion of haemoglobin that is glycated, in blood'. The value and its unit are stored separately, which is exactly where unit errors live.",
  },
  rxnorm: {
    term: "RxNorm",
    tag: "e.g. 860975",
    short: "The vocabulary for medications — what was prescribed.",
  },
  hedis: {
    term: "HEDIS",
    short:
      "A set of quality measures published by NCQA. Health plans are scored against them and money moves on the score.",
    long:
      "It matters here for one reason: the twelve-month threshold is not invented. Using a published rule rather than a plausible-sounding one is the difference between a care-gap report and a demo. The real specification is far stricter than what this implements, and the app says so.",
  },
  prediabetes: {
    term: "Prediabetes",
    tag: "SNOMED 714628002",
    short:
      "Blood sugar above normal but below the diagnostic threshold for diabetes. Not diabetes, and excluded from the cohort.",
    long:
      "439 patients carry it. Including them would roughly triple the denominator and make every percentage on this site wrong — they do not qualify for the measure.",
  },
  encounter: {
    term: "Encounter",
    short:
      "One interaction with the health system — a visit, an admission, a phone consult. Most clinical data hangs off an encounter.",
  },
  mrn: {
    term: "MRN",
    tag: "medical record number",
    short:
      "The ID a hospital assigns a patient. Local to that organisation, so one person can hold several.",
    long:
      "Which is why duplicate-patient detection is a real problem rather than a contrived one, and why this pipeline routes suspected duplicates to a human instead of merging them.",
  },
  phi: {
    term: "PHI",
    tag: "protected health information",
    short:
      "Identifiable patient data, legally protected under HIPAA in the US. None is involved here — every patient is synthetic.",
  },
  "value set": {
    term: "Value set",
    short:
      "The list of codes that defines a measure's population. Published measures use lists of dozens rather than single codes.",
    long:
      "This project found out why: 73 patients carry a complication of diabetes with no diabetes diagnosis code. Anchor on the one obvious code and 45% of the cohort disappears — the sicker half.",
  },
  bronze: {
    term: "Bronze",
    short:
      "The raw layer. Every column loaded as text, nothing cast, deduped or filtered — a photocopy of what arrived.",
    long:
      "Loading as text is deliberate. Let the loader infer types and it will quietly null whatever does not fit; a third of observations here carry text results, so inference would be a coin flip about which rows survive.",
  },
  silver: {
    term: "Silver",
    short:
      "The validated layer. Typed, with every rejected row sent to quarantine with a reason attached.",
  },
  gold: {
    term: "Gold",
    short:
      "The reporting layer — one row per diabetic patient. Sourced from Silver only, so quarantined data never reaches a report.",
  },
  quarantine: {
    term: "Quarantine",
    short:
      "Where a rejected row goes instead of being deleted, with the reason and the check that rejected it.",
    long:
      "Somebody will eventually ask why a patient is missing from a report. This is how that question gets an answer instead of a shrug. For every table, bronze rows = silver rows + quarantined rows, asserted on every run.",
  },
  "as-of date": {
    term: "As-of date",
    tag: "2026-08-23",
    short:
      "The fixed 'today' every age and every twelve-month window is computed against.",
    long:
      "The simulated data ends on that date. With a wall-clock today, every patient crosses the twelve-month line eventually — 25 gaps becomes 116 of 116 within a year — so the report would describe the calendar rather than the data.",
  },
  denominator: {
    term: "Denominator",
    short:
      "The patients a rate is measured against. Here 116 — the cohort alive on the as-of date.",
    long:
      "Quoting a percentage without its denominator hides the definition. 25 of 116 and 69 of 161 are the same data with different exclusion rules.",
  },
  "catch rate": {
    term: "Catch rate",
    short:
      "Defects the checks found, divided by defects deliberately injected. 6 of 6 types, 249 of 249 rows.",
    long:
      "Without injecting known defects first, 'I found twelve problems' says nothing about whether that was twelve of twelve or twelve of four hundred. The injection log is what turns a claim into a measurement.",
  },
};

/** The order the Introduction page lists them in — grouped, not alphabetical. */
export const GLOSSARY_GROUPS: { title: string; blurb: string; keys: string[] }[] = [
  {
    title: "The measure",
    blurb: "What is being counted, and for whom.",
    keys: ["care gap", "a1c", "cohort", "denominator", "prediabetes", "as-of date"],
  },
  {
    title: "How healthcare stores things",
    blurb:
      "Clinical data is stored as codes rather than words, because free text does not survive contact with reality.",
    keys: ["snomed", "loinc", "rxnorm", "value set", "encounter", "mrn", "phi", "hedis"],
  },
  {
    title: "How this pipeline is built",
    blurb: "Engineering terms, not clinical ones.",
    keys: ["bronze", "silver", "gold", "quarantine", "catch rate"],
  },
];
