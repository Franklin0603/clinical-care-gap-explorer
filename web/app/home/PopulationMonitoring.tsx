import type { BandRow, CohortSummary } from "@/lib/cohort";
import { fmt } from "@/lib/data";
import { cn } from "cn";

/**
 * Two compact views of the whole cohort, drawn in CSS rather than a chart
 * library: the figures are known at build time, so they render in the static
 * HTML with no layout shift, and every number on a bar is also in the text
 * beside it, so nothing depends on reading a colour or a length.
 */

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 1000) / 10 : 0);

/** Below this many patients a band's rate is reported but flagged: one patient
 *  moves a five-person band by twenty points. */
const SMALL_BAND = 10;

export function MonitoringStatus({ s }: { s: CohortSummary }) {
  // Mutually exclusive by construction (see gapStatus): these three add up to
  // the cohort, so they can share one bar without counting anyone twice.
  const parts = [
    { key: "current", label: "Current", about: "A1c within 12 months", n: s.current, bar: "bg-status-success" },
    { key: "overdue", label: "Overdue", about: "Tested before, not in 12 months", n: s.gapPreviouslyTested, bar: "bg-status-danger/55" },
    { key: "never", label: "Never tested", about: "No A1c on file", n: s.neverTested, bar: "bg-status-danger" },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">A1c monitoring status</h3>
        <p className="text-xs text-muted-foreground">
          Every patient in exactly one group. {fmt(s.total)} patients.
        </p>
      </div>

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {parts.map((p) =>
          p.n > 0 ? <div key={p.key} className={p.bar} style={{ width: `${pct(p.n, s.total)}%` }} /> : null,
        )}
      </div>

      <dl className="flex flex-col divide-y">
        {parts.map((p) => (
          <div key={p.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className={cn("size-2.5 shrink-0 rounded-full", p.bar)} aria-hidden />
            <dt className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.about}</span>
            </dt>
            <dd className="num flex items-baseline gap-2 text-right">
              <span className="text-sm font-semibold">{fmt(p.n)}</span>
              <span className="w-12 text-xs text-muted-foreground">{pct(p.n, s.total)}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function GapsByAgeBand({ bands }: { bands: BandRow[] }) {
  const small = bands.filter((b) => b.patients > 0 && b.patients < SMALL_BAND);
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Gap rate by age band</h3>
        <p className="text-xs text-muted-foreground">
          Share of each band with an open A1c gap.
        </p>
      </div>

      <ul className="flex flex-col gap-3.5">
        {bands.map((b) => {
          const rate = pct(b.gaps, b.patients);
          return (
            <li key={b.band} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="num font-medium">{b.band}</span>
                <span className="num text-xs text-muted-foreground">
                  <span className="text-sm font-semibold text-foreground">{rate}%</span>
                  {" · "}{fmt(b.gaps)} of {fmt(b.patients)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-chart-1" style={{ width: `${rate}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      {small.length > 0 && (
        <p className="mt-auto text-xs text-muted-foreground">
          {small.map((b) => b.band).join(", ")} {small.length === 1 ? "has" : "have"} fewer
          than {SMALL_BAND} patients, so one patient moves the rate a long way.
        </p>
      )}
    </div>
  );
}
