"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine,
  XAxis, YAxis,
} from "recharts";
import { Syringe, TrendingUp, Activity, Stethoscope } from "lucide-react";

import { PatientRow, fmt } from "@/lib/data";
import {
  A1C_TARGET, Box, PatientDetail as Detail, boxes, insulinPerYear, insulinStart,
  loadPatientDetail, testsPerYear,
} from "@/lib/patientDetail";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Term } from "@/components/Term";

const chartConfig = {
  v: { label: "A1c %", color: "var(--chart-1)" },
  tests: { label: "A1c tests", color: "var(--chart-1)" },
  fills: { label: "Insulin fills", color: "var(--chart-2)" },
} satisfies ChartConfig;

const date = (v: unknown) => (v ? String(v).slice(0, 10) : "—");

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
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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

/* -------------------------------------------------------------------- panel */

export function PatientDetailSheet({
  patient, cohort, onClose,
}: {
  patient: PatientRow | null;
  cohort: PatientRow[];
  onClose: () => void;
}) {
  const [all, setAll] = useState<Record<string, Detail> | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!patient || all) return;
    let live = true;
    loadPatientDetail()
      .then((d) => { if (live) setAll(d); })
      .catch((e: unknown) => {
        if (live) setFailed(e instanceof Error ? e.message : String(e));
      });
    return () => { live = false; };
  }, [patient, all]);

  const pid = patient ? String(patient.patient_id) : null;
  const detail = pid && all ? all[pid] : undefined;

  /** Cohort A1c spread by age band, so one patient has something to sit against. */
  const bandBoxes = useMemo(() => {
    const g = new Map<string, number[]>();
    for (const r of cohort) {
      // Number(null) is 0, and 0 is finite - so a Number.isFinite guard alone
      // let all 21 never-tested patients into the distribution as a 0% A1c,
      // which is biologically impossible and pulled every box downwards. The
      // bands read 116 patients instead of the 95 who have a result.
      if (r.last_a1c_value === null || r.last_a1c_value === undefined) continue;
      const v = Number(r.last_a1c_value);
      if (!Number.isFinite(v)) continue;
      const age = Number(r.age);
      const band = age < 45 ? "18-44" : age < 65 ? "45-64" : age <= 75 ? "65-75" : "76+";
      if (!g.has(band)) g.set(band, []);
      g.get(band)!.push(v);
    }
    return boxes(new Map([...g.entries()].sort()));
  }, [cohort]);

  const series = detail?.a1c ?? [];
  const insStart = detail ? insulinStart(detail.meds) : null;
  const perYear = detail ? testsPerYear(detail.a1c) : [];
  const insYear = detail ? insulinPerYear(detail.meds) : [];
  // Same null trap as above: a never-tested patient would be marked at 0%.
  const mine =
    patient && patient.last_a1c_value !== null && patient.last_a1c_value !== undefined
      && Number.isFinite(Number(patient.last_a1c_value))
      ? Number(patient.last_a1c_value)
      : null;

  return (
    <Sheet open={!!patient} onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* Wide. At max-w-3xl the three charts sat in a column barely 300px across:
          the box plot lost its y-axis numbers entirely and its four band labels
          overlapped into one smear. */}
      {/* The width classes carry the same data-[side=right] prefix the component
          uses. A plain sm:max-w-5xl loses to its data-[side=right]:sm:max-w-sm on
          specificity and tailwind-merge cannot dedupe them, so the panel stayed
          384px wide and the charts kept their 136px columns. */}
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-4xl data-[side=right]:lg:max-w-6xl">
        {patient && (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm">{String(patient.mrn).slice(0, 8)}</span>
                <span className="text-muted-foreground">
                  {patient.age} year old {String(patient.sex) === "M" ? "man" : "woman"}
                </span>
                {/* days_overdue is null for a patient who was never tested, and
                    Number(null) is 0 - so the panel announced "0 days overdue"
                    over a header that also said the A1c was never recorded. */}
                {patient.last_a1c_date === null ? (
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    never tested
                  </Badge>
                ) : patient.gap_flag ? (
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    {fmt(Number(patient.days_overdue))} days overdue
                  </Badge>
                ) : (
                  <Badge variant="secondary">up to date</Badge>
                )}
                {patient.on_insulin ? (
                  <Badge variant="outline" className="gap-1">
                    <Syringe className="size-3" /> insulin
                  </Badge>
                ) : null}
              </SheetTitle>
              <SheetDescription>
                Last seen {date(patient.last_encounter_date)} in{" "}
                {String(patient.unit)}. Diagnosed {date(patient.first_dx_date)}. Last{" "}
                <Term k="a1c">A1c</Term>{" "}
                {patient.last_a1c_value === null
                  ? "never recorded"
                  : `${patient.last_a1c_value}% on ${date(patient.last_a1c_date)}`}
                .
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4 pb-8">
              {failed && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  Could not load the patient record: {failed}
                </p>
              )}
              {!detail && !failed && (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-[230px] w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              )}

              {detail && (
                <>
                  {/* ------------------------------------------------ line */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <TrendingUp className="size-4 text-primary" />
                        Every A1c on file
                      </CardTitle>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {series.length === 0
                          ? "This patient has never had an A1c recorded, which is why the report lists them. There is nothing to plot, and that is the finding."
                          : `${series.length} results from ${series[0].d.slice(0, 4)} to ${series[series.length - 1].d.slice(0, 4)}. The line at ${A1C_TARGET}% is the usual control target; the shaded band is above it.${insStart ? " The marker is when insulin first appears." : ""}`}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {series.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          No results
                        </p>
                      ) : (
                        <ChartContainer config={chartConfig} className="h-[230px] w-full">
                          <LineChart data={series} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
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
                      )}
                    </CardContent>
                  </Card>

                  {/* --------------------------------------- bar + box pair */}
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <Activity className="size-4 text-primary" />
                          Tests per year
                        </CardTitle>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Empty years are drawn, not skipped, so a lapse in testing looks
                          like one.
                          {insYear.length > 0 && " Insulin fills are the second series."}
                        </p>
                      </CardHeader>
                      <CardContent>
                        {perYear.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">
                            No results
                          </p>
                        ) : (
                          <ChartContainer config={chartConfig} className="h-[230px] w-full">
                            <BarChart
                              data={perYear.map((r) => ({
                                ...r,
                                fills: insYear.find((i) => i.year === r.year)?.fills ?? 0,
                              }))}
                              margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
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
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <Stethoscope className="size-4 text-primary" />
                          Against the rest of the cohort
                        </CardTitle>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Latest A1c by age band, as a box per band. Whiskers are the
                          true minimum and maximum, not a 1.5 IQR fence, because some
                          bands hold only a handful of patients.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <DistributionChart data={bandBoxes} mark={mine} />
                      </CardContent>
                    </Card>
                  </div>

                  {/* ------------------------------------------ medications */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        Medications ({detail.meds.length})
                      </CardTitle>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        One row per drug, not per prescription. Fills are dispense
                        counts, which is the only quantity the source carries; there is
                        no dose anywhere in this data.
                      </p>
                    </CardHeader>
                    <CardContent className="overflow-auto p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Drug</TableHead>
                            <TableHead>Started</TableHead>
                            <TableHead>Ended</TableHead>
                            <TableHead className="text-right">Fills</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.meds.map((m) => (
                            <TableRow key={`${m.code}-${m.started}`}>
                              <TableCell className="max-w-[22rem]">
                                <span className={m.insulin ? "font-medium text-primary" : ""}>
                                  {m.name}
                                </span>
                                {m.insulin && (
                                  <Badge variant="outline" className="ml-2 gap-1 text-[10px]">
                                    <Syringe className="size-2.5" /> insulin
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="num text-xs">{date(m.started)}</TableCell>
                              <TableCell className="num text-xs">
                                {m.ended ? date(m.ended) : (
                                  <span className="text-primary">active</span>
                                )}
                              </TableCell>
                              <TableCell className="num text-right text-xs">{m.fills}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* -------------------------------------------- procedures */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        Procedures performed ({detail.procs.length})
                      </CardTitle>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        What was done, not what was ordered. Both ends of the range
                        are shown, because &ldquo;20 screenings, last in April&rdquo;
                        does not say whether that is a decade of routine care or a
                        burst last year. This data has no orders table, so it cannot
                        say whether a test was requested and missed.
                      </p>
                    </CardHeader>
                    <CardContent className="overflow-auto p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Procedure</TableHead>
                            <TableHead>First done</TableHead>
                            <TableHead>Last done</TableHead>
                            <TableHead className="text-right">Times</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.procs.slice(0, 25).map((p) => (
                            <TableRow key={`${p.code}-${p.last}`}>
                              <TableCell className="max-w-[24rem]">{p.name}</TableCell>
                              <TableCell className="num text-xs">{date(p.first)}</TableCell>
                              <TableCell className="num text-xs">{date(p.last)}</TableCell>
                              <TableCell className="num text-right text-xs">{p.times}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {detail.procs.length > 25 && (
                        <p className="px-4 py-3 text-xs text-muted-foreground">
                          Showing the 25 most recent of {detail.procs.length}.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
