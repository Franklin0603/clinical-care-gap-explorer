/**
 * What the question box answers, and what it refuses.
 *
 * The failures worth guarding against are not crashes — they are confident
 * wrong answers, which on a clinical page are worse than no answer. Testing
 * found two:
 *
 *   "what should this patient's insulin dose be?" matched the keyword "insulin"
 *   and returned a table of patients on insulin. A clinical advice question,
 *   answered with data.
 *
 *   "how many patients had a colonoscopy?" matched the phrase "how many" and
 *   returned the diabetes gap count.
 *
 * The first produced the scope check; the second is why intent keys name the
 * subject of a question rather than its grammatical form.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { matchIntent, checkScope } from "./chips.ts";

/** What the page does with a question, in the order AskView applies it. */
function outcome(question: string): "answered" | "refused" {
  const looksLikeSql =
    /^\s*(select|with|drop|delete|insert|update|alter|create|truncate|grant|copy|attach|pragma)\b/i;
  if (looksLikeSql.test(question)) return "refused"; // goes to the SQL guard
  if (checkScope(question)) return "refused";
  return matchIntent(question) ? "answered" : "refused";
}

const mustRefuse: [string, string][] = [
  ["what should this patient's insulin dose be?", "clinical advice that mentions a known drug"],
  ["is it safe to stop metformin?", "clinical advice phrased as a safety question"],
  ["diagnose this patient", "clinical advice, imperative"],
  ["what dose of insulin do they need", "clinical advice, no question mark"],
  ["how many patients had a colonoscopy?", "a measure that is not in these tables"],
  ["what is the average cholesterol?", "a lab that is not in these tables"],
  ["what did the doctor write in the note?", "clinical notes, an explicit non-goal"],
  ["show me the patient's social security number", "an identifier no role can see"],
  ["give me their phone number", "contact details the source data does not hold"],
  ["asdkjfh qwerty zzz", "gibberish"],
  ["drop the patients table", "a destructive instruction in plain English"],
];

const mustAnswer: [string, string][] = [
  ["how many patients have an open gap?", "the headline question"],
  ["which patients with a gap are on insulin", "a legitimate medication question"],
  ["break it down by age", "a legitimate stratification"],
  ["why were rows quarantined", "a data quality question"],
  ["show me the duplicate patient records", "the identity review queue"],
  ["what values were corrected", "the remediation log"],
];

for (const [q, why] of mustRefuse) {
  test(`refuses ${why}`, () => {
    assert.equal(outcome(q), "refused", `should have refused: "${q}"`);
  });
}

for (const [q, why] of mustAnswer) {
  test(`answers ${why}`, () => {
    assert.equal(outcome(q), "answered", `should have answered: "${q}"`);
  });
}

test("every refusal names what the page can answer instead", () => {
  const reasons = mustRefuse
    .map(([q]) => checkScope(q))
    .filter((r): r is string => r !== null);
  assert.ok(reasons.length >= 6, "the scope check should be catching most of these");
  for (const reason of reasons) {
    assert.ok(reason.length > 60, "a refusal is a sentence, not a word");
    assert.ok(/\./.test(reason), "a refusal ends in a full stop");
  }
});
