"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PatientRow } from "@/lib/data";
import { gapStatus } from "@/lib/cohort";
import { eventTime, longDate } from "@/lib/dates";
import { initialTask, shortEvent } from "@/lib/tasks";
import { useTaskStore } from "@/lib/taskStore";
import { Facts, Panel } from "@/components/patient/parts";
import { TaskStatusBadge } from "./TaskStatusBadge";

/**
 * The patient workspace's view of follow-up work: a compact summary of the
 * task for this patient's open gap, and a way to it. Labelled as workflow
 * data, kept below the clinical assessment, and never mixed into it.
 */
export function FollowUpCard({ patient: r }: { patient: PatientRow }) {
  const store = useTaskStore();
  const id = String(r.patient_id);
  const stored = store[id];
  const gapOpen = gapStatus(r) !== "current";

  if (!gapOpen && !stored) {
    return (
      <Panel as="h2" title="Follow-up" actions={<WorkflowTag />}>
        <p className="text-sm text-muted-foreground">
          No follow-up task. Tasks track open A1c gaps, and this patient has none.
        </p>
      </Panel>
    );
  }

  const task = stored ?? initialTask(id);
  const last = task.events.at(-1);
  return (
    <Panel
      as="h2"
      title="Follow-up"
      actions={
        <span className="flex items-center gap-3">
          <WorkflowTag />
          <Link
            href={`/tasks?open=${encodeURIComponent(id)}`}
            className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            View task <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </span>
      }
    >
      <Facts
        className="lg:grid-cols-4"
        items={[
          { label: "Task status", value: <TaskStatusBadge status={task.status} /> },
          { label: "Assigned to", value: task.assignee ?? <span className="text-muted-foreground">Unassigned</span> },
          { label: "Due date", value: task.due ? longDate(task.due) : <span className="text-muted-foreground">No due date</span> },
          {
            label: "Last activity",
            value: last
              ? <>{shortEvent(last, (d) => longDate(d) ?? d)} <span className="block text-xs text-muted-foreground">{eventTime(last.at)}</span></>
              : <span className="text-muted-foreground">No activity yet</span>,
          },
        ]}
      />
    </Panel>
  );
}

function WorkflowTag() {
  return (
    <span
      title="Application workflow data, saved in this browser. Not from the clinical source."
      className="rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
    >
      Workflow
    </span>
  );
}
