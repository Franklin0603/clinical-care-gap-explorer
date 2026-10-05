"use client";

import { ReactNode, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Activity, CircleAlert } from "lucide-react";

import { fmt, gold } from "@/lib/data";
import { longDate } from "@/lib/dates";
import { PatientDetail, YearRow, cohortTestsByYear, loadPatientDetail } from "@/lib/patientDetail";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard, DataTip } from "./ChartCard";

/**
 * The page's primary chart: recorded A1c testing per calendar year across the
 * cohort, from the same per-patient history the patient workspace uses
 * (patient_detail.json, fetched once per session).
 *
 * Two counts, never on one axis: results recorded, and distinct patients with
 * at least one result. One patient tested monthly is twelve results and one
 * patient. The header switch picks which the bars show; the tooltip and the
 * table always give both.
 *
 * The first and last years are only partly covered - the history starts at
 * the first result on file and stops at the data date - so they are drawn
 * lighter, starred, and named partial in the tooltip, the note and the table.
 */

type Measure = "tests" | "patients";
const MEASURES: Record<Measure, { short: string; long: string }> = {
  tests: { short: "Results", long: "A1c results recorded" },
  patients: { short: "Patients", long: "Patients with ≥1 result" },
};

const config = {
  tests: { label: MEASURES.tests.long, color: "var(--chart-1)" },
  patients: { label: MEASURES.patients.long, color: "var(--chart-1)" },
} satisfies ChartConfig;

type Load = { all: Record<string, PatientDetail> | null; failed: boolean };

function useHistory() {
  const [state, setState] = useState<Load>({ all: null, failed: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loadPatientDetail()
      .then((all) => { if (live) setState({ all, failed: false }); })
      .catch((e: unknown) => { console.warn("patient_detail.json", e); if (live) setState({ all: null, failed: true }); });
    return () => { live = false; };
  }, [attempt]);
  return { ...state, retry: () => { setState({ all: null, failed: false }); setAttempt((a) => a + 1); } };
}

export function TestingOverTime({ className }: { className?: string }) {
  const [measure, setMeasure] = useState<Measure>("tests");
  const { all, failed, retry } = useHistory();

  const toggle = (
    <div role="group" aria-label="Measure shown" className="flex rounded-md border bg-muted/50 p-0.5">
      {(Object.keys(MEASURES) as Measure[]).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={measure === m}
          onClick={() => setMeasure(m)}
          className={cn(
            "rounded px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            measure === m ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {MEASURES[m].short}
        </button>
      ))}
    </div>
  );

  const card = (body: ReactNode, extra: Partial<Parameters<typeof ChartCard>[0]> = {}) => (
    <ChartCard icon={Activity} title="A1c testing over time" action={toggle} className={className} {...extra}>
      {body}
    </ChartCard>
  );

  if (failed) {
    return card(
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
        <CircleAlert className="size-6 text-status-danger" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold">Testing history unavailable</p>
          <p className="text-sm text-muted-foreground">We couldn&apos;t load the A1c testing history.</p>
        </div>
        <Button variant="outline" size="sm" onClick={retry}>Try again</Button>
      </div>,
    );
  }

  if (!all) {
    return card(
      <div className="flex flex-1 flex-col gap-4" aria-busy="true" aria-label="Loading testing history">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-72 w-full" />
      </div>,
    );
  }

  const { years, first, last } = cohortTestsByYear(all);
  if (years.length === 0 || !first || !last) {
    return card(<p className="py-10 text-center text-sm text-muted-foreground">No data available for this view.</p>);
  }

  const firstYear = years[0].year, lastYear = years[years.length - 1].year;
  const partial = new Set([firstYear, lastYear]);
  const data = years.map((y) => ({ ...y, label: partial.has(y.year) ? `${y.year}*` : y.year }));
  const full = years.filter((y) => !partial.has(y.year));
  const peak = full.length ? full.reduce((a, b) => (b[measure] > a[measure] ? b : a)) : null;
  const total = years.reduce((n, y) => n + y.tests, 0);

  return card(
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-1" />Full year</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-1/40" />Partial year *</span>
      </div>

      <ChartContainer config={config} className="h-64 w-full sm:h-72" aria-hidden>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          {/* preserveStartEnd: on a phone eleven year labels collide, so some
              are dropped - never the partial first and last years. Every year
              is in the table below. */}
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} interval="preserveStartEnd" minTickGap={6} />
          <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} domain={[0, "auto"]} fontSize={11} />
          <RTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) => {
              const y = active ? (payload?.[0]?.payload as (YearRow & { label: string }) | undefined) : undefined;
              if (!y) return null;
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
                  <DataTip
                    title={partial.has(y.year) ? `${y.year} · partial year` : y.year}
                    rows={[
                      { label: MEASURES.tests.long, value: fmt(y.tests), strong: measure === "tests" },
                      { label: MEASURES.patients.long, value: fmt(y.patients), strong: measure === "patients" },
                    ]}
                  />
                </div>
              );
            }}
          />
          <Bar dataKey={measure} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            {data.map((y) => (
              <Cell key={y.year} fill={`var(--color-${measure})`} fillOpacity={partial.has(y.year) ? 0.4 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      <details className="text-sm">
        <summary className="w-fit cursor-pointer rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
          Show the numbers by year
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">A1c results recorded and patients tested, by calendar year</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Year</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">{MEASURES.tests.long}</th>
                <th scope="col" className="py-2 text-right font-medium">{MEASURES.patients.long}</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year} className="border-b last:border-0">
                  <th scope="row" className="num py-1.5 pr-4 text-left font-normal">
                    {y.year}{partial.has(y.year) && <span className="text-xs text-muted-foreground"> (partial)</span>}
                  </th>
                  <td className="num py-1.5 pr-4 text-right">{fmt(y.tests)}</td>
                  <td className="num py-1.5 text-right">{fmt(y.patients)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>,
    {
      metric: measure === "tests"
        ? <>{fmt(total)} <span className="text-sm font-normal text-muted-foreground">A1c results recorded</span></>
        : <>{fmt(peak?.patients ?? 0)} <span className="text-sm font-normal text-muted-foreground">patients tested in {peak?.year ?? "—"}</span></>,
      insight: peak && (measure === "tests"
        ? `Most in a full year: ${fmt(peak.tests)} in ${peak.year}.`
        : `The most in any full year, of ${fmt(Object.keys(all).length)} patients in the cohort.`),
      note: (
        <>
          Available history: {longDate(first)} to {longDate(last)}, from synthetic records rather than
          anyone&apos;s complete care. * {firstYear} starts at the first result on file and {lastYear} ends
          at the data date ({longDate(gold.asof)}). Empty years are drawn as zero.
        </>
      ),
    },
  );
}
