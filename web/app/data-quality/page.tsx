import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { ArrowRight, CircleCheck, Info } from "lucide-react";

import { dq, gold, patients } from "@/lib/data";
import { longDate } from "@/lib/dates";
import { shortMrn } from "@/lib/cohort";
import { AUDIT, checkSummary, gapDrift, qualityChecks, reconciliation } from "@/lib/quality";
import { PIPELINE_SECTIONS } from "@/components/shell/nav";
import { Page, Section } from "@/components/shell/Page";
import { GapStatusBadge } from "@/components/GapStatusBadge";
import { DataLayers } from "@/components/DataLayers";
import { A1cTimeline } from "@/components/learn/A1cTimeline";
import {
  CheckList, Code, Decision, Equation, JoinComparison, PipelineLineage, Stage, SummaryCard,
} from "@/components/quality/QualityParts";
import { AssetFigure } from "@/components/quality/AssetFigure";

export const metadata = { title: "Data & Quality" };

/**
 * The transparency layer: where the data came from, how the patient-level
 * measure is made, and the checks that show the results hold together.
 *
 * It validates the application rather than re-implementing it: the counts are
 * lib/cohort.ts, the checks are lib/quality.ts over the same rows every page
 * reads, the pipeline's own results come from the reports it published, and
 * the few facts only the warehouse knows are marked as a dated audit.
 */

const REPO = "https://github.com/Franklin0603/clinical-care-gap-explorer/blob/main";
const fmt = (n: number) => n.toLocaleString("en-US");

const recon = reconciliation(patients, gold.asof);
const s = recon.s;
const checks = qualityChecks(patients, gold, dq);
const summary = checkSummary(checks);
const drift = gapDrift(patients, gold.asof, gold.gap_days);
const bronze = Object.fromEntries(dq.reconciliation.map((t) => [t.table, t]));
const quarantined = dq.reconciliation.reduce((n, t) => n + t.quarantined, 0);
const windowStart = new Date(Date.parse(gold.asof) - gold.gap_days * 86_400_000).toISOString().slice(0, 10);

/** One real patient's history, read at build time only, to show what joining
 *  event tables directly would do to the grain. */
const grainExample = (() => {
  type D = Record<string, { a1c: unknown[]; meds: { prescriptions: number }[]; procs: { times: number }[] }>;
  const detail = JSON.parse(readFileSync(join(process.cwd(), "public/data/patient_detail.json"), "utf8")) as D;
  const [id, d] = Object.entries(detail).sort((a, b) => b[1].a1c.length - a[1].a1c.length)[0];
  const r = patients.find((p) => String(p.patient_id) === id)!;
  const prescriptions = d.meds.reduce((n, m) => n + m.prescriptions, 0);
  return { mrn: shortMrn(r), a1c: d.a1c.length, prescriptions, procedures: d.procs.reduce((n, p) => n + p.times, 0) };
})();

