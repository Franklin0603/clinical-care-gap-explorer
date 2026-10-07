import Link from "next/link";

import { gold, patients } from "@/lib/data";
import { cohortSummary } from "@/lib/cohort";
import { longDate } from "@/lib/dates";
import { GapStatusBadge } from "@/components/GapStatusBadge";

/**
 * The 365-day lookback, drawn from the same data date and window the pipeline
 * uses (gold_report.json: asof, gap_days), with today's real counts beside
 * each status. Nothing here defines the measure; it pictures it.
 *
 * An A1C on or after the window's first day keeps a patient current: exactly
 * 365 days old is still current, 366 is overdue (pipeline decision D6).
 */
const DAY = 86_400_000;
const days = Number(gold.gap_days ?? 365);
const asof = gold.asof;
const windowStart = new Date(Date.parse(asof) - days * DAY).toISOString().slice(0, 10);
const s = cohortSummary(patients, asof);

const ROWS = [
  {
    status: "current" as const,
    n: s.current,
    href: "/patients?status=current",
    marker: 72, // percent along the track
    text: `An A1C result on or after ${longDate(windowStart)}.`,
  },
  {
    status: "overdue" as const,
    n: s.gapPreviouslyTested,
    href: "/care-gaps?status=overdue",
    marker: 6,
    text: `A result exists, but the latest is before ${longDate(windowStart)}.`,
  },
  {
    status: "never" as const,
    n: s.neverTested,
    href: "/care-gaps?status=never",
    marker: null,
    text: "No A1C result anywhere in the available data.",
  },
];

/** Where the window starts on the track, in percent. */
const START = 22;

export function A1cTimeline() {
  return (
    <figure className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <figcaption className="flex flex-col gap-1">
        <span className="text-sm font-semibold">The {days}-day lookback</span>
        <span className="text-xs text-muted-foreground">
          Every patient is checked against the same window: the {days} days up to the data date, {longDate(asof)}.
        </span>
      </figcaption>

      {/* The axis, in the same middle column as the rows below so the window
          lines up. Decorative; every fact on it is also in the rows. */}
      <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_6rem] sm:gap-4" aria-hidden>
        <span className="hidden sm:block" />
        <div className="relative mt-6 mb-5 h-2">
          <div className="absolute inset-0 rounded-full bg-muted" />
          <div className="absolute inset-y-0 right-0 rounded-r-full bg-status-success/25" style={{ left: `${START}%` }} />
          <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted-foreground" style={{ left: `${START}%` }}>
            {longDate(windowStart)}
          </span>
          <span className="absolute -top-6 right-0 whitespace-nowrap text-[11px] font-medium">Data date</span>
          <span className="absolute -bottom-5 left-0 text-[11px] text-muted-foreground">Earlier</span>
          <span className="absolute -bottom-5 right-0 text-[11px] text-muted-foreground">{longDate(asof)}</span>
          <span className="absolute -bottom-5 hidden -translate-x-1/2 whitespace-nowrap text-[11px] text-status-success sm:block" style={{ left: `${(START + 100) / 2}%` }}>
            {days}-day window
          </span>
        </div>
        <span className="hidden sm:block" />
      </div>

      <ul className="flex flex-col divide-y">
        {ROWS.map((r) => (
          <li key={r.status} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[8rem_minmax(0,1fr)_6rem] sm:items-center sm:gap-4">
            <GapStatusBadge status={r.status} />
            <div className="flex flex-col gap-1.5">
              <div className="relative h-4" aria-hidden>
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
                <div className="absolute inset-y-0 right-0 rounded-sm bg-status-success/10" style={{ left: `${START}%` }} />
                {r.marker === null ? (
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] italic text-muted-foreground">no result on file</span>
                ) : (
                  <span
                    className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background ${r.status === "current" ? "bg-status-success" : "bg-status-danger"}`}
                    style={{ left: `${r.marker}%` }}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{r.text}</p>
            </div>
            <Link href={r.href} className="num text-sm font-medium text-primary hover:underline sm:text-right">
              {r.n} {r.n === 1 ? "patient" : "patients"}
              <span className="sr-only"> {r.status === "never" ? "never tested" : r.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </figure>
  );
}
