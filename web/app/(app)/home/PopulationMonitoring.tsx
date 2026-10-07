import type { CohortSummary, GroupRow } from "@/lib/cohort";
import { fmt } from "@/lib/data";
import { ProportionBar } from "@/components/analytics/ProportionBar";
import { RateBars } from "@/components/analytics/RateBars";

/**
 * Home's two compact views of the whole cohort, drawn with the same pieces
 * Analytics uses, so the two pages draw the same numbers the same way.
 */

export function MonitoringStatus({ s }: { s: CohortSummary }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">A1C monitoring status</h3>
        <p className="text-xs text-muted-foreground">
          Every patient in exactly one group. {fmt(s.total)} patients.
        </p>
      </div>
      <ProportionBar
        total={s.total}
        parts={[
          { key: "current", label: "Current", about: "A1C within 12 months", n: s.current, tone: "bg-status-success" },
          { key: "overdue", label: "Overdue", about: "Tested before, not in 12 months", n: s.gapPreviouslyTested, tone: "bg-status-danger/55" },
          { key: "never", label: "Never tested", about: "No A1C on file", n: s.neverTested, tone: "bg-status-danger" },
        ]}
      />
    </div>
  );
}

export function GapsByAgeBand({ bands }: { bands: GroupRow[] }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Gap rate by age band</h3>
        <p className="text-xs text-muted-foreground">Share of each band with an open A1C gap.</p>
      </div>
      <RateBars rows={bands} label={(k) => k} />
    </div>
  );
}
