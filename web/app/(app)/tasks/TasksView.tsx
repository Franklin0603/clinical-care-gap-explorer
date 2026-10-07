"use client";

import { ReactNode, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Info, Search, X } from "lucide-react";

import { PatientRow, fmt, patients } from "@/lib/data";
import { gapStatus } from "@/lib/cohort";
import { eventTime, longDate } from "@/lib/dates";
import {
  DEMO_USER, NO_TASK_FILTERS, TASK_SORTS, TASK_STATUSES, Task, TaskFilters, TaskSort, dueBucket,
  filterTasks, localToday, shortEvent, sortTasks, taskCounts, tasksFor,
} from "@/lib/tasks";
import { resetTasks, useTaskStore } from "@/lib/taskStore";
import { GapStatusBadge } from "@/components/GapStatusBadge";
import { Kpi } from "@/components/Kpi";
import { LastSeen, LatestA1c, PatientCell } from "@/components/patient/cells";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { TaskWorkspaceSheet } from "@/components/tasks/TaskWorkspaceSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

/**
 * The follow-up queue: one task per open A1c gap, and what is being done
 * about it. Clinical columns (gap status, last A1c, last seen) come from the
 * report row through the shared cells; workflow columns (task status,
 * assignee, due, last action) come from the task store. The two never mix:
 * nothing here writes to a patient row.
 *
 * Ordered by due date by default - an operational order, not a clinical
 * one. Untouched tasks have no due date and fall back to the Care Gaps order,
 * which is available as its own sort with its rule written out beside it.
 */

const byId = new Map(patients.map((r) => [String(r.patient_id), r]));
const rowOf = (id: string) => byId.get(id);

const STATUS_FILTER: Record<string, string> = {
  all: "Any status", open: "Open tasks",
  ...Object.fromEntries(TASK_STATUSES.map((s) => [s.key, s.label])),
};
const GAP_FILTER: Record<string, string> = { all: "Any gap type", never: "Never tested", overdue: "Overdue" };
const ASSIGN_FILTER: Record<string, string> = { all: "Any assignee", me: DEMO_USER, unassigned: "Unassigned" };
const DUE_FILTER: Record<string, string> = {
  all: "Any due date", overdue: "Overdue tasks", today: "Due today", week: "Due this week", none: "No due date",
};

/** The rule behind each order, shown beside the count so no sort implies a
 *  model the application does not have. */
const SORT_RULE: Record<TaskSort, string> = {
  due: "Soonest due first; tasks without a due date follow in Care Gaps order.",
  activity: "Most recently changed first; untouched tasks follow in Care Gaps order.",
  "care-gaps": "As on Care Gaps: never tested first, then most days overdue. A fixed rule from the data, not a risk score.",
};

const shown = (labels: Record<string, string>) => (v: string | null) => labels[v ?? "all"] ?? v ?? "";

/** Today's date, on the client only - the server has no reader's clock. */
const noop = () => () => {};
function useToday() {
  return useSyncExternalStore(noop, () => localToday(new Date()), () => null);
}

export function TasksFromUrl() {
  return <TasksView initialOpen={useSearchParams().get("open")} />;
}

