import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { gold } from "@/lib/data";
import { StatusBadge, StatusTone } from "@/components/shell/StatusBadge";

/**
 * The workflow the application is organised around, with each step saying
 * honestly whether it exists today and where. It opened Home in the first
 * redesign phase; Home became the dashboard, and the explanation moved here.
 */
type Step = {
  name: string;
  does: string;
  status: { tone: StatusTone; label: string };
  where?: { href: string; label: string };
  detail?: string;
};

const STEPS: Step[] = [
  {
    name: "Detect",
    does: "Find diabetic patients with no A1c result in the last twelve months.",
    status: { tone: "success", label: "Available" },
    where: { href: "/patients", label: "Patients" },
    detail: `${gold.open_gaps} of ${gold.cohort} patients have an open gap, and ${gold.never_tested} of them have never been tested.`,
  },
  {
    name: "Prioritize",
    does: "Put the most urgent patients first.",
    status: { tone: "success", label: "Available" },
    where: { href: "/care-gaps", label: "Care Gaps" },
    detail: "Care Gaps lists every open gap in the pipeline's priority order, never tested first, with filters by status, setting, age and insulin. Home shows the first five.",
  },
  {
    name: "Review",
    does: "Open a patient's A1c history, medications and procedures.",
    status: { tone: "success", label: "Available" },
    where: { href: "/patients", label: "Patients" },
    detail: "Select Review on Home or Care Gaps, or any patient in the Patients list, to open their record.",
  },
  {
    name: "Act",
    does: "Record what was done about a gap: a call, a message, an order.",
    status: { tone: "info", label: "Planned" },
    where: { href: "/tasks", label: "Tasks" },
  },
  {
    name: "Track",
    does: "Follow each patient until the test actually happens.",
    status: { tone: "info", label: "Planned" },
  },
  {
    name: "Close",
    does: "Confirm the result arrived and close the gap.",
    status: { tone: "info", label: "Planned" },
    detail: "This data records results but never orders, so a gap can only be seen to close when a new result appears.",
  },
];

export function HowItWorks() {
  return (
    <ol className="flex flex-col divide-y rounded-lg border bg-card">
      {STEPS.map((s, i) => (
        <li key={s.name} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5">
          <div className="flex items-center gap-3 sm:w-40 sm:shrink-0">
            <span className="num flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground">
              {i + 1}
            </span>
            <span className="text-base font-semibold">{s.name}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="text-sm">{s.does}</p>
            {s.detail && <p className="text-sm text-muted-foreground">{s.detail}</p>}
          </div>
          <div className="flex items-center gap-3 sm:shrink-0 sm:justify-end">
            <StatusBadge tone={s.status.tone} label={s.status.label} />
            {s.where && (
              <Link
                href={s.where.href}
                className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {s.where.label}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
