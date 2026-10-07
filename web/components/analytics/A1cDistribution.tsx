"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Tooltip as RTooltip, XAxis, YAxis } from "recharts";

import { fmt } from "@/lib/data";
import { A1cBin, pctText } from "@/lib/cohort";
import { ChartContainer } from "@/components/ui/chart";
import { FILL, SrTable, TipBox } from "./chartBits";

/**
 * Each patient's latest recorded A1C in equal one-point ranges, one neutral
 * colour throughout and no reference line: the ranges are arithmetic, and
 * nothing here says which are good or bad. Patients with no result are not a
 * column - they are counted beside the chart.
 */
export function A1cDistribution({ bins, withResult }: { bins: A1cBin[]; withResult: number }) {
  return (
    <>
      <ChartContainer config={{}} className="h-60 w-full" aria-hidden>
        <BarChart data={bins} margin={{ top: 22, right: 4, left: 0, bottom: 0 }} barCategoryGap="12%">
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} interval="preserveStartEnd" minTickGap={4} />
          <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} fontSize={11} domain={[0, "auto"]} />
          <RTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) => {
              const b = active ? (payload?.[0]?.payload as A1cBin | undefined) : undefined;
              return b ? (
                <TipBox
                  title={`Latest A1C ${b.label}`}
                  rows={[
                    { label: "Patients", value: fmt(b.n), strong: true },
                    { label: "Share of patients with a result", value: pctText(b.n, withResult) },
                  ]}
                />
              ) : null;
            }}
          />
          <Bar dataKey="n" fill={FILL.series} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList dataKey="n" position="top" fontSize={11} className="fill-foreground" />
          </Bar>
        </BarChart>
      </ChartContainer>
      <SrTable
        caption="Patients by latest recorded A1C"
        head={["Latest A1C", "Patients", "Share"]}
        rows={bins.map((b) => ({ cells: [b.label, fmt(b.n), pctText(b.n, withResult)] }))}
      />
    </>
  );
}
