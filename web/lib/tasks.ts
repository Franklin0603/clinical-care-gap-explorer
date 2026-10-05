/**
 * Follow-up tasks: application workflow data, never clinical data.
 *
 * The clinical source has no outreach, scheduling, assignment or order
 * records, so nothing here comes from it. A task is state this application
 * keeps about what a user is doing about a gap - and it is kept apart from the
 * clinical row on purpose: no function in this file reads or writes gap_flag,
 * last_a1c_* or days_overdue, and a task's status never changes a patient's
 * gap status. Completing a task does not make an overdue patient current; only
 * a qualifying A1c result in the source data does, through lib/cohort.ts.
 *
 * Every open gap has a task from the start, in its initial state: Needs
 * review, unassigned, no due date, no activity. That initial task is derived,
 * not stored, and carries no events - nothing is invented about the past. A
 * task is stored only once someone changes it, and every change appends one
 * event stamped with the real time it was made.
 *
 * Pure functions only (no storage, no Date.now() unless passed in), so
 * `node --test` can check them.
 */

import type { PatientRow } from "./data";

export type TaskStatus =
  | "needs_review" | "outreach_needed" | "contacted" | "scheduled"
  | "unable_to_reach" | "completed" | "closed";

/** Labels and the order the lifecycle runs in. Unable to reach sits beside
 *  the main path, not on it. */
export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "needs_review", label: "Needs review" },
  { key: "outreach_needed", label: "Outreach needed" },
  { key: "contacted", label: "Contacted" },
  { key: "scheduled", label: "Scheduled" },
  { key: "unable_to_reach", label: "Unable to reach" },
  { key: "completed", label: "Completed" },
  { key: "closed", label: "Closed" },
];
export const statusLabel = (s: TaskStatus) => TASK_STATUSES.find((t) => t.key === s)?.label ?? s;

/** A task counts as open until it is completed or closed. */
export const isOpen = (s: TaskStatus) => s !== "completed" && s !== "closed";

/** The only user there is: the demo has no sign-in. */
export const DEMO_USER = "Demo user";

export type TaskEvent = {
  /** ISO timestamp of when the user made the change, in this browser. */
  at: string;
  by: string;
  kind: "status" | "assignee" | "due" | "note";
  from?: string | null;
  to?: string | null;
  text?: string;
};

export type Task = {
  patientId: string;
  status: TaskStatus;
  assignee: string | null;
  /** ISO date, no time. */
  due: string | null;
  events: TaskEvent[];
};

export type TaskStore = Record<string, Task>;

/** The task every open gap starts with: no activity, nothing assumed. */
export const initialTask = (patientId: string): Task => ({
  patientId, status: "needs_review", assignee: null, due: null, events: [],
});

/** Every open gap's task: the stored one if it has been touched, else the
 *  initial one. Tasks stored for patients who no longer have a gap are kept
 *  and returned too, so work recorded is never silently dropped. */
export function tasksFor(rows: PatientRow[], store: TaskStore): Task[] {
  const out = new Map<string, Task>();
  for (const r of rows) {
    if (!r.gap_flag) continue;
    const id = String(r.patient_id);
    out.set(id, store[id] ?? initialTask(id));
  }
  for (const [id, t] of Object.entries(store)) if (!out.has(id)) out.set(id, t);
  return [...out.values()];
}

export type Change =
  | { kind: "status"; to: TaskStatus }
  | { kind: "assignee"; to: string | null }
  | { kind: "due"; to: string | null }
  | { kind: "note"; text: string };

/** Apply one user change, appending exactly one event. A change to the value
 *  it already has, or an empty note, does nothing - no empty events. */
export function applyChange(task: Task, c: Change, now: string, by = DEMO_USER): Task {
  if (c.kind === "note") {
    const text = c.text.trim();
    if (!text) return task;
    return { ...task, events: [...task.events, { at: now, by, kind: "note", text }] };
  }
  const key = c.kind === "status" ? "status" : c.kind === "assignee" ? "assignee" : "due";
  const from = task[key] as string | null;
  if (from === c.to) return task;
  return {
    ...task,
    [key]: c.to,
    events: [...task.events, { at: now, by, kind: c.kind, from, to: c.to }],
  };
}

