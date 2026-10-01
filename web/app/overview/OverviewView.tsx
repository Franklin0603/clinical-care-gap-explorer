"use client";

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, CalendarClock, Target, Users2 } from "lucide-react";

import { gold, dq, roleRows, PatientRow } from "@/lib/data";
import { Page, Section } from "@/components/shell/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Term } from "@/components/Term";

/** The full cohort. Overview is the unrestricted view — role scoping lives on
 *  the Patients page, which is the page making that argument. */
const ALL = roleRows.physician;

const BAND = (age: number) =>
  age < 45 ? "18-44" : age < 65 ? "45-64" : age <= 75 ? "65-75" : "76+";

const chartConfig = {
  patients: { label: "In cohort", color: "var(--chart-1)" },
  gaps: { label: "Overdue", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Base UI renders the raw value in a closed trigger unless given a formatter, so a
 *  filter resting on "all" showed the key rather than "All patients". Module scope,
 *  not the component body: a fresh object each render stops the React Compiler
 *  preserving the useMemo below. Values absent here are already their own label —
 *  an age band, a care setting. */
const STATUS_LABELS: Record<string, string> = {
  all: "All patients",
  overdue: "Overdue only",
  never: "Never tested",
  current: "Up to date",
};
const BAND_LABELS: Record<string, string> = { all: "All ages" };
const UNIT_LABELS: Record<string, string> = { all: "All settings" };

const shown = (labels: Record<string, string>) => (v: string | null) =>
  labels[v ?? "all"] ?? v ?? "";

export default function OverviewView() {
  const [band, setBand] = useState("all");
  const [status, setStatus] = useState("all");
  const [unit, setUnit] = useState("all");

  /** Base UI's Select can clear to null; "all" is this page's cleared state. */
  const pick = (set: (v: string) => void) => (v: string | null) => set(v ?? "all");


  const units = useMemo(
    () => [...new Set(ALL.map((r) => String(r.unit)))].sort(),
    [],
  );

  const filtered = useMemo(
    () =>
      ALL.filter((r) => {
        if (band !== "all" && BAND(Number(r.age)) !== band) return false;
        if (unit !== "all" && r.unit !== unit) return false;
        if (status === "overdue" && !r.gap_flag) return false;
        if (status === "current" && r.gap_flag) return false;
        if (status === "never" && r.last_a1c_date !== null) return false;
        return true;
      }),
    [band, status, unit],
  );

  const stats = useMemo(() => {
    const n = filtered.length;
    const gaps = filtered.filter((r) => r.gap_flag).length;
    const never = filtered.filter((r) => r.last_a1c_date === null).length;
    const soon = filtered.filter(
      (r) =>
        !r.gap_flag &&
        r.next_due_date !== null &&
        (new Date(String(r.next_due_date)).getTime() - new Date(gold.asof).getTime()) / 864e5 <= 90,
    ).length;
    return { n, gaps, never, soon, rate: n ? Math.round((gaps / n) * 1000) / 10 : 0 };
  }, [filtered]);

  const byBand = useMemo(() => {
    const seed: Record<string, { band: string; patients: number; gaps: number }> =
      Object.fromEntries(
        ["18-44", "45-64", "65-75", "76+"].map((b) => [b, { band: b, patients: 0, gaps: 0 }]),
      );
    for (const r of filtered) {
      const b = seed[BAND(Number(r.age))];
      b.patients += 1;
      if (r.gap_flag) b.gaps += 1;
    }
    return Object.values(seed);
  }, [filtered]);

  const byUnit = useMemo(() => {
    const m = new Map<string, { unit: string; patients: number; gaps: number }>();
    for (const r of filtered) {
      const k = String(r.unit);
      if (!m.has(k)) m.set(k, { unit: k, patients: 0, gaps: 0 });
      const e = m.get(k)!;
      e.patients += 1;
      if (r.gap_flag) e.gaps += 1;
    }
    return [...m.values()].sort((a, b) => b.patients - a.patients);
  }, [filtered]);

  /** Gap count as the assumed "today" moves forward — why the date is frozen. */
  const drift = useMemo(() => {
    const asof = new Date(gold.asof).getTime();
    return [0, 1, 3, 6, 9, 12].map((months) => {
      const when = asof + months * 30.44 * 864e5;
      const overdue = ALL.filter((r: PatientRow) => {
        if (r.last_a1c_date === null) return true;
        return (when - new Date(String(r.last_a1c_date)).getTime()) / 864e5 > 365;
      }).length;
      return { label: months === 0 ? "as-of" : `+${months}m`, overdue };
    });
  }, []);

  const filtering = band !== "all" || status !== "all" || unit !== "all";

  return (
    <Page
      title="Overview"
      blurb="The headline numbers and how they break down"
      actions={<Badge variant="outline" className="num">as of {gold.asof}</Badge>}
    >
      <Section
        title="The cohort"
        blurb={<>Every figure describes the <Term k="cohort">diabetic cohort</Term> alive on the <Term k="as-of date">as-of date</Term>, and comes from the pipeline output. The filters apply to all four cards and both charts below.</>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={status} onValueChange={pick(setStatus)}>
              <SelectTrigger className="w-[150px]" size="sm">
                <SelectValue>{shown(STATUS_LABELS)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All patients</SelectItem>
                <SelectItem value="overdue">Overdue only</SelectItem>
                <SelectItem value="never">Never tested</SelectItem>
                <SelectItem value="current">Up to date</SelectItem>
              </SelectContent>
            </Select>
            <Select value={band} onValueChange={pick(setBand)}>
              <SelectTrigger className="w-[130px]" size="sm">
                <SelectValue>{shown(BAND_LABELS)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ages</SelectItem>
                {["18-44", "45-64", "65-75", "76+"].map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={unit} onValueChange={pick(setUnit)}>
              <SelectTrigger className="w-[150px]" size="sm">
                <SelectValue>{shown(UNIT_LABELS)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All settings</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Users2}
            value={String(stats.n)}
            label="patients in view"
            note={filtering ? `filtered from ${gold.cohort}` : "the whole cohort"}
          />
          <StatCard
            icon={AlertTriangle}
            value={String(stats.gaps)}
            label="with an open gap"
            note={`${stats.rate}% of patients in view`}
            accent
          />
          <StatCard
            icon={Target}
            value={String(stats.never)}
            label="never tested at all"
            note="the highest-risk patients on the list"
            accent
          />
          <StatCard
            icon={CalendarClock}
            value={String(stats.soon)}
            label="due within 90 days"
            note="not yet a gap — the preventable ones"
          />
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gap rate by age band</CardTitle>
            <CardDescription>
              Bands follow the <Term k="hedis">HEDIS</Term> diabetes measure — 18 to 75
              with a 65 to 75 split — rather than round decades. The 76+ band sits
              outside the measure entirely.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <BarChart data={byBand} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="band" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={34} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="patients" fill="var(--color-patients)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gaps" fill="var(--color-gaps)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="gaps" position="top" className="fill-muted-foreground text-xs" />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where they were last seen</CardTitle>
            <CardDescription>
              Care setting of the most recent <Term k="encounter">encounter</Term>. This
              is also what scopes a technician&apos;s row access on the Patients page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <BarChart
                data={byUnit}
                layout="vertical"
                margin={{ top: 4, right: 30, left: 4, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="unit"
                  tickLine={false}
                  axisLine={false}
                  width={86}
                  className="text-xs"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="patients" radius={4}>
                  {byUnit.map((row) => (
                    <Cell key={row.unit} fill={row.gaps > 0 ? "var(--chart-1)" : "var(--chart-3)"} />
                  ))}
                  <LabelList dataKey="patients" position="right" className="fill-muted-foreground text-xs" />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why the reporting date is frozen</CardTitle>
          <CardDescription>
            Open gaps if &ldquo;today&rdquo; moved forward. The data stops on {gold.asof};
            the calendar does not, so a run-time date would push every patient over the
            line eventually. Not affected by the filters above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{ overdue: { label: "Open gaps", color: "var(--chart-2)" } }}
            className="h-[200px] w-full"
          >
            <LineChart data={drift} margin={{ top: 20, right: 16, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={36} domain={[0, gold.cohort]} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="overdue"
                stroke="var(--color-overdue)"
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              >
                <LabelList
                  dataKey="overdue"
                  position="top"
                  offset={10}
                  className="fill-foreground text-xs font-medium"
                />
              </Line>
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Section
        title="Data quality"
        blurb={<>249 rows damaged on purpose, so the <Term k="catch rate">catch rate</Term> is a measurement rather than a claim.</>}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            value={dq.catch_rate_types}
            label="defect types caught"
            note="each by the check meant for it"
          />
          <StatCard
            value={dq.catch_rate_rows}
            label="injected rows caught"
            note="scored against the ground-truth log"
          />
          <StatCard
            value={String(
              Object.values(dq.quarantine_by_check as Record<string, number>).reduce(
                (a, b) => a + b,
                0,
              ),
            )}
            label="rows quarantined"
            note="held back with a reason, never dropped"
          />
        </div>
      </Section>
    </Page>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  note,
  accent,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-6">
        {Icon && <Icon className={`mb-1 size-4 ${accent ? "text-destructive" : "text-primary"}`} />}
        <div
          className={`num text-3xl font-semibold tracking-tight ${accent ? "text-destructive" : ""}`}
        >
          {value}
        </div>
        <div className="text-sm font-medium">{label}</div>
        <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
