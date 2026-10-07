"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Cell, Pie, PieChart, Tooltip as RTooltip } from "recharts";

import { fmt } from "@/lib/data";
import { pctText } from "@/lib/cohort";
import { ChartContainer } from "@/components/ui/chart";
import { TipBox } from "./chartBits";

/**
 * A ring of mutually exclusive parts with the headline in its centre, and a
 * legend that writes every part out - count and share of the stated
 * denominator - so the ring is never the only way to read the numbers. A part
 * with somewhere to go links there from the legend, and from the ring.
 */
export type DonutPart = {
  key: string;
  label: string;
  about: string;
  n: number;
  fill: string;
  opacity?: number;
  href?: string;
};

export function Donut({
  parts, total, of, ofNote, center, centerLabel,
}: {
  parts: DonutPart[];
  total: number;
  /** What the shares are shares of, e.g. "116 patients" or "25 open gaps". */
  of: string;
  /** A clarification after the denominator in the legend, e.g. "not 116 patients". */
  ofNote?: string;
  center: string;
  centerLabel: string;
}) {
  const router = useRouter();
  return (
    // A container query, not a breakpoint: in the dashboard's narrow right
    // column the card is slim at every screen width from lg up, so the ring
    // sits beside its legend only when the card itself has the room.
    <div className="@container w-full">
    <div className="flex flex-col items-center gap-4 @min-[20rem]:flex-row @min-[20rem]:gap-5">
      <div className="relative size-32 shrink-0">
        <ChartContainer config={{}} className="size-32" aria-hidden>
          <PieChart>
            <RTooltip
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as DonutPart | undefined) : undefined;
                return p ? (
                  <TipBox
                    title={p.label}
                    rows={[
                      { label: "Patients", value: `${fmt(p.n)} of ${of}` },
                      { label: "Share", value: pctText(p.n, total), strong: true },
                    ]}
                  />
                ) : null;
              }}
            />
            <Pie
              data={parts}
              dataKey="n"
              nameKey="label"
              innerRadius={42}
              outerRadius={60}
              startAngle={90}
              endAngle={-270}
              paddingAngle={parts.filter((p) => p.n > 0).length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
              onClick={(d) => { const h = (d as { payload?: DonutPart }).payload?.href; if (h) router.push(h); }}
            >
              {parts.map((p) => (
                <Cell key={p.key} fill={p.fill} fillOpacity={p.opacity ?? 1} className={p.href ? "cursor-pointer" : undefined} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
          <span className="num text-xl font-semibold leading-tight">{center}</span>
          <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-col gap-2">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.fill, opacity: p.opacity ?? 1 }} aria-hidden />
            {p.href ? (
              <Link
                href={p.href}
                title={p.about}
                className="group inline-flex min-w-0 flex-1 items-center gap-1 rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {p.label}
                <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                <span className="sr-only">: {p.about}</span>
              </Link>
            ) : (
              <span className="flex-1">{p.label}</span>
            )}
            <span className="num font-semibold">{fmt(p.n)}</span>
            <span className="num w-11 shrink-0 text-right text-xs text-muted-foreground">{pctText(p.n, total)}</span>
          </li>
        ))}
        <li className="border-t pt-2 text-xs text-muted-foreground">
          Shares of <span className="num">{of}</span>{ofNote && <>, {ofNote}</>}
        </li>
      </ul>
    </div>
    </div>
  );
}
