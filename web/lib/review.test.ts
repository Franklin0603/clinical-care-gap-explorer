/**
 * The review record must never carry patient information, must never claim
 * to have been sent when it was not, and must hold only what the reviewer
 * chose to give.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_ANSWERS, MAX_TEXT, buildSubmission, looksLikeIdentifier, reviewAsText, sanitizePage, sendReview, validateReview,
} from "./review.ts";
import type { ReviewAnswers } from "./review.ts";

const filled: ReviewAnswers = { ...EMPTY_ANSWERS, role: "Nurse / care team", clarity: 4, usefulness: 5, standout: "Patient workspace" };

test("a patient record URL keeps its route but loses the patient", () => {
  assert.equal(sanitizePage("/patients/bc501e5b-fcda-52ea-6bc4-d2c3c5598e91/"), "/patients/[patient]");
  assert.equal(sanitizePage("/patients/"), "/patients");
});

test("query strings and fragments are dropped", () => {
  assert.equal(sanitizePage("/care-gaps/?status=never&q=dd31b260"), "/care-gaps");
  assert.equal(sanitizePage("/learn/care-teams/#how-it-works"), "/learn/care-teams");
  assert.equal(sanitizePage("/"), "/");
});

test("an id-like segment anywhere else is replaced too", () => {
  assert.equal(sanitizePage("/something/dd31b260"), "/something/[id]");
  assert.equal(sanitizePage("/data-quality"), "/data-quality");
});

test("text with an MRN or a UUID is flagged; ordinary text is not", () => {
  assert.ok(looksLikeIdentifier("Patient dd31b260 was confusing"));
  assert.ok(looksLikeIdentifier("see bc501e5b-fcda-52ea-6bc4-d2c3c5598e91"));
  assert.ok(!looksLikeIdentifier("The dashboard was great, 116 patients, 2026"));
  assert.ok(!looksLikeIdentifier("deadbeef-free words like accepted"));
});

test("the four choice questions are required; text and email are not", () => {
  const e = validateReview(EMPTY_ANSWERS);
  assert.deepEqual(Object.keys(e).sort(), ["clarity", "role", "standout", "usefulness"]);
  assert.deepEqual(validateReview(filled), {});
});

test("an identifier in free text blocks sending", () => {
  const e = validateReview({ ...filled, improve: "Fix MRN dd31b260" });
  assert.ok(e.improve);
});

test("over-long text and a malformed email are caught", () => {
  const e = validateReview({ ...filled, improve: "x".repeat(MAX_TEXT + 1), email: "not-an-email" });
  assert.ok(e.improve);
  assert.ok(e.email);
});

test("the record holds the answers, with blanks as null and the page sanitised", () => {
  const s = buildSubmission({ ...filled, improve: "  ", email: " a@b.org " }, "/patients/abc12345/", new Date("2026-10-06T12:00:00Z"));
  assert.equal(s.version, 2);
  assert.equal(s.submittedAt, "2026-10-06T12:00:00.000Z");
  assert.equal(s.page, "/patients/[patient]");
  assert.equal(s.role, "Nurse / care team");
  assert.equal(s.clarity, 4);
  assert.equal(s.usefulness, 5);
  assert.equal(s.standout, "Patient workspace");
  assert.equal(s.improve, null);
  assert.equal(s.email, "a@b.org");
  assert.match(reviewAsText(s), /Describes me: Nurse \/ care team/);
});

test("a rating outside 1-5 is not accepted", () => {
  assert.ok(validateReview({ ...filled, usefulness: 6 }).usefulness);
  assert.ok(validateReview({ ...filled, clarity: 0 }).clarity);
});

test("with no endpoint nothing is sent and the result says so", async () => {
  let called = false;
  const fake = (async () => { called = true; return new Response(null, { status: 200 }); }) as typeof fetch;
  const r = await sendReview(buildSubmission(filled, "/home"), "", fake);
  assert.deepEqual(r, { ok: false, reason: "not-configured" });
  assert.equal(called, false);
});

test("a configured endpoint gets the JSON; a failure is reported as one", async () => {
  let body = "";
  const ok = (async (_u: unknown, init?: RequestInit) => { body = String(init?.body); return new Response(null, { status: 201 }); }) as typeof fetch;
  assert.deepEqual(await sendReview(buildSubmission(filled, "/home"), "https://example.test/reviews", ok), { ok: true });
  assert.equal(JSON.parse(body).role, "Nurse / care team");
  const bad = (async () => new Response(null, { status: 500 })) as typeof fetch;
  assert.deepEqual(await sendReview(buildSubmission(filled, "/home"), "https://example.test/reviews", bad), { ok: false, reason: "failed", status: 500 });
  const down = (async () => { throw new Error("offline"); }) as typeof fetch;
  assert.deepEqual(await sendReview(buildSubmission(filled, "/home"), "https://example.test/reviews", down), { ok: false, reason: "failed" });
});