/**
 * The next steps offered as one-click actions from each status. The status
 * menu still allows any move; these are the usual ones.
 */
export const QUICK_ACTIONS: Record<TaskStatus, { to: TaskStatus; label: string }[]> = {
  needs_review: [{ to: "outreach_needed", label: "Mark reviewed" }],
  outreach_needed: [{ to: "contacted", label: "Mark contacted" }, { to: "unable_to_reach", label: "Mark unable to reach" }],
  contacted: [{ to: "scheduled", label: "Mark scheduled" }, { to: "unable_to_reach", label: "Mark unable to reach" }],
  scheduled: [{ to: "completed", label: "Mark completed" }],
  unable_to_reach: [{ to: "outreach_needed", label: "Mark outreach needed" }, { to: "closed", label: "Close task" }],
  completed: [{ to: "closed", label: "Close task" }],
  closed: [{ to: "needs_review", label: "Reopen" }],
};

/* ---------------------------------------------------------------- dates */

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Today's date in the user's own time zone, as ISO. Workflow time is the
 *  user's real clock, not the clinical data date. */
export function localToday(now: Date): string {
  return isoDay(new Date(now.getTime() - now.getTimezoneOffset() * 60_000));
}

export type DueBucket = "overdue" | "today" | "week" | "later" | "none";

/** Where a due date falls relative to today. "This week" is the next six
 *  days after today. Tasks already finished are never overdue. */
export function dueBucket(t: Task, today: string): DueBucket {
  if (!t.due) return "none";
  if (t.due < today) return isOpen(t.status) ? "overdue" : "later";
  if (t.due === today) return "today";
  const days = Math.round((Date.parse(t.due) - Date.parse(today)) / DAY);
  return days <= 6 ? "week" : "later";
}

/* -------------------------------------------------------------- filters */

export type TaskFilters = {
  query: string;
  status: TaskStatus | "all" | "open";
  gap: "all" | "never" | "overdue";
  assignment: "all" | "me" | "unassigned";
  due: "all" | "overdue" | "today" | "week" | "none";
};

export const NO_TASK_FILTERS: TaskFilters = { query: "", status: "all", gap: "all", assignment: "all", due: "all" };

/** Narrow tasks by workflow fields, and by gap type via the caller's
 *  `gapOf` - the clinical status still comes from lib/cohort.ts. */
export function filterTasks(
  tasks: Task[], f: TaskFilters, today: string,
  rowOf: (id: string) => PatientRow | undefined,
  gapOf: (r: PatientRow) => "current" | "never" | "overdue",
): Task[] {
  const q = f.query.trim().toLowerCase();
  return tasks.filter((t) => {
    const r = rowOf(t.patientId);
    if (q && !String(r?.mrn ?? "").toLowerCase().startsWith(q)) return false;
    if (f.status === "open" && !isOpen(t.status)) return false;
    if (f.status !== "all" && f.status !== "open" && t.status !== f.status) return false;
    if (f.gap !== "all" && (!r || gapOf(r) !== f.gap)) return false;
    if (f.assignment === "me" && t.assignee !== DEMO_USER) return false;
    if (f.assignment === "unassigned" && t.assignee !== null) return false;
    if (f.due !== "all") {
      const b = dueBucket(t, today);
      if (f.due === "week" ? !(b === "today" || b === "week") : b !== f.due) return false;
    }
    return true;
  });
}

/**
 * Counts for the summary row, from the task records themselves. They add up
 * by construction: total = open + completed + closed, and the open statuses
 * sum to open. Closed is kept apart from completed - a task closed after
 * "unable to reach" is finished, but the follow-up work was not completed.
 */
export function taskCounts(tasks: Task[]) {
  const by = (s: TaskStatus) => tasks.filter((t) => t.status === s).length;
  return {
    total: tasks.length,
    open: tasks.filter((t) => isOpen(t.status)).length,
    needsReview: by("needs_review"),
    outreachNeeded: by("outreach_needed"),
    contacted: by("contacted"),
    scheduled: by("scheduled"),
    unableToReach: by("unable_to_reach"),
    completed: by("completed"),
    closed: by("closed"),
  };
}