export function TasksView({ initialOpen = null }: { initialOpen?: string | null }) {
  const store = useTaskStore();
  const today = useToday();
  const [f, setF] = useState<TaskFilters>(NO_TASK_FILTERS);
  const [sort, setSort] = useState<TaskSort>("due");
  const [openId, setOpenId] = useState<string | null>(initialOpen && byId.has(initialOpen) ? initialOpen : null);

  const tasks = useMemo(() => tasksFor(patients, store), [store]);
  const counts = taskCounts(tasks);
  const rows = useMemo(
    () => sortTasks(filterTasks(tasks, f, today ?? "0000-00-00", rowOf, gapStatus), sort, rowOf),
    [tasks, f, sort, today],
  );

  const set = <K extends keyof TaskFilters>(k: K) => (v: string | null) =>
    setF((cur) => ({ ...cur, [k]: (v ?? NO_TASK_FILTERS[k]) as TaskFilters[K] }));
  const filtering = JSON.stringify(f) !== JSON.stringify(NO_TASK_FILTERS);

  // The open task is in the address (?open=<patient id>), so a link from the
  // patient workspace lands on it and a reload keeps it.
  const open = (id: string) => {
    setOpenId(id);
    window.history.replaceState(null, "", `${window.location.pathname}?open=${encodeURIComponent(id)}`);
  };
  const close = () => {
    setOpenId(null);
    window.history.replaceState(null, "", window.location.pathname);
  };
  const openTask = openId ? tasks.find((t) => t.patientId === openId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <ul aria-label="Task summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Kpi label="Open tasks" value={fmt(counts.open)} context={`of ${fmt(counts.total)} total`} />
          <Kpi label="Needs review" value={fmt(counts.needsReview)} context="open" />
          <Kpi label="Outreach needed" value={fmt(counts.outreachNeeded)} context="open" />
          <Kpi label="Scheduled" value={fmt(counts.scheduled)} context="open" />
          <Kpi label="Completed" value={fmt(counts.completed)} context="workflow done" tone="success" />
        </ul>
        {/* The arithmetic, written out, so the cards can be checked against
            each other at a glance. Statuses with no tasks are left out. */}
        <p className="num text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{fmt(counts.total)} tasks</span>
          {" = "}{fmt(counts.open)} open + {fmt(counts.completed)} completed
          {counts.closed > 0 && <> + {fmt(counts.closed)} closed</>}
          {counts.open > 0 && (
            <>
              {" · Open: "}
              {[
                [counts.needsReview, "needs review"],
                [counts.outreachNeeded, "outreach needed"],
                [counts.contacted, "contacted"],
                [counts.scheduled, "scheduled"],
                [counts.unableToReach, "unable to reach"],
              ].filter(([n]) => Number(n) > 0).map(([n, l]) => `${fmt(Number(n))} ${l}`).join(" · ")}
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={f.query}
            onChange={(e) => set("query")(e.target.value)}
            placeholder="Search by MRN"
            aria-label="Search tasks by MRN"
            className="h-8 pl-8"
          />
        </div>
        <Filter label="Task status" value={f.status} labels={STATUS_FILTER} onChange={set("status")} />
        <Filter label="Gap type" value={f.gap} labels={GAP_FILTER} onChange={set("gap")} />
        <Filter label="Assignment" value={f.assignment} labels={ASSIGN_FILTER} onChange={set("assignment")} />
        <Filter label="Due" value={f.due} labels={DUE_FILTER} onChange={set("due")} />
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-sm text-muted-foreground" id="tasks-sort-label">Sort</span>
          <Select value={sort} onValueChange={(v) => setSort((v as TaskSort | null) ?? "due")}>
            <SelectTrigger aria-labelledby="tasks-sort-label" aria-describedby="tasks-sort-rule" className="min-w-44">
              <SelectValue>{shown(TASK_SORTS)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TASK_SORTS) as TaskSort[]).map((k) => <SelectItem key={k} value={k}>{TASK_SORTS[k]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p aria-live="polite" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {filtering
            ? <><span className="num">{fmt(rows.length)}</span> of <span className="num">{fmt(tasks.length)}</span> tasks</>
            : <><span className="num">{fmt(rows.length)}</span> tasks</>}
        </p>
        <span className="flex items-center gap-3">
          <span id="tasks-sort-rule" className="text-xs text-muted-foreground">
            {SORT_RULE[sort]}
          </span>
          {filtering && (
            <Button variant="ghost" size="sm" onClick={() => setF(NO_TASK_FILTERS)}>
              <X aria-hidden /> Clear filters
            </Button>
          )}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-6 py-10 text-center">
          <p className="text-base font-semibold">No tasks match these filters</p>
          <p className="text-sm text-muted-foreground">Try changing or clearing one or more filters.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setF(NO_TASK_FILTERS)}>Clear filters</Button>
        </div>
      ) : (
        <>
          <div className="hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Patient</TableHead>
                  <TableHead>Gap status</TableHead>
                  <TableHead>Task status</TableHead>
                  <TableHead className="hidden xl:table-cell">Last A1c</TableHead>
                  <TableHead className="hidden lg:table-cell">Last seen</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="hidden lg:table-cell">Last action</TableHead>
                  <TableHead className="pr-4 text-right"><span className="sr-only">Action</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => {
                  const r = rowOf(t.patientId);
                  if (!r) return null;
                  return (
                    <TableRow key={t.patientId}>
                      <TableCell className="py-1.5 pl-4"><PatientCell r={r} onOpen={() => open(t.patientId)} /></TableCell>
                      <TableCell className="py-1.5"><GapStatusBadge status={gapStatus(r)} /></TableCell>
                      <TableCell className="py-1.5"><TaskStatusBadge status={t.status} /></TableCell>
                      <TableCell className="hidden py-1.5 xl:table-cell"><LastA1c r={r} /></TableCell>
                      <TableCell className="hidden py-1.5 lg:table-cell"><LastSeen r={r} /></TableCell>
                      <TableCell className="py-1.5">{t.assignee ?? <Muted>Unassigned</Muted>}</TableCell>
                      <TableCell className="py-1.5"><Due task={t} today={today} /></TableCell>
                      <TableCell className="hidden max-w-56 py-1.5 lg:table-cell"><LastAction task={t} /></TableCell>
                      <TableCell className="py-1.5 pr-4 text-right">
                        <Button variant="outline" size="sm" onClick={() => open(t.patientId)}>
                          Open<span className="sr-only"> task for MRN {String(r.mrn).slice(0, 8)}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((t) => {
              const r = rowOf(t.patientId);
              if (!r) return null;
              return (
                <li key={t.patientId} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <PatientCell r={r} onOpen={() => open(t.patientId)} />
                    <div className="flex flex-col items-end gap-1">
                      <GapStatusBadge status={gapStatus(r)} />
                      <TaskStatusBadge status={t.status} />
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                      <dt className="text-muted-foreground">Assigned</dt>
                      <dd>{t.assignee ?? <Muted>Unassigned</Muted>}</dd>
                      <dt className="text-muted-foreground">Due</dt>
                      <dd><Due task={t} today={today} /></dd>
                    </dl>
                    <Button variant="outline" size="sm" onClick={() => open(t.patientId)}>
                      Open<span className="sr-only"> task for MRN {String(r.mrn).slice(0, 8)}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Disclosure />

      <TaskWorkspaceSheet patient={openTask ? rowOf(openTask.patientId) ?? null : null} task={openTask} onClose={close} />
    </div>
  );
}

function Filter({ label, value, labels, onChange }: {
  label: string; value: string; labels: Record<string, string>; onChange: (v: string | null) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="min-w-32">
        <SelectValue>{shown(labels)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(labels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted-foreground">{children}</span>;

/** Latest A1c with its date; "No result" for the never tested, no date made up. */
function LastA1c({ r }: { r: PatientRow }) {
  return (
    <div className="flex flex-col">
      <LatestA1c r={r} />
      {r.last_a1c_date && <span className="num text-xs text-muted-foreground">{longDate(String(r.last_a1c_date))}</span>}
    </div>
  );
}

function Due({ task, today }: { task: Task; today: string | null }) {
  if (!task.due) return <Muted>No due date</Muted>;
  const late = today ? dueBucket(task, today) === "overdue" : false;
  return (
    <span className={late ? "font-medium text-destructive" : "num"}>
      {longDate(task.due)}
      {late && <span className="block text-xs font-normal">Task overdue</span>}
    </span>
  );
}

function LastAction({ task }: { task: Task }) {
  const e = task.events.at(-1);
  if (!e) return <Muted>No activity yet</Muted>;
  return (
    <div className="flex flex-col">
      <span className="truncate text-sm">{shortEvent(e, (d) => longDate(d) ?? d)}</span>
      <span className="text-xs text-muted-foreground">{eventTime(e.at)}</span>
    </div>
  );
}

function Disclosure() {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
      <p className="flex items-start gap-2">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Tasks are demo workflow data, saved in this browser only. One task starts for each open A1c gap;
        activity appears only when you change something. Nothing here comes from the clinical source or
        changes a patient&apos;s gap status.
      </p>
      {confirm ? (
        <span className="flex items-center gap-2">
          Reset every task to its initial state?
          <Button size="sm" variant="destructive" onClick={() => { resetTasks(); setConfirm(false); }}>Reset</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
        </span>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>Reset demo workflow data</Button>
      )}
    </div>
  );
}

