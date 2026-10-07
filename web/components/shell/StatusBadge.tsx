import type { LucideIcon } from "lucide-react";

import { cn } from "cn";

/**
 * A status, in words, with colour as reinforcement.
 *
 * `label` is required and is the status itself. Colour alone cannot carry a
 * clinical state: a red dot means nothing to a screen reader, to someone with a
 * red-green deficiency, or on a greyscale printout. So the text is the
 * information and the colour is the hint, never the other way round.
 *
 * One meaning per tone, used the same way everywhere:
 *   danger   overdue, needs attention
 *   warning  due soon, worth knowing
 *   success  current, done, available
 *   info     informational, planned
 *   neutral  everything else
 */
export type StatusTone = "danger" | "warning" | "success" | "info" | "neutral";

const TONES: Record<StatusTone, string> = {
  danger: "border-status-danger/30 bg-status-danger/10 text-status-danger",
  warning: "border-status-warning/30 bg-status-warning/10 text-status-warning",
  success: "border-status-success/30 bg-status-success/10 text-status-success",
  info: "border-status-info/30 bg-status-info/10 text-status-info",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({
  tone = "neutral", label, icon: Icon, className,
}: {
  tone?: StatusTone;
  label: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {label}
    </span>
  );
}
