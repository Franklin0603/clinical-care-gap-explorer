/**
 * Tasks are workflow state. These tests hold the line between that state and
 * the clinical data: tasks start empty-handed, change only when told to, and
 * never touch a patient's gap status.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { cohortSummary, gapStatus } from "./cohort.ts";
import {
  DEMO_USER, NO_TASK_FILTERS, QUICK_ACTIONS, TASK_STATUSES, applyChange, dueBucket, filterTasks,
  initialTask, isOpen, localToday, parseStore, taskCounts, tasksFor,
} from "./tasks.ts";

const rows = JSON.parse(readFileSync(new URL("../public/data/care_gap_full.json", import.meta.url), "utf8"));
const gold = JSON.parse(readFileSync(new URL("../public/data/gold_report.json", import.meta.url), "utf8"));
const byId = new Map(rows.map((r: { patient_id: string }) => [r.patient_id, r]));
const rowOf = (id: string) => byId.get(id) as never;
const NOW = "2026-10-04T23:15:00.000Z";

test("every open gap has a task, in its initial state, with no invented activity", () => {
  const tasks = tasksFor(rows, {});
  assert.equal(tasks.length, gold.open_gaps);
  for (const t of tasks) {
    assert.deepEqual(t, initialTask(t.patientId));
    assert.equal(t.events.length, 0, "no events until a user acts");
    assert.equal((byId.get(t.patientId) as { gap_flag: boolean }).gap_flag, true);
  }
  assert.deepEqual(taskCounts(tasks), {
    total: gold.open_gaps, open: gold.open_gaps, needsReview: gold.open_gaps,
    outreachNeeded: 0, scheduled: 0, completed: 0,
  });
});

test("a change appends exactly one event, and a no-op appends none", () => {
  const t0 = initialTask("p");
  const t1 = applyChange(t0, { kind: "status", to: "outreach_needed" }, NOW);
  assert.equal(t1.status, "outreach_needed");
  assert.deepEqual(t1.events, [{ at: NOW, by: DEMO_USER, kind: "status", from: "needs_review", to: "outreach_needed" }]);
  assert.equal(applyChange(t1, { kind: "status", to: "outreach_needed" }, NOW), t1, "same value: no event");
  assert.equal(applyChange(t1, { kind: "note", text: "   " }, NOW), t1, "empty note: no event");
  const t2 = applyChange(t1, { kind: "note", text: " Review at next outreach. " }, NOW);
  assert.equal(t2.events.at(-1)!.text, "Review at next outreach.");
  assert.equal(t0.events.length, 0, "the original is not mutated");
});

test("completing every task changes no patient's clinical status", () => {
  const before = rows.map((r: never) => gapStatus(r));
  const sBefore = cohortSummary(rows, gold.asof);
  const store: Record<string, ReturnType<typeof initialTask>> = {};
  for (const t of tasksFor(rows, {})) store[t.patientId] = applyChange(t, { kind: "status", to: "completed" }, NOW);
  assert.deepEqual(rows.map((r: never) => gapStatus(r)), before);
  assert.deepEqual(cohortSummary(rows, gold.asof), sBefore);
  assert.equal(taskCounts(tasksFor(rows, store)).completed, gold.open_gaps);
  assert.equal(taskCounts(tasksFor(rows, store)).open, 0);
});

test("filters: status, gap type, assignment and due date", () => {
  const ids = tasksFor(rows, {}).map((t) => t.patientId);
  const store = {
    [ids[0]]: { ...initialTask(ids[0]), status: "scheduled" as const, assignee: DEMO_USER, due: "2026-10-04" },
    [ids[1]]: { ...initialTask(ids[1]), status: "contacted" as const, due: "2026-10-01" },
    [ids[2]]: { ...initialTask(ids[2]), status: "completed" as const, due: "2026-10-01" },
  };
  const tasks = tasksFor(rows, store);
  const today = "2026-10-04";
  const n = (f: Partial<typeof NO_TASK_FILTERS>) => filterTasks(tasks, { ...NO_TASK_FILTERS, ...f }, today, rowOf, gapStatus).length;
  assert.equal(n({}), gold.open_gaps);
  assert.equal(n({ status: "scheduled" }), 1);
  assert.equal(n({ status: "open" }), gold.open_gaps - 1);
  assert.equal(n({ gap: "never" }) + n({ gap: "overdue" }), gold.open_gaps);
  assert.equal(n({ gap: "never" }), gold.never_tested);
  assert.equal(n({ assignment: "me" }), 1);
  assert.equal(n({ assignment: "unassigned" }), gold.open_gaps - 1);
  assert.equal(n({ due: "today" }), 1);
  assert.equal(n({ due: "overdue" }), 1, "a finished task is never overdue");
  assert.equal(n({ due: "none" }), gold.open_gaps - 3);
});

test("due buckets", () => {
  const t = (due: string | null, status = "outreach_needed" as const) => ({ ...initialTask("x"), due, status });
  const today = "2026-10-04";
  assert.equal(dueBucket(t(null), today), "none");
  assert.equal(dueBucket(t("2026-10-03"), today), "overdue");
  assert.equal(dueBucket(t("2026-10-04"), today), "today");
  assert.equal(dueBucket(t("2026-10-10"), today), "week");
  assert.equal(dueBucket(t("2026-10-11"), today), "later");
  assert.equal(localToday(new Date("2026-10-04T12:00:00Z")).length, 10);
});

test("quick actions only lead to real statuses, and every status has a way on", () => {
  const keys = new Set(TASK_STATUSES.map((s) => s.key));
  for (const s of TASK_STATUSES) {
    assert.ok(QUICK_ACTIONS[s.key].length > 0, s.key);
    for (const a of QUICK_ACTIONS[s.key]) assert.ok(keys.has(a.to), `${s.key} -> ${a.to}`);
  }
  assert.equal(isOpen("completed"), false);
  assert.equal(isOpen("unable_to_reach"), true);
});

test("storage: well-formed tasks survive, anything else is dropped", () => {
  const good = { a: { ...initialTask("a"), status: "contacted", events: [{ at: NOW, by: DEMO_USER, kind: "status" }] } };
  assert.equal(parseStore(JSON.stringify(good)).a.status, "contacted");
  assert.deepEqual(parseStore("not json"), {});
  assert.deepEqual(parseStore(JSON.stringify({ b: { status: "teleported", events: [] } })), {});
  assert.equal(parseStore(JSON.stringify({ c: { ...initialTask("c"), due: "tomorrow" } })).c.due, null);
});
