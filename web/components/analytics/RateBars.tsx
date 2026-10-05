import Link from "next/link";

import { fmt } from "@/lib/data";
import { GroupRow, pctText } from "@/lib/cohort";

/**
 * Gap rate per group as horizontal bars on a fixed 0-100% scale, so a
 * difference is never exaggerated by a truncated axis. Every rate is written
 * beside its denominator - "15 of 51" - because in a cohort this small a
 * five-patient group moves twenty points on one patient. Groups below
 * `small` patients are named in a note underneath.
 */
export function RateBars({
  rows, label, href, small = 10, caption,
}: {
  rows: GroupRow[];
  label: (key: string) => string;
  /** Where a group's open gaps can be worked, if anywhere. */
  href?: (row: GroupRow) => string;
  small?: number;
  caption?: string;
}) {
  const tiny = rows.filter((r) => r.total > 0 && r.total < small);
  if (rows.every((r) => r.total === 0)) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No data available for this view.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3.5">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="num font-medium">{label(r.key)}</span>
              <span className="num text-xs text-muted-foreground">
                <span className="text-sm font-semibold text-foreground">{pctText(r.gaps, r.total)}</span>
                {" · "}{fmt(r.gaps)} of {fmt(r.total)}
                {href && r.gaps > 0 && (
                  <>
                    {" · "}
                    <Link href={href(r)} className="font-medium text-primary hover:underline">
                      View<span className="sr-only"> {fmt(r.gaps)} open {r.gaps === 1 ? "gap" : "gaps"} in {label(r.key)}</span>
                    </Link>
                  </>
                )}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-chart-1" style={{ width: `${(r.gaps / Math.max(r.total, 1)) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {(tiny.length > 0 || caption) && (
        <p className="text-xs text-muted-foreground">
          {caption}
          {caption && tiny.length > 0 && " "}
          {tiny.length > 0 && (
            <>
              {tiny.map((r) => `${label(r.key)} (${r.total})`).join(", ")} {tiny.length === 1 ? "has" : "have"} fewer
              than {small} patients, so one patient moves the rate a long way.
            </>
          )}
        </p>
      )}
    </div>
  );
}
