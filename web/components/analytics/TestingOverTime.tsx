"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { CircleAlert } from "lucide-react";

import { fmt, gold } from "@/lib/data";
import { longDate } from "@/lib/dates";
import { PatientDetail, cohortTestsByYear, loadPatientDetail } from "@/lib/patientDetail";
import { Button } from "@/components/ui/button";
import {
  ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Recorded A1c results per calendar year across the cohort, from the same
 * per-patient history the patient workspace uses (patient_detail.json,
 * fetched once per session). Two counts are kept apart on purpose: results
 * recorded, which the bars show, and distinct patients with at least one
 * result, which the tooltip and the table show. One patient tested monthly is
 * twelve results and one patient.
 *
 * The first and last years are only partly covered - the history starts at
 * the first result on file and stops at the data date - so they are drawn
 * lighter and labelled partial, in words as well as shade.
 */

const config = {
  tests: { label: "A1c results recorded", color: "var(--chart-1)" },
  patients: { label: "Patients with ≥1 result", color: "var(--chart-1)" },
} satisfies ChartConfig;

type Load = { all: Record<string, PatientDetail> | null; failed: boolean };

export function TestingOverTime() {
  const [state, setState] = useState<Load>({ all: null, failed: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadPatientDetail()
      .then((all) => { if (live) setState({ all, failed: false }); })
      .catch((e: unknown) => { console.warn("patient_detail.json", e); if (live) setState({ all: null, failed: true }); });
    return () => { live = false; };
  }, [attempt]);

  if (state.failed) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-10 text-center">
        <CircleAlert className="size-6 text-status-danger" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold">Testing history unavailable</p>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t load the A1c testing history. The figures above do not depend on it.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setState({ all: null, failed: false }); setAttempt((a) => a + 1); }}>
          Try again
        </Button>
      </div>
    );
  }

  if (!state.all) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-5" aria-busy="true" aria-label="Loading testing history">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { years, first, last } = cohortTestsByYear(state.all);
  if (years.length === 0 || !first || !last) {
    return <p className="rounded-lg border bg-card py-10 text-center text-sm text-muted-foreground">No data available for this view.</p>;
  }

  const firstYear = years[0].year, lastYear = years[years.length - 1].year;
  const partial = new Set([firstYear, lastYear]);
  const label = (y: string) => (partial.has(y) ? `${y}*` : y);
  const data = years.map((y) => ({ ...y, label: label(y.year) }));
  const full = years.filter((y) => !partial.has(y.year));
  const busiest = full.length ? full.reduce((a, b) => (b.tests > a.tests ? b : a)) : null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">A1c results recorded per year</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Available A1c history: {longDate(first)} to {longDate(last)}, in the synthetic records,
          not a complete history of anyone&apos;s care. * {firstYear} starts at the first result on
          file and {lastYear} stops at the data date ({longDate(gold.asof)}), so both are partial years
          and drawn lighter. Empty years would be drawn as zero, not skipped.
        </p>
      </div>

      <p className="text-sm">
        {fmt(years.reduce((n, y) => n + y.tests, 0))} A1c results across {fmt(years.length)} calendar years.
        {busiest && <> The most in a full year was {fmt(busiest.tests)} in {busiest.year}, for {fmt(busiest.patients)} patients.</>}
      </p>

      <ChartContainer config={config} className="h-64 w-full" aria-hidden>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          {/* preserveStartEnd: on a phone eleven year labels collide, so some are
              dropped - never the partial first and last years. Every year is in
              the table below. */}
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} interval="preserveStartEnd" minTickGap={6} />
          <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} domain={[0, "auto"]} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideIndicator
                labelFormatter={(_, p) => {
                  const y = p?.[0]?.payload as (typeof data)[number] | undefined;
                  return y ? `${y.year}${partial.has(y.year) ? " (partial year)" : ""}` : "";
                }}
                formatter={(_v, _n, item) => {
                  const y = item.payload as (typeof data)[number];
                  return (
                    <span className="num flex flex-col text-xs">
                      <span>{fmt(y.tests)} A1c results recorded</span>
                      <span>{fmt(y.patients)} patients with at least one result</span>
                    </span>
                  );
                }}
              />
            }
          />
          <Bar dataKey="tests" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((y) => (
              <Cell key={y.year} fill="var(--color-tests)" fillOpacity={partial.has(y.year) ? 0.4 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* The chart's numbers as a table, for screen readers and for anyone who
          wants the patients-tested count without hovering. */}
      <details className="group text-sm">
        <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
          Show the numbers by year
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">A1c results recorded and patients tested, by calendar year</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Year</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">A1c results recorded</th>
                <th scope="col" className="py-2 text-right font-medium">Patients with ≥1 result</th>
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
    </div>
  );
}
