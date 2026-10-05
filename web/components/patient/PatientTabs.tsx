"use client";

import { useState } from "react";
import { ArrowRight, Syringe } from "lucide-react";

import { PatientRow, fmt } from "@/lib/data";
import { lastA1cValue, settingLabel } from "@/lib/cohort";
import { longDate } from "@/lib/dates";
import {
  INSULIN_DOC_TEXT, InsulinDoc, PatientDetail, a1cSummary, insulinPerYear, insulinStart, testsPerYear,
} from "@/lib/patientDetail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Term } from "@/components/Term";
import { A1cSeriesChart, CohortComparisonChart, TestsPerYearChart } from "./A1cCharts";
import { CareGapAssessment } from "./CareGapAssessment";
import { Facts, NoData, None, Panel } from "./parts";

export type TabKey = "overview" | "a1c" | "medications" | "procedures";

const day = (v: unknown) => longDate(v as string | null);

/** The neutral insulin marker used in every table: a word, the icon optional. */
export function InsulinBadge() {
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Syringe className="size-3" aria-hidden /> Insulin
    </Badge>
  );
}

/* ---------------------------------------------------------------- overview */

/**
 * Why am I reviewing this patient: the assessment, the context around it, and
 * one line per history tab saying how much is there. No charts and no tables;
 * those are a tab away.
 */
export function OverviewTab({
  patient: r, detail, insulin, go,
}: {
  patient: PatientRow;
  detail: PatientDetail | null;
  insulin: InsulinDoc;
  go: (t: TabKey) => void;
}) {
  const s = detail ? a1cSummary(detail.a1c) : null;
  const meds = detail?.meds ?? [];
  const insulinRows = meds.filter((m) => m.insulin).length;
  const procs = detail?.procs ?? [];
  const procTimes = procs.reduce((n, p) => n + p.times, 0);

  return (
    <div className="flex flex-col gap-4">
      <CareGapAssessment patient={r} />

      <Panel as="h2" title="Clinical context">
        <Facts
          items={[
            { label: "Age", value: <span className="num">{String(r.age)}</span> },
            { label: "Sex", value: r.sex === "M" ? "Male" : r.sex === "F" ? "Female" : <None>Not recorded</None> },
            { label: "Diabetes first recorded", value: day(r.first_dx_date) ?? <None>Not recorded</None> },
            { label: "Last seen", value: day(r.last_encounter_date) ?? <None>Not recorded</None> },
            { label: "Care setting of last encounter", value: settingLabel(r.unit) },
            {
              label: "A1c tests in the last 2 years",
              value: <span className="num">{fmt(Number(r.a1c_count_2y ?? 0))}</span>,
            },
            {
              label: "Medications active on the data date",
              value: <span className="num">{fmt(Number(r.active_med_count ?? 0))}</span>,
            },
            { label: "Insulin", value: INSULIN_DOC_TEXT[insulin].long },
          ]}
        />
      </Panel>

      <div className="grid gap-4 md:grid-cols-3">
        <Preview
          title="A1c history"
          loading={!detail}
          line={s ? `${fmt(s.count)} ${s.count === 1 ? "result" : "results"}, ${s.firstYear}–${s.lastYear}` : "No A1c results available"}
          action="View A1c history"
          onClick={() => go("a1c")}
        />
        <Preview
          title="Medications"
          loading={!detail}
          line={meds.length
            ? `${fmt(meds.length)} ${meds.length === 1 ? "medication" : "medications"} represented${insulinRows ? `, ${insulinRows} insulin` : ""}`
            : "No medication records available"}
          action="View medications"
          onClick={() => go("medications")}
        />
        <Preview
          title="Procedures"
          loading={!detail}
          line={procs.length
            ? `${fmt(procs.length)} procedure ${procs.length === 1 ? "type" : "types"}, ${fmt(procTimes)} recorded`
            : "No procedure records available"}
          action="View procedures"
          onClick={() => go("procedures")}
        />
      </div>
    </div>
  );
}

function Preview({ title, line, action, onClick, loading }: {
  title: string; line: string; action: string; onClick: () => void; loading: boolean;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {loading ? (
        <span className="h-5 w-40 animate-pulse rounded bg-muted" aria-label="Loading" />
      ) : (
        <p className="text-sm text-muted-foreground">{line}</p>
      )}
      <Button variant="link" className="mt-auto h-auto justify-start p-0" onClick={onClick}>
        {action}
        <ArrowRight aria-hidden />
      </Button>
    </section>
  );
}

/* --------------------------------------------------------------------- A1c */

