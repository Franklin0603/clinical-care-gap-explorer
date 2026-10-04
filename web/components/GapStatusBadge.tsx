import { CircleCheck, CircleSlash, Clock } from "lucide-react";

import type { GapStatus } from "@/lib/cohort";
import { StatusBadge, StatusTone } from "@/components/shell/StatusBadge";

/**
 * A patient's A1c monitoring state, in words.
 *
 * Overdue and never tested share a tone, because both are open gaps, but not a
 * label or an icon: a patient with no result at all is a different
 * conversation from one whose last result is old, and the badge should say
 * which before anyone opens the record.
 */
const STATES: Record<GapStatus, { tone: StatusTone; label: string; icon: typeof Clock }> = {
  never: { tone: "danger", label: "Never tested", icon: CircleSlash },
  overdue: { tone: "danger", label: "Overdue", icon: Clock },
  current: { tone: "success", label: "Current", icon: CircleCheck },
};

export function GapStatusBadge({ status, className }: { status: GapStatus; className?: string }) {
  const s = STATES[status];
  return <StatusBadge tone={s.tone} label={s.label} icon={s.icon} className={className} />;
}
