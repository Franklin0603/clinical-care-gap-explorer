/**
 * The SELECT-only guard.
 *
 * Two kinds of case matter here, and the second kind is why this file exists.
 *
 * The obvious cases are destructive statements: DROP, DELETE, UPDATE. Any check
 * catches those.
 *
 * The cases worth a test are the ones that defeat a naive check. A blocklist on
 * the word "DROP" rejects a harmless `WHERE mrn LIKE '%drop%'`. A check that
 * reads only the first statement passes `SELECT 1; DROP TABLE patients`. And
 * `WITH x AS (SELECT 1) DELETE FROM patients` begins with WITH, contains SELECT,
 * and deletes rows — DuckDB accepts it. That last one passed the first version
 * of this guard, and was found by writing this test rather than by reading the
 * code.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { guardSelectOnly } from "./sql.ts";

const allow: [string, string][] = [
  ["SELECT * FROM patients", "a plain select"],
  ["  select 1  ", "lowercase and padded"],
  ["SELECT * FROM patients;", "a trailing semicolon is not a second statement"],
  ["WITH x AS (SELECT 1) SELECT * FROM x", "a CTE"],
  ["WITH a AS (SELECT 1), b AS (SELECT 2) SELECT * FROM a, b", "several CTEs"],
  ["SELECT * FROM patients WHERE mrn LIKE '%drop%'", "a scary word inside a string"],
  ["SELECT * FROM patients WHERE sex = 'a;b'", "a semicolon inside a string"],
];

const refuse: [string, string][] = [
  ["DROP TABLE patients", "drop"],
  ["DELETE FROM care_gap_a1c", "delete"],
  ["UPDATE patients SET age = 0", "update"],
  ["INSERT INTO patients VALUES (1)", "insert"],
  ["ATTACH 'other.db'", "attach"],
  ["COPY patients TO 'out.csv'", "copy"],
  ["SELECT 1; DROP TABLE patients", "a stacked statement"],
  ["SELECT 1 --; x\n; DROP TABLE patients", "a separator hidden behind a line comment"],
  ["SELECT 1 /* ; */ ; DROP TABLE patients", "a separator hidden in a block comment"],
  ["WITH x AS (SELECT 1) DELETE FROM patients", "a CTE whose statement is a DELETE"],
  ["WITH x AS (SELECT 1) UPDATE patients SET age = 0", "a CTE whose statement is an UPDATE"],
  ["", "nothing at all"],
];

for (const [sql, why] of allow) {
  test(`allows ${why}`, () => {
    assert.equal(guardSelectOnly(sql).ok, true, `should have allowed: ${sql}`);
  });
}

for (const [sql, why] of refuse) {
  test(`refuses ${why}`, () => {
    const result = guardSelectOnly(sql);
    assert.equal(result.ok, false, `should have refused: ${sql}`);
    if (!result.ok) {
      assert.ok(result.reason.length > 20, "a refusal must explain itself in a sentence");
      assert.ok(!/Error|Exception|undefined/.test(result.reason), "no exception text in a refusal");
    }
  });
}
