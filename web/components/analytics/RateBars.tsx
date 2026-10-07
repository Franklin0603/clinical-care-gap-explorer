import Link from "next/link";

import { fmt } from "@/lib/data";
import { GroupRow, pctText } from "@/lib/cohort";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DataTip, dataTipClass } from "./ChartCard";

/**
 * Gap rate per group as horizontal bars on a fixed 0-100% scale, so a
 * difference is never exaggerated by a truncated axis. Each row shows its rate
 * beside its denominator - "15 of 51" - because in a cohort this small a
 * five-patient group moves twenty points on one patient; groups under `small`
 * patients also carry a "small group" marker. Hover or focus a row for the
 * full breakdown. A row with open gaps is a link to them.
 */
export function RateBars({
  rows, label, href, small = 10,
}: {
  rows: GroupRow[];
  label: (key: string) => string;
  href?: (row: GroupRow) => string;
  small?: number;
}) {
  if (rows.every((r) => r.total === 0)) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No data available for this view.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => {
        const tiny = r.total > 0 && r.total < small;
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-baseline gap-2">
                <span className="num font-medium">{label(r.key)}</span>
                {tiny && <span className="text-[11px] text-muted-foreground">small group</span>}
              </span>
              <span className="num text-xs text-muted-foreground">
                <span className="text-sm font-semibold text-foreground">{pctText(r.gaps, r.total)}</span>
                {" · "}{fmt(r.gaps)} of {fmt(r.total)}
              </span>
            </span>
            <span className="block h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className={cn("block h-full rounded-full", tiny ? "bg-chart-1/45" : "bg-chart-1")}
                style={{ width: `${(r.gaps / Math.max(r.total, 1)) * 100}%` }}
              />
            </span>
          </>
        );
        const cls = "flex flex-col gap-1.5 rounded-md px-2 py-1.5 -mx-2";
        const tip = (
          <DataTip
            title={label(r.key)}
            rows={[
              { label: "Patients", value: fmt(r.total) },
              { label: "Current", value: fmt(r.current) },
              { label: "Open gaps", value: fmt(r.gaps) },
              { label: "  Never tested", value: fmt(r.never) },
              { label: "  Overdue", value: fmt(r.overdue) },
              { label: "Gap rate", value: pctText(r.gaps, r.total), strong: true },
            ]}
          />
        );
        const link = href && r.gaps > 0;
        return (
          <li key={r.key}>
            <Tooltip>
              <TooltipTrigger
                render={
                  link ? (
                    <Link
                      href={href(r)}
                      className={cn(cls, "transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring")}
                    />
                  ) : (
                    <div tabIndex={0} className={cn(cls, "focus-visible:outline-2 focus-visible:outline-ring")} />
                  )
                }
              >
                {body}
                {link && <span className="sr-only">, view {fmt(r.gaps)} open {r.gaps === 1 ? "gap" : "gaps"}</span>}
              </TooltipTrigger>
              <TooltipContent side="top" align="end" className={dataTipClass}>{tip}</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