const STAGES: Stage[] = [
  {
    layer: "Source", name: "Synthetic healthcare records", figure: fmt(bronze.patients.bronze), figureLabel: "patients",
    summary: "Synthea CSV exports: patients, conditions, encounters, observations, medications, procedures.",
    details: (
      <>
        <p>Synthetic data, generated for this portfolio demonstration from a pinned seed so every number reproduces.</p>
        <p>{fmt(bronze.observations.bronze)} observations, {fmt(bronze.encounters.bronze)} encounters, {fmt(bronze.conditions.bronze)} conditions, {fmt(bronze.medications.bronze)} medication rows and {fmt(bronze.procedures.bronze)} procedures.</p>
      </>
    ),
  },
  {
    layer: "Raw / Bronze", name: "Faithful copy", figure: String(dq.reconciliation.length), figureLabel: "tables",
    summary: "Loaded as text, exactly as exported. Only a load time and source file are added.",
    details: (
      <>
        <p>Every column is read as text, so no row is silently nulled by type inference. Ingestion is kept apart from transformation, and every Silver row can be traced back.</p>
      </>
    ),
    links: [{ href: "/pipeline#reconciliation", label: "Reconciliation" }],
  },
  {
    layer: "Clean / Silver", name: "Typed and checked", figure: fmt(quarantined), figureLabel: "rows quarantined",
    summary: "Columns typed and renamed; six checks run; failing rows quarantined with a reason.",
    details: (
      <>
        <p>Columns are cast to real types and renamed to the data dictionary. Numeric results are typed while the original text is kept beside them.</p>
        <p>Six checks: encounter duplicates, results with no patient, implausible A1c, impossible birth dates, discharge before admission, and possible duplicate patients. {dq.remediated} A1c unit errors are corrected rather than rejected, and {dq.identity_review_pending} possible duplicate registrations are held for review, never merged automatically.</p>
        <p>Deduplication applies to encounters only, through quarantine; there is no general deduplication step.</p>
      </>
    ),
    links: [{ href: "/pipeline#validate", label: "The six checks" }, { href: "/pipeline#quarantine", label: "Quarantine" }],
  },
  {
    layer: "Cohort", name: "Diabetes cohort", figure: fmt(s.total), figureLabel: "patients",
    summary: `Any of 8 diabetes codes ever recorded, and alive on ${longDate(gold.asof)}.`,
    details: (
      <>
        <p>{AUDIT.everCoded} patients carry a diabetes code; {AUDIT.deceasedByAsof} died before the data date and are excluded, because a care-gap list is a call list. {s.total} remain.</p>
        <p>Quarantined patients cannot enter: the cohort joins through Silver&apos;s patients.</p>
      </>
    ),
    links: [{ href: "/patients", label: "Patients" }],
  },
  {
    layer: "Gold", name: "Patient-level A1c measure", figure: fmt(s.total), figureLabel: "rows, one per patient",
    summary: "Latest A1c, its date, status, open-gap flag, days overdue, next due date.",
    details: (
      <>
        <p>A1c observations are reduced to each patient&apos;s latest numeric result on or before the data date, then joined to the cohort, keeping patients with none.</p>
        <p>{s.current} current, {s.gapPreviouslyTested} overdue, {s.neverTested} never tested. Ten assertions run on this table every time the pipeline does; any failure stops it.</p>
      </>
    ),
    links: [{ href: "/care-gaps", label: "Care Gaps" }],
  },
  {
    layer: "Application", name: "Care Gap Explorer", figure: "6", figureLabel: "areas",
    summary: "Home, Care Gaps, Patients, Tasks, Analytics and Ask AI all read the same rows.",
    details: <p>Exported as static files and read in the browser. Every page counts with the same functions, so they cannot disagree.</p>,
    links: [{ href: "/home", label: "Home" }, { href: "/analytics", label: "Analytics" }, { href: "/ask", label: "Ask AI" }],
  },
];

