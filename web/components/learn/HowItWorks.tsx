import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "cn";

/**
 * The care-gap workflow, step by step, as a hypothetical care-team member
 * would move through the application. Each step names where it happens and
 * what kind of data it rests on, so the line between clinical source data,
 * the application's derived status and demo workflow data is visible at every
 * step.
 */
type Kind = "source" | "derived" | "workflow";

const KIND: Record<Kind, { label: string; tone: string }> = {
  source: { label: "Clinical source", tone: "border-status-info/30 bg-status-info/10 text-status-info" },
  derived: { label: "Derived status", tone: "border-border bg-muted text-muted-foreground" },
  workflow: { label: "Demo workflow data", tone: "border-status-warning/30 bg-status-warning/10 text-status-warning" },
};

type Step = { name: string; does: string; where: { href: string; label: string }; kinds: Kind[]; detail?: string };

const STEPS: Step[] = [
  {
    name: "Identify an open monitoring gap",
    does: "Start from the patients with no A1c result in the 365 days before the data date.",
    where: { href: "/care-gaps", label: "Care Gaps" },
    kinds: ["derived"],
    detail: "Home shows the first five; Care Gaps lists every open gap, never tested first.",
  },
  {
    name: "Review the supporting evidence",
    does: "Check why the patient has the status: the latest A1c, its date, days overdue, last encounter and care setting.",
    where: { href: "/care-gaps", label: "Review on Care Gaps" },
    kinds: ["source", "derived"],
  },
  {
    name: "Inspect the patient's history",
    does: "Open the patient workspace for every A1c on file, testing per year, medications and procedures.",
    where: { href: "/patients", label: "Patients" },
    kinds: ["source"],
    detail: "There is no orders table, so the history shows tests that happened, never tests that were requested.",
  },
  {
    name: "Record follow-up",
    does: "Move the gap's task through review, outreach and scheduling; assign it, set a due date, add a workflow note.",
    where: { href: "/tasks", label: "Tasks" },
    kinds: ["workflow"],
    detail: "Nothing is sent to a patient. Task data is saved in this browser only.",
  },
  {
    name: "Monitor completion",
    does: "Follow open tasks to completion, and watch for the qualifying A1c result that actually closes the gap.",
    where: { href: "/tasks", label: "Tasks" },
    kinds: ["workflow", "derived"],
    detail: "Completing a task never closes the gap. Only a new qualifying result in the source data does.",
  },
  {
    name: "Review population analytics",
    does: "Step back to coverage, the make-up of the gaps, where they sit by age and setting, and testing over time.",
    where: { href: "/analytics", label: "Analytics" },
    kinds: ["derived", "source"],
  },
];

export function HowItWorks() {
  return (
    <ol className="flex flex-col divide-y rounded-xl border bg-card">
      {STEPS.map((s, i) => (
        <li key={s.name} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5">
          <span className="num flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground" aria-hidden>
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h3 className="text-sm font-semibold"><span className="sr-only">Step {i + 1}: </span>{s.name}</h3>
            <p className="text-sm">{s.does}</p>
            {s.detail && <p className="text-sm text-muted-foreground">{s.detail}</p>}
            <ul className="flex flex-wrap gap-1.5 pt-0.5" aria-label="Data this step uses">
              {s.kinds.map((k) => (
                <li key={k} className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-medium", KIND[k].tone)}>{KIND[k].label}</li>
              ))}
            </ul>
          </div>
          <Link
            href={s.where.href}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {s.where.label} <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </li>
      ))}
    </ol>
  );
}
