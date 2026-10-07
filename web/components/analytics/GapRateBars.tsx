"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip as RTooltip, XAxis, YAxis } from "recharts";

import { fmt } from "@/lib/data";
import { GroupRow, pctText } from "@/lib/cohort";
import { ChartContainer } from "@/components/ui/chart";
import { FILL, SrTable, TipBox } from "./chartBits";

/**
 * Open-gap rate per group as a horizontal bar chart on a 0-100% axis. Every
 * bar is labelled with its rate and its numerator and denominator - so the
 * Skilled nursing bar at 100% reads "100.0% · 1 of 1" and cannot pass for a
 * finding. Groups under `small` patients are drawn lighter and starred.
 */
export function GapRateBars({
  rows, labels, small = 10, linkParam,
}: {
  rows: GroupRow[];
  /** Display name per group key; plain data, since the page is a server component. */
  labels: Record<string, string>;
  small?: number;
  /** Links each group with open gaps to /patients?status=gap&<param>=<key>. */
  linkParam?: "age" | "setting";
}) {
  const router = useRouter();
  const label = (k: string) => labels[k] ?? k;
  const href = linkParam
    ? (r: GroupRow) => `/patients?status=gap&${linkParam}=${encodeURIComponent(r.key)}`
    : undefined;
  const tiny = (r: GroupRow) => r.total > 0 && r.total < small;
  const data = rows.map((r) => ({
    ...r,
    rate: r.gapRate,
    name: `${label(r.key)}${tiny(r) ? "*" : ""}`,
    tag: `${pctText(r.gaps, r.total)} · ${fmt(r.gaps)} of ${fmt(r.total)}`,
  }));

  return (
    <>
      <ChartContainer config={{}} className="w-full" style={{ height: Math.max(160, rows.length * 38 + 36) }} aria-hidden>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 112, left: 0, bottom: 4 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={112} fontSize={12} interval={0} />
          <RTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) => {
              const r = active ? (payload?.[0]?.payload as GroupRow | undefined) : undefined;
              return r ? (
                <TipBox
                  title={`${label(r.key)}${tiny(r) ? " · small group" : ""}`}
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
            radius={[0, 4, 4, 0]}
            barSize={18}
            background={{ fill: "var(--muted)", radius: 4 }}
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
            {/* Labels sit past the end of the 100% track, so a full bar never
                covers its own "1 of 1". */}
            <LabelList
              dataKey="tag"
              content={({ y, height, value }) => (
                <text x="100%" dx={-4} y={Number(y) + Number(height) / 2} dy={4} textAnchor="end" fontSize={11} className="fill-foreground">
                  {String(value)}
                </text>
              )}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <SrTable
        caption="Open-gap rate by care setting"
        head={["Care setting", "Patients", "Open gaps", "Gap rate"]}
        rows={rows.map((r) => ({
          cells: [label(r.key), fmt(r.total), fmt(r.gaps), pctText(r.gaps, r.total)],
          href: href && r.gaps > 0 ? href(r) : undefined,
          linkLabel: `View ${fmt(r.gaps)} open ${r.gaps === 1 ? "gap" : "gaps"}`,
        }))}
      />
    </>
  );
}
