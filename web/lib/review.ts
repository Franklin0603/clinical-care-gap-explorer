/**
 * "Review this project": the feedback a visitor chooses to give, and the one
 * record it becomes.
 *
 * There is no feedback service behind this static site yet. The form is real
 * and so is the record it builds; sending it needs an endpoint, configured
 * with NEXT_PUBLIC_REVIEW_ENDPOINT at build time. Without one, sendReview says
 * so and nothing leaves the browser. The contract the endpoint must accept is
 * documented in docs/planning/review-api.md.
 *
 * Nothing here may carry patient information. The page a review was opened
 * from is recorded with any patient identifier replaced, query strings and
 * fragments are dropped, and free text that looks like a record identifier is
 * flagged so the reviewer can take it out before sending.
 */

export const REVIEW_ROLES = [
  "Physician / clinician",
  "Nurse / care team",
  "Healthcare leader",
  "Health informatics / data",
  "Data / software engineer",
  "Recruiter / hiring manager",
  "Student / educator",
  "Other",
] as const;
export type ReviewRole = (typeof REVIEW_ROLES)[number];

export const STANDOUT_AREAS = [
  "Care-gap workflow",
  "Patient workspace",
  "Analytics",
  "Ask AI",
  "Data & Quality",
  "Learn / educational content",
  "Technical case study",
] as const;
export type StandoutArea = (typeof STANDOUT_AREAS)[number];

/** The words at each end of a 1-5 scale, for screen readers and the legend. */
export const SCALES = {
  clarity: { 1: "Not clear", 5: "Very clear" },
  usefulness: { 1: "Not useful", 5: "Very useful" },
} as const;

/** Longest free-text answer accepted, in characters. */
export const MAX_TEXT = 2000;

export type ReviewAnswers = {
  role: ReviewRole | "";
  clarity: number | null;
  usefulness: number | null;
  standout: StandoutArea | "";
  improve: string;
  email: string;
};

export const EMPTY_ANSWERS: ReviewAnswers = { role: "", clarity: null, usefulness: null, standout: "", improve: "", email: "" };

/** The record sent to the feedback endpoint. Versioned, so the endpoint can
 *  accept old and new shapes side by side. */
export type ReviewSubmission = {
  version: 2;
  /** ISO 8601, UTC. */
  submittedAt: string;
  /** The application page the review was opened from, identifiers removed. */
  page: string;
  role: ReviewRole;
  /** 1 (not clear) to 5 (very clear). */
  clarity: number;
  /** 1 (not useful) to 5 (very useful). */
  usefulness: number;
  standout: StandoutArea;
  improve: string | null;
  email: string | null;
};

/**
 * The page path with anything that could identify a patient taken out:
 * the patient segment of a record URL, any id-like segment, the query string
 * and the fragment. "/patients/bc501e5b-.../" becomes "/patients/[patient]".
 */
export function sanitizePage(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || "/";
  const parts = path.split("/").filter(Boolean).map((seg, i, all) => {
    if (i > 0 && all[i - 1] === "patients") return "[patient]";
    return ID_LIKE.test(seg) ? "[id]" : seg;
  });
  return "/" + parts.join("/");
}

/** A UUID, or a run of 8+ hex characters with at least one digit (an MRN). */
const ID_LIKE = /^(?=[0-9a-f-]*\d)[0-9a-f]{8}(?:-?[0-9a-f]{4,})*$/i;
const ID_IN_TEXT = /\b(?=[0-9a-f-]*\d)[0-9a-f]{8}(?:-[0-9a-f]{4}){0,4}\b/i;

/** True when free text contains something shaped like a record identifier. */
export function looksLikeIdentifier(text: string): boolean {
  return ID_IN_TEXT.test(text);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ReviewErrors = Partial<Record<keyof ReviewAnswers, string>>;

const rated = (n: number | null) => n != null && n >= 1 && n <= 5;

/** What must be fixed before the review can be sent. The four choice
 *  questions are required; the free text and the email are not. */
export function validateReview(a: ReviewAnswers): ReviewErrors {
  const e: ReviewErrors = {};
  if (!a.role) e.role = "Choose the option that describes you best.";
  if (!rated(a.clarity)) e.clarity = "Choose a rating from 1 to 5.";
  if (!rated(a.usefulness)) e.usefulness = "Choose a rating from 1 to 5.";
  if (!a.standout) e.standout = "Choose the part that stood out most.";
  if (a.improve.length > MAX_TEXT) e.improve = `Keep this under ${MAX_TEXT.toLocaleString("en-US")} characters.`;
  else if (looksLikeIdentifier(a.improve)) e.improve = "This looks like it contains a record identifier. Please remove it.";
  if (a.email.trim() && !EMAIL.test(a.email.trim())) e.email = "Enter an email address, or leave it empty.";
  return e;
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

/** The record to send. Call only once validateReview returns no errors. */
export function buildSubmission(a: ReviewAnswers, pathname: string, now: Date = new Date()): ReviewSubmission {
  if (!a.role || a.clarity == null || a.usefulness == null || !a.standout) {
    throw new Error("buildSubmission called with an incomplete review");
  }
  return {
    version: 2,
    submittedAt: now.toISOString(),
    page: sanitizePage(pathname),
    role: a.role,
    clarity: a.clarity,
    usefulness: a.usefulness,
    standout: a.standout,
    improve: orNull(a.improve),
    email: orNull(a.email),
  };
}

/** The review as plain text, for a reviewer who wants to keep or send it
 *  themselves while no endpoint is configured. */
export function reviewAsText(s: ReviewSubmission): string {
  const line = (k: string, v: string | number | null) => `${k}: ${v ?? "-"}`;
  return [
    "Care Gap Explorer review",
    line("Submitted", s.submittedAt),
    line("Opened from", s.page),
    line("Describes me", s.role),
    line("Purpose clarity (1-5)", s.clarity),
    line("Usefulness (1-5)", s.usefulness),
    line("Stood out most", s.standout),
    line("Would improve or add", s.improve),
    line("Email", s.email),
  ].join("\n");
}

export const REVIEW_ENDPOINT = process.env.NEXT_PUBLIC_REVIEW_ENDPOINT ?? "";

export type SendResult =
  | { ok: true }
  | { ok: false; reason: "not-configured" }
  | { ok: false; reason: "failed"; status?: number };

/**
 * POST the record as JSON. With no endpoint configured it sends nothing and
 * says so; it never reports success it did not get.
 */
export async function sendReview(
  s: ReviewSubmission,
  endpoint: string = REVIEW_ENDPOINT,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  if (!endpoint) return { ok: false, reason: "not-configured" };
  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    return res.ok ? { ok: true } : { ok: false, reason: "failed", status: res.status };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
