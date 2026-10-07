"use client";

import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine,
  XAxis, YAxis,
} from "recharts";

import { PatientRow } from "@/lib/data";
import { ageBand } from "@/lib/cohort";
import { A1C_TARGET, A1cPoint, Box, boxes } from "@/lib/patientDetail";
import {
  ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";

/**
 * The three A1C charts from the original patient drawer, moved here intact so
 * the workspace's A1C tab reuses them rather than redrawing them. Each fix
 * recorded in the comments below was earned once and is kept.
 */

const chartConfig = {
  v: { label: "A1C %", color: "var(--chart-1)" },
  tests: { label: "A1C tests", color: "var(--chart-1)" },
  fills: { label: "Insulin fills", color: "var(--chart-2)" },
} satisfies ChartConfig;

/* ------------------------------------------------------------------ box plot */

/**
 * A box plot, drawn as stacked bars because Recharts has no box mark.
 *
 * `base` is an invisible bar from zero to the lower whisker; the visible
 * segments sit on top of it. The median is a ReferenceLine per group rather
 * than a segment, since a zero-height bar does not render.
 */
function DistributionChart({ data, mark }: { data: Box[]; mark: number | null }) {
  const rows = data.map((b) => ({
    label: `${b.label} (${b.n})`,
    base: b.min,
    lower: b.q1 - b.min,
    box1: b.median - b.q1,
    box2: b.q3 - b.median,
    upper: b.max - b.q3,
    median: b.median,
  }));
  // Explicit integer ticks. Left to pick its own, Recharts reached past the
  // domain for round numbers and put a -1% gridline on an axis of blood test
  // percentages, which cannot be negative.
  const lo = Math.max(0, Math.floor(Math.min(...data.map((b) => b.min), mark ?? Infinity)) - 1);
  const hi = Math.ceil(Math.max(...data.map((b) => b.max), mark ?? -Infinity)) + 1;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 2) ticks.push(t);

  return (
    <ChartContainer config={chartConfig} className="h-[230px] w-full">
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        {/* interval 0 so every band is named. Recharts drops labels it thinks
            will collide, which hid two of the four age bands. */}
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={10}
          interval={0}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={38}
          domain={[lo, hi]}
          ticks={ticks}
          allowDecimals={false}
          tickFormatter={(v) => `${v}%`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(_v, _n, item) => {
                const r = item.payload as (typeof rows)[number];
                const b = data.find((x) => `${x.label} (${x.n})` === r.label)!;
                return (
                  <span className="num text-xs">
                    min {b.min.toFixed(1)} · q1 {b.q1.toFixed(1)} · med{" "}
                    {b.median.toFixed(1)} · q3 {b.q3.toFixed(1)} · max {b.max.toFixed(1)}
                  </span>
                );
              }}
            />
          }
        />
        <Bar dataKey="base" stackId="b" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="lower" stackId="b" fill="var(--color-v)" fillOpacity={0.18} />
        <Bar dataKey="box1" stackId="b" fill="var(--color-v)" fillOpacity={0.55} />
        <Bar dataKey="box2" stackId="b" fill="var(--color-v)" fillOpacity={0.55} />
        <Bar dataKey="upper" stackId="b" fill="var(--color-v)" fillOpacity={0.18} />
        {mark !== null && (
          <ReferenceLine
            y={mark}
            stroke="var(--color-fills)"
            strokeWidth={2}
            label={{ value: "this patient", position: "insideTopRight", fontSize: 10 }}
          />
        )}
      </BarChart>
    </ChartContainer>
  );
}

/* ------------------------------------------------------------------ series */

