import {
  Archive, CalendarCheck, CircleCheck, CircleDashed, CircleOff, Flag, UserCheck, type LucideIcon,
} from "lucide-react";

import { TaskStatus, statusLabel } from "@/lib/tasks";
import { cn } from "cn";

/**
 * A task's workflow status, in words with an icon. Deliberately not the
 * clinical palette: the red family stays reserved for the care gap itself,
 * so a task badge can never be mistaken for a patient's A1C status.
 *
 *   needs review     neutral        outreach needed  amber
 *   contacted        blue           scheduled        blue
 *   unable to reach  muted orange   completed        green
 *   closed           neutral
 */
const STYLE: Record<TaskStatus, { icon: LucideIcon; tone: string }> = {
  needs_review: { icon: CircleDashed, tone: "border-border bg-muted text-muted-foreground" },
  outreach_needed: { icon: Flag, tone: "border-status-warning/30 bg-status-warning/10 text-status-warning" },
  contacted: { icon: UserCheck, tone: "border-status-info/30 bg-status-info/10 text-status-info" },
  scheduled: { icon: CalendarCheck, tone: "border-status-info/30 bg-status-info/10 text-status-info" },
  unable_to_reach: { icon: CircleOff, tone: "border-destructive/30 bg-destructive/10 text-destructive" },
  completed: { icon: CircleCheck, tone: "border-status-success/30 bg-status-success/10 text-status-success" },
  closed: { icon: Archive, tone: "border-border bg-muted text-muted-foreground" },
};

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const { icon: Icon, tone } = STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        tone, className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">Task: </span>
      {statusLabel(status)}
    </span>
  );
}