export function A1cTab({
  patient: r, detail, cohort,
}: {
  patient: PatientRow;
  detail: PatientDetail;
  cohort: PatientRow[];
}) {
  const series = detail.a1c;
  const s = a1cSummary(series);
  const insStart = insulinStart(detail.meds);
  const perYear = testsPerYear(series);
  const insYear = insulinPerYear(detail.meds);
  const mine = lastA1cValue(r);

  return (
    <div className="flex flex-col gap-4">
      <Panel as="h2" title="A1c history">
        {s ? (
          <Facts
            className="lg:grid-cols-4"
            items={[
              { label: "Latest A1c", value: <><span className="num font-medium">{s.latest.v.toFixed(1)}%</span> <span className="text-xs text-muted-foreground">{day(s.latest.d)}</span></> },
              {
                label: "Previous A1c",
                value: s.previous
                  ? <><span className="num">{s.previous.v.toFixed(1)}%</span> <span className="text-xs text-muted-foreground">{day(s.previous.d)}</span></>
                  : <None>None on file</None>,
              },
              { label: "Latest test date", value: day(s.latest.d) },
              { label: "Results on file", value: <><span className="num">{fmt(s.count)}</span> <span className="text-xs text-muted-foreground">{s.firstYear}–{s.lastYear}</span></> },
            ]}
          />
        ) : (
          <NoData title="No A1c results available">
            No qualifying A1c result was found for this patient in the available data,
            which is why the care-gap report lists them.
          </NoData>
        )}
      </Panel>

      {s && (
        <>
          <Panel
            title="Every A1c on file"
            description={
              <>
                {fmt(s.count)} {s.count === 1 ? "result" : "results"} from {s.firstYear} to {s.lastYear}. The dashed
                line at 7% is shown as a common reference point; individual <Term k="a1c">A1c</Term> goals
                may differ. The shaded band is above it.
                {insStart && " The marker is when an insulin prescription first appears in the medication data."}
              </>
            }
          >
            <A1cSeriesChart series={series} insStart={insStart} />
          </Panel>

          <Panel
            title="Tests per year"
            description={
              <>
                Empty years are drawn, not skipped, so a lapse in testing looks like one.
                {insYear.length > 0 &&
                  " The second series counts insulin fills, which are dispensing records, in the year each insulin prescription started. Fills are not a measure of whether the insulin was taken."}
              </>
            }
          >
            <TestsPerYearChart perYear={perYear} insYear={insYear} />
          </Panel>
        </>
      )}

      <Panel
        title="Against the rest of the cohort"
        description={
          <>
            Latest A1c by age band, one box per band, with the patient count in brackets. Whiskers
            are the true minimum and maximum, not a 1.5 IQR fence, because some bands hold only a
            handful of patients.
            {mine === null && " This patient has no A1c result, so there is nothing to mark on it."}
          </>
        }
      >
        <CohortComparisonChart cohort={cohort} mine={mine} />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------- medications */

/**
 * One table, not split into diabetes and other medications: the only reliable
 * classification in this data is the pipeline's insulin code list, so insulin
 * is marked and nothing else is guessed at from drug names.
 */
export function MedicationsTab({ detail, insulin }: { detail: PatientDetail; insulin: InsulinDoc }) {
  const meds = detail.meds;
  return (
    <div className="flex flex-col gap-4">
      <Panel as="h2" title="Diabetes therapy">
        <span className="text-sm font-medium">{INSULIN_DOC_TEXT[insulin].short}</span>
        <p className="text-sm text-muted-foreground">{INSULIN_DOC_TEXT[insulin].long}</p>
      </Panel>

      <Panel
        title={`Medications (${fmt(meds.length)})`}
        description="One row per medication represented in the source, not per prescription. Fill counts reflect dispensing records; dose and confirmed medication use are not available in this dataset. Insulin is identified by the pipeline's list of insulin drug codes."
      >
        {meds.length === 0 ? (
          <NoData title="No medication records available" />
        ) : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 sm:pl-5">Medication</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead className="pr-4 text-right sm:pr-5">Fills</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meds.map((m) => (
                  <TableRow key={`${m.code}-${m.started}`}>
                    <TableCell className="min-w-64 max-w-[28rem] whitespace-normal pl-4 sm:pl-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{m.name}</span>
                        {m.insulin && <InsulinBadge />}
                      </div>
                    </TableCell>
                    <TableCell className="num whitespace-nowrap">{day(m.started) ?? <None>—</None>}</TableCell>
                    <TableCell className="num whitespace-nowrap">
                      {m.ended ? day(m.ended) : <None>No end date</None>}
                    </TableCell>
                    <TableCell className="num pr-4 text-right sm:pr-5">{fmt(m.fills)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* -------------------------------------------------------------- procedures */

const PROC_PREVIEW = 25;

export function ProceduresTab({ detail }: { detail: PatientDetail }) {
  const procs = detail.procs;
  const [all, setAll] = useState(false);
  const shown = all ? procs : procs.slice(0, PROC_PREVIEW);
  return (
    <Panel
      as="h2"
      title={`Procedures performed (${fmt(procs.length)})`}
      description="This history reflects procedures recorded as performed, most recent first. Both ends of the range are shown, because 20 screenings, last in April, does not say whether that is a decade of routine care or a burst last year. The available source does not contain an orders table, so it cannot determine whether a test was ordered but not completed."
    >
      {procs.length === 0 ? (
        <NoData title="No procedure records available" />
      ) : (
        <>
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 sm:pl-5">Procedure</TableHead>
                  <TableHead>First done</TableHead>
                  <TableHead>Last done</TableHead>
                  <TableHead className="pr-4 text-right sm:pr-5">Times</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((p) => (
                  <TableRow key={`${p.code}-${p.last}`}>
                    <TableCell className="min-w-64 max-w-[30rem] whitespace-normal pl-4 sm:pl-5">{p.name}</TableCell>
                    <TableCell className="num whitespace-nowrap">{day(p.first) ?? <None>—</None>}</TableCell>
                    <TableCell className="num whitespace-nowrap">{day(p.last) ?? <None>—</None>}</TableCell>
                    <TableCell className="num pr-4 text-right sm:pr-5">{fmt(p.times)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {procs.length > PROC_PREVIEW && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {all ? `All ${fmt(procs.length)} shown.` : `Showing the ${PROC_PREVIEW} most recent of ${fmt(procs.length)}.`}
              </span>
              <Button variant="outline" size="sm" onClick={() => setAll((a) => !a)}>
                {all ? `Show the ${PROC_PREVIEW} most recent` : `Show all ${fmt(procs.length)}`}
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