/** Every A1C on file, with the 7% reference line and the insulin marker. */
export function A1cSeriesChart({ series, insStart }: { series: A1cPoint[]; insStart: string | null }) {
  return (
    <ChartContainer config={chartConfig} className="h-[230px] w-full">
      {/* left 0 and top 20: the negative left margin this chart used to carry
          clipped every y-axis number, leaving a column of bare "%" signs, and
          at top 8 the insulin marker's label was cut off. */}
      <LineChart data={series} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="d"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
          tickFormatter={(d: string) => d.slice(0, 7)}
          minTickGap={28}
        />
        {/* The domain always spans the target, so the 7% line
            is on the chart even for a patient who never
            reached it. Left to dataMin/dataMax, Recharts
            discards an out-of-range ReferenceLine and a
            well-controlled patient lost the very line that
            shows they are well controlled. */}
        <YAxis
          tickLine={false}
          axisLine={false}
          width={38}
          domain={[
            Math.floor(Math.min(...series.map((p) => p.v), A1C_TARGET) - 0.5),
            Math.ceil(Math.max(...series.map((p) => p.v), A1C_TARGET) + 0.5),
          ]}
          tickFormatter={(v) => `${v}%`}
        />
        {/* y2 is explicit. A ReferenceArea with only y1 draws
            nothing, so the "shaded band above target" the
            caption promises was simply absent. */}
        <ReferenceArea
          y1={A1C_TARGET}
          y2={Math.ceil(Math.max(...series.map((p) => p.v), A1C_TARGET) + 0.5)}
          fill="var(--color-fills)"
          fillOpacity={0.08}
        />
        <ReferenceLine
          y={A1C_TARGET}
          stroke="var(--color-fills)"
          strokeDasharray="4 4"
        />
        {insStart && (
          <ReferenceLine
            x={series.reduce((best, p) =>
              Math.abs(+new Date(p.d) - +new Date(insStart)) <
              Math.abs(+new Date(best) - +new Date(insStart)) ? p.d : best,
              series[0].d)}
            stroke="var(--color-fills)"
            strokeWidth={2}
            label={{ value: "insulin", position: "top", fontSize: 10 }}
          />
        )}
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="v"
          type="monotone"
          stroke="var(--color-v)"
          strokeWidth={2}
          dot={series.length < 40}
        />
      </LineChart>
    </ChartContainer>
  );
}

/** Tests per calendar year, empty years included, with insulin fills beside. */
export function TestsPerYearChart({
  perYear, insYear,
}: {
  perYear: { year: string; tests: number }[];
  insYear: { year: string; fills: number }[];
}) {
  return (
    <ChartContainer config={chartConfig} className="h-[230px] w-full">
      <BarChart
        data={perYear.map((r) => ({
          ...r,
          fills: insYear.find((i) => i.year === r.year)?.fills ?? 0,
        }))}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="tests" fill="var(--color-tests)" radius={[3, 3, 0, 0]} />
        {insYear.length > 0 && (
          <Bar dataKey="fills" fill="var(--color-fills)" radius={[3, 3, 0, 0]} />
        )}
      </BarChart>
    </ChartContainer>
  );
}

/** Latest A1C by age band across the cohort, with this patient marked. */
export function CohortComparisonChart({ cohort, mine }: { cohort: PatientRow[]; mine: number | null }) {
  /** Cohort A1C spread by age band, so one patient has something to sit against. */
  const bandBoxes = useMemo(() => {
    const g = new Map<string, number[]>();
    for (const r of cohort) {
      // Number(null) is 0, and 0 is finite - so a Number.isFinite guard alone
      // let all 21 never-tested patients into the distribution as a 0% A1C,
      // which is biologically impossible and pulled every box downwards. The
      // bands read 116 patients instead of the 95 who have a result.
      if (r.last_a1c_value === null || r.last_a1c_value === undefined) continue;
      const v = Number(r.last_a1c_value);
      if (!Number.isFinite(v)) continue;
      const band = ageBand(Number(r.age));
      if (!g.has(band)) g.set(band, []);
      g.get(band)!.push(v);
    }
    return boxes(new Map([...g.entries()].sort()));
  }, [cohort]);
  return <DistributionChart data={bandBoxes} mark={mine} />;
}
