"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, SquareArrowOutUpRight } from "lucide-react";

import { PatientRow } from "@/lib/data";
import { gapStatus } from "@/lib/cohort";
import { eventTime, longDate } from "@/lib/dates";
import { insulinDoc } from "@/lib/patientDetail";
import {
  DEMO_USER, QUICK_ACTIONS, TASK_STATUSES, Task, TaskStatus, describeEvent, isOpen, statusLabel,
} from "@/lib/tasks";
import { updateTask } from "@/lib/taskStore";
import { CareGapAssessment } from "@/components/patient/CareGapAssessment";
import { PatientHeader, PatientSummaryTiles } from "@/components/patient/PatientSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { TaskStatusBadge } from "./TaskStatusBadge";

/**
 * The task workspace: the patient's clinical evidence on the left, the
 * follow-up work on the right, kept visibly apart.
 *
 * Left is clinical source data, from the same components the patient
 * workspace uses. Right is application workflow data - status, assignment,
 * due date, notes and the activity they leave behind - saved in this browser.
 * Nothing on the right can change anything on the left: a completed task on
 * an overdue patient is still an overdue patient.
 */
export function TaskWorkspaceSheet({
  patient, task, onClose,
}: {
  patient: PatientRow | null;
  task: Task | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!patient && !!task} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-[88vw] data-[side=right]:lg:w-[80vw] data-[side=right]:2xl:w-[min(75vw,100rem)]">
        {patient && task && <TaskWorkspace patient={patient} task={task} />}
      </SheetContent>
    </Sheet>
  );
}

function TaskWorkspace({ patient: r, task }: { patient: PatientRow; task: Task }) {
  const id = String(r.patient_id);
  const gapOpen = gapStatus(r) !== "current";
  return (
    <div className="flex flex-col gap-5 p-4 pr-12 sm:p-6 sm:pr-14">
      <SheetDescription className="sr-only">
        Follow-up task for this patient: the clinical evidence for the care gap, and the workflow status, assignment, due date, notes and activity.
      </SheetDescription>
      <PatientHeader
        patient={r}
        Title={SheetTitle}
        badges={<TaskStatusBadge status={task.status} />}
        actions={
          <Link
            href={`/patients/${encodeURIComponent(id)}/?from=tasks`}
            className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Open patient record
            <SquareArrowOutUpRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      <PatientSummaryTiles patient={r} insulin={insulinDoc(Boolean(r.on_insulin), null)} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="flex flex-col gap-2">
          <SourceLabel>Clinical source</SourceLabel>
          <CareGapAssessment patient={r} title="Care-gap evidence" />
        </div>

        <div className="flex flex-col gap-2">
          <SourceLabel>Application workflow</SourceLabel>
          <FollowUp id={id} task={task} gapOpen={gapOpen} />
          <Activity task={task} />
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Task status, assignment, due dates, notes and activity are demo workflow data, saved in this
        browser only. They are not from the clinical source, nothing is sent to a patient, and they never
        change the care-gap status - only a qualifying A1C result does.
      </p>
    </div>
  );
}

function SourceLabel({ children }: { children: string }) {
  return <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{children}</span>;
}

function FollowUp({ id, task, gapOpen }: { id: string; task: Task; gapOpen: boolean }) {
  const [note, setNote] = useState("");
  const done = !isOpen(task.status);
  const field = "flex flex-col gap-1.5";
  const label = "text-xs font-medium text-muted-foreground";

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Follow-up</h2>
        <TaskStatusBadge status={task.status} />
      </div>

      {QUICK_ACTIONS[task.status].length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick actions">
          {QUICK_ACTIONS[task.status].map((a) => (
            <Button key={a.to} size="sm" variant={a.to === "closed" || a.to === "unable_to_reach" ? "outline" : "default"}
              onClick={() => updateTask(id, { kind: "status", to: a.to })}>
              {a.label}
            </Button>
          ))}
        </div>
      )}

      {done && gapOpen && (
        <p className="rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">The care gap is still open.</span>{" "}
          {task.status === "completed"
            ? "Completed means the follow-up work was completed, not that the A1C monitoring gap closed."
            : "Closing the task ends the follow-up work; it does not close the A1C monitoring gap."}{" "}
          Only a qualifying A1C result in the source data closes the gap.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div className={field}>
          <span className={label} id={`status-${id}`}>Task status</span>
          <Select value={task.status} onValueChange={(v) => v && updateTask(id, { kind: "status", to: v as TaskStatus })}>
            <SelectTrigger aria-labelledby={`status-${id}`} className="w-full">
              <SelectValue>{(v: string | null) => statusLabel((v ?? "needs_review") as TaskStatus)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className={field}>
          <span className={label} id={`assignee-${id}`}>Assigned to</span>
          <Select value={task.assignee ?? "none"} onValueChange={(v) => updateTask(id, { kind: "assignee", to: !v || v === "none" ? null : v })}>
            <SelectTrigger aria-labelledby={`assignee-${id}`} className="w-full">
              <SelectValue>{(v: string | null) => (!v || v === "none" ? "Unassigned" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              <SelectItem value={DEMO_USER}>{DEMO_USER}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={field}>
          <label className={label} htmlFor={`due-${id}`}>Due date</label>
          <div className="flex gap-2">
            <Input
              id={`due-${id}`}
              type="date"
              value={task.due ?? ""}
              onChange={(e) => updateTask(id, { kind: "due", to: e.target.value || null })}
              className="h-8"
            />
            {task.due && (
              <Button variant="ghost" size="sm" onClick={() => updateTask(id, { kind: "due", to: null })}>
                Clear<span className="sr-only"> due date</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <form
        className={field}
        onSubmit={(e) => { e.preventDefault(); updateTask(id, { kind: "note", text: note }); setNote(""); }}
      >
        <label className={label} htmlFor={`note-${id}`}>Workflow note</label>
        <Textarea
          id={`note-${id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="e.g. Review at next outreach."
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">Not a clinical note. Saved in this browser.</span>
          <Button type="submit" size="sm" variant="outline" disabled={!note.trim()}>Add note</Button>
        </div>
      </form>
    </section>
  );
}

function Activity({ task }: { task: Task }) {
  const events = [...task.events].reverse();
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold">Workflow activity</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workflow activity yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {events.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex flex-col gap-0.5 border-l-2 pl-3">
              <span className="text-sm">
                {e.kind === "due" && e.to ? `Due date set to ${longDate(e.to)}` : describeEvent(e)}
              </span>
              {e.text && <span className="text-sm text-muted-foreground">&ldquo;{e.text}&rdquo;</span>}
              <span className="text-xs text-muted-foreground">
                <time dateTime={e.at}>{eventTime(e.at)}</time> · {e.by}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