const linkCls = "inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default function DataQualityPage() {
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
  const REPRO = [
    { label: "Fixed data date", ok: true },
    { label: "Defined denominator", ok: byId.C1.status === "passed" },
    { label: "Explicit lookback", ok: true },
    { label: "Deterministic status logic", ok: byId.M4.status === "passed" },
    { label: "Patient-level grain", ok: byId.G1.status === "passed" },
    { label: "Missing A1c preserved", ok: byId.M3.status === "passed" },
    { label: "Counts reconcile", ok: recon.totalOk && recon.gapsOk },
  ];

  return (
    <Page
      title="Data & Quality"
      description="Understand how source data becomes the patient-level measures used throughout Care Gap Explorer."
      width="wide"
    >
      <p className="-mt-4 flex max-w-3xl items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        This page describes the data pipeline and application measure definitions used in this portfolio demonstration.
      </p>

      {/* 1 ---------------------------------------------------------- lineage */}
      <Section
        id="lineage"
        title="Pipeline and lineage"
        blurb="Where the data comes from, and each step it takes before it reaches a page."
        actions={<Link href="/pipeline" className={linkCls}>Open the full pipeline <ArrowRight className="size-3.5" aria-hidden /></Link>}
      >
        {/* The overview first, framed as one figure; then the interactive
            stages, introduced as the detail behind it. */}
        <AssetFigure
          name="data-pipeline-lineage"
          alt="Data pipeline and lineage: synthetic source records, raw Bronze, clean Silver, the diabetes cohort, the patient-level A1c measure, and Care Gap Explorer."
          caption="High-level overview of the data flow."
          fill
          className="flex flex-col items-center gap-2.5 rounded-xl border bg-muted/30 px-4 py-4 sm:px-6 sm:py-5"
          frameClassName="w-full overflow-hidden rounded-lg border bg-card lg:w-[70%]"
          captionClassName="text-center text-xs text-muted-foreground"
        />
        <div className="flex flex-col gap-1 pt-2">
          <h3 className="text-sm font-semibold">Pipeline stages</h3>
          <p className="text-sm text-muted-foreground">Explore each stage to see its transformations, validation, and outputs.</p>
        </div>
        <PipelineLineage stages={STAGES} />
      </Section>

      {/* 2 --------------------------------------------------- reconciliation */}
      <Section
        id="reconciliation"
        title="Do the numbers reconcile?"
        blurb="Computed here from the same patient rows and functions every page uses, not typed in."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <Equation
            left={{ n: s.total, label: "Total cohort" }}
            parts={[{ n: s.current, label: "Current", tone: "success" }, { n: s.openGaps, label: "Open A1c gaps", tone: "danger" }]}
            ok={recon.totalOk}
            sentence={`${s.total} = ${s.current} + ${s.openGaps}. ${recon.shares.current} current, ${recon.shares.gap} with an open gap.`}
          />
          <Equation
            left={{ n: s.openGaps, label: "Open A1c gaps", tone: "danger" }}
            parts={[{ n: s.neverTested, label: "Never tested", tone: "danger" }, { n: s.gapPreviouslyTested, label: "Overdue", tone: "danger" }]}
            ok={recon.gapsOk}
            sentence={`${s.openGaps} = ${s.neverTested} + ${s.gapPreviouslyTested}. ${recon.shares.never} of open gaps never tested, ${recon.shares.overdue} overdue.`}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">These counts reconcile across Home, Care Gaps, Patients, Analytics and Data &amp; Quality.</p>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/care-gaps" className={linkCls}>View Care Gaps <ArrowRight className="size-3.5" aria-hidden /></Link>
            <Link href="/patients" className={linkCls}>View Patients <ArrowRight className="size-3.5" aria-hidden /></Link>
            <Link href="/analytics" className={linkCls}>View Analytics <ArrowRight className="size-3.5" aria-hidden /></Link>
          </span>
        </div>
      </Section>

      {/* 3 ---------------------------------------------------------- measure */}
      <Section id="measure" title="A1c monitoring measure" blurb="One status per patient, from one rule, against one fixed date.">
        <ul className="grid gap-3 sm:grid-cols-3">
          <li className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">Fixed data date</span>
            <span className="text-lg font-semibold">{longDate(gold.asof)}</span>
          </li>
          <li className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">Lookback</span>
            <span className="text-lg font-semibold">{gold.gap_days} days</span>
            <span className="text-xs text-muted-foreground">From {longDate(windowStart)}</span>
          </li>
          <li className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">Qualifying result</span>
            <span className="text-sm font-medium">A numeric A1c (LOINC 4548-4) on or before the data date</span>
          </li>
        </ul>
        <A1cTimeline />
        <ul className="grid gap-3 md:grid-cols-3">
          {[
            { st: "current" as const, def: `A qualifying A1c result within the previous ${gold.gap_days} days.`, edge: `Boundary: exactly ${gold.gap_days} days old is current.` },
            { st: "overdue" as const, def: `An earlier A1c result exists, but none within the previous ${gold.gap_days} days.`, edge: `Boundary: ${gold.gap_days + 1} days old is overdue.` },
            { st: "never" as const, def: "No qualifying A1c result anywhere in the available data.", edge: "No days-overdue figure: there is no earlier result to be late against." },
          ].map((x) => (
            <li key={x.st} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <GapStatusBadge status={x.st} />
              <p className="text-sm font-medium">{x.def}</p>
              <p className="text-xs text-muted-foreground">{x.edge}</p>
            </li>
          ))}
        </ul>
        <div className="grid gap-3 lg:grid-cols-2">
          <p className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info/5 p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-status-info" aria-hidden />
            Never tested describes the available dataset. It does not establish that a patient has never received an A1c outside the available records.
          </p>
          <ul className="flex list-disc flex-col gap-1 rounded-lg border p-3 pl-7 text-sm text-muted-foreground">
            <li>Monitoring status is not a diagnosis.</li>
            <li>It does not say whether diabetes is controlled, and does not recommend treatment.</li>
            <li>Completing a workflow task does not close a monitoring gap. Only qualifying clinical data changes the status.</li>
          </ul>
        </div>
      </Section>

      {/* 4–5 ------------------------------------------------------ quality */}
      <Section
        id="checks"
        title="Data quality checks"
        blurb="Each check names what it covers, what it found and why it matters. Open a row for the evidence and where the result comes from."
      >
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Check summary">
          <SummaryCard label="Checks evaluated" value={summary.evaluated} note={`of ${summary.total} listed`} />
          <SummaryCard label="Passed" value={summary.passed} />
          <SummaryCard label="Warnings" value={summary.warnings} note={summary.info ? `plus ${summary.info} informational` : undefined} />
          <SummaryCard label="Not evaluated" value={summary.notEvaluated} />
        </ul>
        <p className="max-w-3xl text-xs text-muted-foreground">
          A warning is something worth knowing, not a broken pipeline: small groups, synthetic values, or a gap in coverage. No score is computed from these, because a percentage of checks passed says nothing about which ones.
        </p>
        <CheckList checks={checks} />
      </Section>

      {/* 6 -------------------------------------------------------- decisions */}
      <Section id="decisions" title="Engineering decisions" blurb="The choices that most affect whether the numbers can be trusted.">
        <div className="flex flex-col gap-3">
          <Decision
            n={1}
            open
            layout="split"
            title="Preserve patients with no A1c result"
            decision="Join the cohort to its A1c results with a LEFT JOIN, never an INNER JOIN."
            why={<>Of {gold.cohort} cohort patients, {gold.inner_join_would_keep} have a recorded A1c and {gold.cohort - gold.inner_join_would_keep} have none. Those {gold.cohort - gold.inner_join_would_keep} are the never-tested patients. The missing value is part of the signal.</>}
            alternative={`An INNER JOIN would return ${gold.inner_join_would_keep} rows, run without an error, and look plausible.`}
            risk={`Losing all ${gold.cohort - gold.inner_join_would_keep} never-tested patients, and with them ${gold.cohort - gold.inner_join_would_keep} of the ${gold.open_gaps} open gaps, silently.`}
            doc={{ href: `${REPO}/src/caregap/sql/gold/care_gap_a1c.sql`, label: "The Gold SQL" }}
          >
            {/* The supplied comparison image; the drawn comparison stands in only
                until the image file exists, so the two never appear together. */}
            <AssetFigure
              name="left-vs-inner-join"
              alt={`LEFT JOIN against INNER JOIN. LEFT JOIN: ${gold.cohort} patients retained, ${gold.cohort - gold.inner_join_would_keep} never-tested patients preserved. INNER JOIN: ${gold.inner_join_would_keep} patients retained, ${gold.cohort - gold.inner_join_would_keep} never-tested patients lost.`}
              fill
              frameClassName="w-full overflow-hidden rounded-lg border bg-card"
              fallback={<JoinComparison cohort={gold.cohort} withResult={gold.inner_join_would_keep} />}
            />
          </Decision>

          <Decision
            n={2}
            title="One row per patient"
            decision="Reduce each event table to one row per patient before joining it to the cohort."
            why={<>A patient has many A1c results, encounters, prescriptions and procedures. MRN {grainExample.mrn}, for example, has {fmt(grainExample.a1c)} A1c results and {fmt(grainExample.prescriptions)} prescriptions: joined directly, that one patient becomes {fmt(grainExample.a1c * grainExample.prescriptions)} rows before procedures ({fmt(grainExample.procedures)}) are added. Gold reduces each table first - latest A1c, last encounter, count of A1c in two years, active medications - then joins.</>}
            alternative="Join every event table to the cohort and aggregate at the end."
            risk="Row multiplication: counts, rates and ranks inflated by however many events a patient happens to have. Gold asserts one row per patient on every run (V4.1)."
          >
            <Code>{`cohort  ─┬─ LEFT JOIN latest_a1c    (1 row per patient)
         ├─ LEFT JOIN a1c_2y        (1 row per patient)
         ├─ LEFT JOIN first_dx      (1 row per patient)
         ├─ LEFT JOIN last_enc      (1 row per patient)
         └─ LEFT JOIN active_meds   (1 row per patient)`}</Code>
          </Decision>

          <Decision
            n={3}
            title="Select the latest A1c as a whole row"
            decision="Rank each patient's results by time and keep the first, so the date and value come from the same result."
            why={<>The real Gold query keeps the latest numeric result on or before the data date with a window function. The audit found {AUDIT.silverLatestA1cTies} patients with two results at the same latest time, so the choice is never arbitrary.</>}
            alternative="MAX(observed_at) with the value fetched separately, or MAX of each column independently."
            risk="A date from one result paired with the value of another - MAX(value) is the highest A1c ever, not the latest."
            doc={{ href: `${REPO}/src/caregap/sql/gold/care_gap_a1c.sql`, label: "The Gold SQL" }}
          >
            <Code>{`latest_a1c AS (
    SELECT patient_id, observed_at::DATE AS last_a1c_date, value AS last_a1c_value
    FROM a1c QUALIFY row_number() OVER (PARTITION BY patient_id ORDER BY observed_at DESC) = 1
)`}</Code>
          </Decision>

          <Decision
            n={4}
            title="Use a fixed data date, not today"
            decision={`Measure every window from ${longDate(gold.asof)}, the day the source data ends.`}
            why="The source stops at a known date. Measured from the calendar instead, the same data would produce more gaps every day simply because time passed. A fixed reporting date makes the result reproducible."
            alternative="CURRENT_DATE."
            risk="Identical data giving different answers on different days; within a year, every patient would be a gap."
            doc={{ href: `${REPO}/docs/decisions/0007-fixed-as-of-date.md`, label: "ADR 0007: fixed as-of date" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full max-w-xl text-sm">
                <caption className="pb-2 text-left text-xs text-muted-foreground">Open gaps if the data date moved forward and the data stayed the same, computed from the patient rows with the Gold rule.</caption>
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th scope="col" className="py-1.5 pr-4 font-medium">Data date</th><th scope="col" className="py-1.5 pr-4 text-right font-medium">Open gaps</th><th scope="col" className="py-1.5 text-right font-medium">Of cohort</th></tr></thead>
                <tbody>
                  {drift.map((d) => (
                    <tr key={d.months} className="border-b last:border-0">
                      <th scope="row" className="py-1.5 pr-4 text-left font-normal">{d.months === 0 ? `${longDate(d.date)} (fixed)` : `+${d.months} ${d.months === 1 ? "month" : "months"} · ${longDate(d.date)}`}</th>
                      <td className="num py-1.5 pr-4 text-right font-medium">{d.gaps}</td>
                      <td className="num py-1.5 text-right text-muted-foreground">{fmt(gold.cohort)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Decision>

          <Decision
            n={5}
            title="Calibrate the A1c plausibility rule to the data"
            decision={`Set the lower plausibility bound at ${dq.a1c_range[0].toFixed(1)}%, not 3.0%, after measuring what each would reject.`}
            why={<>In the untouched source, {fmt(AUDIT.rawA1cTotal)} A1c results: a 3.0% floor would have rejected {fmt(gold.a1c_clean_below_3)} of them and passed {fmt(AUDIT.rawA1cPassingOldFloor)}. Those {fmt(gold.a1c_clean_below_3)} were not errors - they are how the synthetic generator writes A1c - so the floor moved to {dq.a1c_range[0].toFixed(1)}%, and the range became {dq.a1c_range[0].toFixed(1)}–{dq.a1c_range[1].toFixed(1)}%.</>}
            alternative="A floor chosen from clinical intuition."
            risk="Quarantining about one result in nine as 'implausible' and quietly turning tested patients into never-tested gaps."
            doc={{ href: `${REPO}/docs/reference/data-quality.md`, label: "Data quality reference" }}
          >
            <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              A plausibility check decides whether a value could be a real measurement. It is a data-quality rule, not a clinical target, and says nothing about whether a result is good or bad for a patient.
            </p>
          </Decision>
        </div>
      </Section>

      {/* 7 ----------------------------------------------------------- layers */}
      <Section id="layers" title="Source, derived and workflow data" blurb="Three kinds of information, kept apart on every page.">
        <DataLayers />
        <p className="text-sm text-muted-foreground">
          Workflow data is not part of the clinical source. Changing a task&apos;s status never changes a patient&apos;s A1c gap status.
        </p>
      </Section>

      {/* 8 ---------------------------------------------------- reproducibility */}
      <Section id="reproducibility" title="Reproducibility" blurb="What anyone needs to rebuild the measure and get the same answer.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border bg-card p-4 text-sm">
            <dt className="text-muted-foreground">Data date</dt><dd>{longDate(gold.asof)}</dd>
            <dt className="text-muted-foreground">Lookback</dt><dd>{gold.gap_days} days</dd>
            <dt className="text-muted-foreground">Population</dt><dd>Diabetes cohort, alive on the data date ({gold.cohort})</dd>
            <dt className="text-muted-foreground">Final grain</dt><dd>One row per patient</dd>
            <dt className="text-muted-foreground">Primary measure</dt><dd>A1c monitoring status</dd>
            <dt className="text-muted-foreground">Statuses</dt><dd>Current, Overdue, Never tested</dd>
            <dt className="text-muted-foreground">Source data</dt><dd>Synthea, pinned seed</dd>
          </dl>
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Reproducibility checklist">
              {REPRO.map((r) => (
                <li key={r.label} className="flex items-center gap-2 text-sm">
                  <CircleCheck className={r.ok ? "size-4 text-status-success" : "size-4 text-muted-foreground"} aria-hidden />
                  {r.label}
                  <span className="sr-only">{r.ok ? ": met" : ": not met"}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Documentation</span>
              {[
                { href: `${REPO}/docs/decisions/0006-gap-definition.md`, label: "Measure definition (ADR 0006)" },
                { href: `${REPO}/docs/decisions/0005-cohort-definition.md`, label: "Cohort definition (ADR 0005)" },
                { href: `${REPO}/docs/reference/data-dictionary.md`, label: "Data dictionary" },
                { href: `${REPO}/docs/reference/data-quality.md`, label: "Data quality reference" },
              ].map((d) => (
                <a key={d.href} href={d.href} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 font-medium text-primary hover:underline">
                  {d.label} <ArrowRight className="size-3" aria-hidden />
                </a>
              ))}
            </div>
          </div>
        </div>
        <details className="rounded-xl border bg-card">
          <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            The full pipeline, section by section
          </summary>
          <ul className="flex flex-col divide-y border-t">
            {PIPELINE_SECTIONS.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
                  <span className="flex flex-col gap-0.5"><span className="text-sm font-medium">{p.label}</span><span className="text-sm text-muted-foreground">{p.about}</span></span>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </Section>

      {/* 9 ------------------------------------------------------ limitations */}
      <Section id="limitations" title="Data limitations" blurb="What the available data cannot tell you, whatever page you read it on.">
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            { t: "Synthetic data", b: "Every patient is generated by Synthea. Some values, such as A1c results below 3%, are rare in real care and are kept as recorded." },
            { t: "Incomplete history", b: "The available records may not hold a patient's complete history. Never tested means no A1c in this data, not never tested anywhere." },
            { t: "No orders", b: "The source has no orders table. A test that was ordered and missed looks the same as one that was never requested." },
            { t: "Fills are not doses", b: "Medication records carry dispense counts, not doses, and do not show adherence or confirmed use." },
            { t: "Demonstration definitions", b: "The measure follows the HEDIS idea of one A1c a year but is a portfolio definition, not a certified implementation. Results are not clinical recommendations." },
            { t: "Workflow and roles", b: "Task data is saved in the browser only. The pipeline writes role-scoped exports for three roles with a tested access matrix; the web application shows the whole record and does not enforce them." },
          ].map((l) => (
            <li key={l.t} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold">{l.t}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{l.b}</p>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}