/* --------------------------------------------------------------- sorting */

/**
 * Sort orders for the follow-up queue. Operational, not clinical: none of
 * them is a risk score.
 *
 *   due        due date, soonest first; tasks with no due date last
 *   activity   most recently changed first; untouched tasks last
 *   care-gaps  the same order as the Care Gaps page - the pipeline's worklist
 *              rank: never tested first (older patients first), then most days
 *              overdue. A deterministic rule from the data, not a model.
 *
 * Ties in every order fall back to the Care Gaps order, then patient id, so
 * the list never shuffles.
 */
export type TaskSort = "due" | "activity" | "care-gaps";

export const TASK_SORTS: Record<TaskSort, string> = {
  due: "Due date, soonest",
  activity: "Last activity, most recent",
  "care-gaps": "Care Gaps order",
};

export function sortTasks(
  tasks: Task[], by: TaskSort, rowOf: (id: string) => PatientRow | undefined,
): Task[] {
  const rank = (t: Task) => Number(rowOf(t.patientId)?.priority ?? Infinity);
  const last = (t: Task) => t.events.at(-1)?.at ?? "";
  const tie = (a: Task, b: Task) => rank(a) - rank(b) || a.patientId.localeCompare(b.patientId);
  const cmp: Record<TaskSort, (a: Task, b: Task) => number> = {
    due: (a, b) => (a.due ?? "9999-12-31").localeCompare(b.due ?? "9999-12-31"),
    activity: (a, b) => last(b).localeCompare(last(a)),
    "care-gaps": () => 0,
  };
  return [...tasks].sort((a, b) => cmp[by](a, b) || tie(a, b));
}

/**
 * An event in a few words, for the queue's Last action column and the
 * follow-up card: "Needs review → Outreach needed", "Note added". The task
 * workspace's activity list keeps the full sentence (describeEvent). Due
 * dates are passed through `day` so the caller formats them.
 */
export function shortEvent(e: TaskEvent, day: (iso: string) => string = (d) => d): string {
  switch (e.kind) {
    case "status": return `${statusLabel(e.from as TaskStatus)} → ${statusLabel(e.to as TaskStatus)}`;
    case "assignee": return e.to ? `Assigned: ${e.to}` : "Unassigned";
    case "due": return e.to ? `Due ${day(e.to)}` : "Due date removed";
    case "note": return "Note added";
  }
}

/** One line describing an event, for the activity list and "last action". */
export function describeEvent(e: TaskEvent): string {
  const v = (x: string | null | undefined, empty: string) => (x ? x : empty);
  switch (e.kind) {
    case "status": return `Status changed from ${statusLabel(e.from as TaskStatus)} to ${statusLabel(e.to as TaskStatus)}`;
    case "assignee": return e.to ? `Assigned to ${e.to}` : `Unassigned from ${v(e.from, "nobody")}`;
    case "due": return e.to ? `Due date set to ${e.to}` : "Due date removed";
    case "note": return "Workflow note added";
  }
}

/* ------------------------------------------------------------ storage */

/** Accept only well-formed tasks from storage; anything else is dropped
 *  rather than trusted, so a hand-edited or stale entry cannot break a page. */
export function parseStore(raw: string | null): TaskStore {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return {};
    const ok = new Set(TASK_STATUSES.map((s) => s.key));
    const out: TaskStore = {};
    for (const [id, t] of Object.entries(data as Record<string, Task>)) {
      if (!t || typeof t !== "object" || !ok.has(t.status) || !Array.isArray(t.events)) continue;
      out[id] = {
        patientId: id,
        status: t.status,
        assignee: typeof t.assignee === "string" ? t.assignee : null,
        due: typeof t.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : null,
        events: t.events.filter((e) => e && typeof e.at === "string" && typeof e.kind === "string"),
      };
    }
    return out;
  } catch {
    return {};
  }
}
