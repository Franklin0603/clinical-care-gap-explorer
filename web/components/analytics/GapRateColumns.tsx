"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip as RTooltip, XAxis, YAxis } from "recharts";

import { fmt } from "@/lib/data";
import { GroupRow, pctText } from "@/lib/cohort";
import { ChartContainer } from "@/components/ui/chart";
import { FILL, SrTable, TipBox } from "./chartBits";

/**
 * Open-gap rate per age band as vertical columns on a 0-100% axis, so a
 * difference is never exaggerated by a truncated scale. The denominator is
 * printed under each band ("1 of 5"), the rate on top of each column, and a
 * band under `small` patients is drawn lighter and marked. A column with
 * open gaps opens those patients; the hidden table carries the same links
 * for keyboard and screen-reader users.
 */
export function GapRateColumns({
  rows, small = 10, prefix = "Age ", linkParam,
}: {
  rows: GroupRow[];
  small?: number;
  prefix?: string;
  /** Links each group with open gaps to /patients?status=gap&<param>=<key>. */
  linkParam?: "age" | "setting";
}) {
  const router = useRouter();
  const href = linkParam
    ? (r: GroupRow) => `/patients?status=gap&${linkParam}=${encodeURIComponent(r.key)}`
    : undefined;
  const tiny = (r: GroupRow) => r.total > 0 && r.total < small;
  const data = rows.map((r) => ({ ...r, rate: r.gapRate }));

  return (
    <>
      <ChartContainer config={{}} className="h-64 w-full" aria-hidden>
        <BarChart data={data} margin={{ top: 22, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="key"
            tickLine={false}
            axisLine={false}
            interval={0}
            height={40}
            tick={({ x, y, payload }) => {
              const r = rows.find((g) => g.key === payload.value)!;
              return (
                <g transform={`translate(${x},${y})`}>
                  <text dy={12} textAnchor="middle" fontSize={12} className="fill-foreground">
                    {payload.value}{tiny(r) ? "*" : ""}
                  </text>
                  <text dy={27} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
                    {fmt(r.gaps)} of {fmt(r.total)}
                  </text>
                </g>
              );
            }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
            width={44}
            fontSize={11}
          />
          <RTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) => {
              const r = active ? (payload?.[0]?.payload as GroupRow | undefined) : undefined;
              return r ? (
                <TipBox
                  title={`${prefix}${r.key}${tiny(r) ? " · small group" : ""}`}
                  rows={[
                    { label: "Patients", value: fmt(r.total) },
                    { label: "Open gaps", value: fmt(r.gaps) },
                    { label: "  Never tested", value: fmt(r.never) },
                    { label: "  Overdue", value: fmt(r.overdue) },
                    { label: "Gap rate", value: pctText(r.gaps, r.total), strong: true },
                  ]}
                />
              ) : null;
            }}
          />
          <Bar
            dataKey="rate"
            radius={[4, 4, 0, 0]}
            maxBarSize={64}
            isAnimationActive={false}
            onClick={(d) => { const r = (d as { payload?: GroupRow }).payload; if (r && href && r.gaps > 0) router.push(href(r)); }}
          >
            {data.map((r) => (
              <Cell
                key={r.key}
                fill={FILL.series}
                fillOpacity={tiny(r) ? 0.45 : 1}
                className={href && r.gaps > 0 ? "cursor-pointer" : undefined}
              />
            ))}
            <LabelList dataKey="rate" position="top" fontSize={11} className="fill-foreground" formatter={(v) => `${Number(v).toFixed(1)}%`} />
          </Bar>
        </BarChart>
      </ChartContainer>
      <SrTable
        caption="Open-gap rate by age band"
        head={["Age band", "Patients", "Open gaps", "Gap rate"]}
        rows={rows.map((r) => ({
          cells: [`${prefix}${r.key}`, fmt(r.total), fmt(r.gaps), pctText(r.gaps, r.total)],
          href: href && r.gaps > 0 ? href(r) : undefined,
          linkLabel: `View ${fmt(r.gaps)} open ${r.gaps === 1 ? "gap" : "gaps"}`,
        }))}
      />
    </>
  );
}
