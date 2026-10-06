import { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDown, ArrowRight, CircleCheck, CircleDashed, ChevronDown, Info, TriangleAlert, X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "cn";
import type { Check, CheckSource, CheckStatus } from "@/lib/quality";
import { StatusBadge, StatusTone } from "@/components/shell/StatusBadge";

/**
 * The pieces of the Data & Quality page. Server-rendered; the expandable
 * parts are native <details>, so they work with the keyboard and without
 * JavaScript, and every diagram has its facts written out in text.
 */

const fmt = (n: number) => n.toLocaleString("en-US");

/* ------------------------------------------------------------ lineage */

export type Stage = {
  name: string;
  layer: string;
  figure: string;
  figureLabel: string;
  summary: string;
  details: ReactNode;
  links?: { href: string; label: string }[];
};

/** The journey from source to application, as connected stages: a row on
 *  wide screens, a column on narrow ones. */
export function PipelineLineage({ stages }: { stages: Stage[] }) {
  return (
    <ol className="grid gap-3 lg:grid-cols-6 lg:gap-0" aria-label="Data pipeline, from source to application">
      {stages.map((s, i) => (
        <li key={s.name} className="flex flex-col items-stretch lg:flex-row">
          <details className="group flex-1 rounded-xl border bg-card open:shadow-xs">
            <summary className="flex h-full cursor-pointer list-none flex-col gap-2 rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.layer}</span>
                <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
              </span>
              <span className="text-sm font-semibold leading-snug">{s.name}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="num text-xl font-semibold tracking-tight">{s.figure}</span>
                <span className="text-xs text-muted-foreground">{s.figureLabel}</span>
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">{s.summary}</span>
            </summary>
            <div className="flex flex-col gap-2 border-t px-4 py-3 text-xs leading-relaxed text-foreground/85">
              {s.details}
              {s.links && (
                <span className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                  {s.links.map((l) => (
                    <Link key={l.href} href={l.href} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                      {l.label} <ArrowRight className="size-3" aria-hidden />
                    </Link>
                  ))}
                </span>
              )}
            </div>
          </details>
          {i < stages.length - 1 && (
            <span className="flex items-center justify-center py-1 text-muted-foreground lg:w-4 lg:py-0" aria-hidden>
              <ArrowDown className="size-4 lg:hidden" />
              <ArrowRight className="hidden size-3.5 lg:block" />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------ reconciliation */

function Term({ n, label, tone }: { n: number; label: string; tone?: "success" | "danger" | "muted" }) {
  return (
    <div className={cn(
      "flex min-w-24 flex-1 flex-col items-center gap-0.5 rounded-xl border bg-card px-4 py-3 text-center",
      tone === "success" && "border-status-success/30",
      tone === "danger" && "border-status-danger/30",
    )}>
      <span className="num text-3xl font-semibold tracking-tight">{fmt(n)}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

const Op = ({ children, label }: { children: string; label: string }) => (
  <span className="flex items-center justify-center px-1 text-2xl font-light text-muted-foreground" aria-label={label}>{children}</span>
);

/** One equation, written as large terms with its result. */
export function Equation({
  left, parts, ok, sentence,
}: {
  left: { n: number; label: string; tone?: "success" | "danger" | "muted" };
  parts: { n: number; label: string; tone?: "success" | "danger" | "muted"; share?: string }[];
  ok: boolean;
  sentence: string;
}) {
  return (
    <figure className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center" aria-hidden>
        <Term {...left} />
        <Op label="equals">=</Op>
        {parts.map((p, i) => (
          <div key={p.label} className="contents">
            {i > 0 && <Op label="plus">+</Op>}
            <Term {...p} />
          </div>
        ))}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">{sentence}</span>
        <StatusBadge tone={ok ? "success" : "danger"} icon={ok ? CircleCheck : X} label={ok ? "PASS" : "FAIL"} />
      </figcaption>
    </figure>
  );
}

/* --------------------------------------------------------------- checks */

const STATUS: Record<CheckStatus, { tone: StatusTone; label: string; icon: LucideIcon }> = {
  passed: { tone: "success", label: "Passed", icon: CircleCheck },
  warning: { tone: "warning", label: "Warning", icon: TriangleAlert },
  info: { tone: "info", label: "Informational", icon: Info },
  "not-evaluated": { tone: "neutral", label: "Not evaluated", icon: CircleDashed },
};

const SOURCE: Record<CheckSource, string> = {
  live: "Live: recomputed from the patient data",
  pipeline: "Pipeline: from the run's own report",
  audit: "Audit: one-time warehouse query",
};

export function CheckStatusBadge({ status }: { status: CheckStatus }) {
  const s = STATUS[status];
  return <StatusBadge tone={s.tone} icon={s.icon} label={s.label} />;
}

export function SummaryCard({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <li className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="num text-2xl font-semibold tracking-tight">{value}</span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </li>
  );
}

/** Checks grouped by area; each row expands to why it matters and its evidence. */
export function CheckList({ checks }: { checks: Check[] }) {
  const areas = [...new Set(checks.map((c) => c.area))];
  return (
    <div className="flex flex-col gap-5">
      {areas.map((area) => (
        <section key={area} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{area}</h3>
          <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
            {checks.filter((c) => c.area === area).map((c) => (
              <li key={c.id}>
                <details className="group">
                  <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_8.5rem_1rem] sm:items-center sm:gap-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.scope}</span>
                    </span>
                    <span className="text-sm">{c.result}</span>
                    <CheckStatusBadge status={c.status} />
                    <ChevronDown className="hidden size-4 text-muted-foreground transition-transform group-open:rotate-180 sm:block" aria-hidden />
                  </summary>
                  <div className="flex flex-col gap-1.5 border-t bg-muted/20 px-4 py-3 text-sm">
                    <p><span className="font-medium">Why it matters. </span><span className="text-muted-foreground">{c.why}</span></p>
                    {c.evidence && <p className="text-muted-foreground"><span className="font-medium text-foreground">Evidence. </span>{c.evidence}</p>}
                    <p className="text-xs text-muted-foreground">{c.id} · {SOURCE[c.source]}</p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ decisions */

export function Decision({
  n, title, decision, why, alternative, risk, children, open = false, doc, layout = "stacked",
}: {
  n: number; title: string; decision: string; why: ReactNode; alternative: string; risk: string;
  children?: ReactNode; open?: boolean; doc?: { href: string; label: string };
  /** "split": the visual on the left, the reasoning on the right, read as one
   *  case study on wide screens and stacked (visual first) on narrow ones. */
  layout?: "stacked" | "split";
}) {
  const split = layout === "split";
  const reasoning = (
    <>
      <dl className={cn("grid gap-3 text-sm", split ? "gap-4" : "md:grid-cols-3")}>
        <div className="flex flex-col gap-1"><dt className="text-xs font-medium text-muted-foreground">Why</dt><dd>{why}</dd></div>
        <div className="flex flex-col gap-1"><dt className="text-xs font-medium text-muted-foreground">Alternative</dt><dd>{alternative}</dd></div>
        <div className="flex flex-col gap-1"><dt className="text-xs font-medium text-muted-foreground">Risk avoided</dt><dd>{risk}</dd></div>
      </dl>
      {doc && (
        <a href={doc.href} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline">
          {doc.label} <ArrowRight className="size-3" aria-hidden />
        </a>
      )}
    </>
  );
  return (
    <details open={open} className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-ring sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className="num flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground" aria-hidden>{n}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-sm text-muted-foreground">{decision}</span>
        </span>
        <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      {split ? (
        <div className="grid gap-5 border-t p-4 sm:p-5 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:items-center lg:gap-8">
          <div className="min-w-0">{children}</div>
          <div className="flex min-w-0 flex-col gap-4">{reasoning}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 border-t p-4 sm:p-5">
          {children}
          {reasoning}
        </div>
      )}
    </details>
  );
}

function JoinBar({ total, kept, dropped }: { total: number; kept: number; dropped: number }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="bg-chart-1" style={{ width: `${(kept / total) * 100}%` }} />
      {dropped > 0 && <div className="bg-status-danger/70" style={{ width: `${(dropped / total) * 100}%` }} />}
    </div>
  );
}

/** LEFT JOIN against INNER JOIN, as two outcomes side by side. */
export function JoinComparison({ cohort, withResult }: { cohort: number; withResult: number }) {
  const lost = cohort - withResult;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="flex flex-col gap-2 rounded-xl border-2 border-status-success/30 p-4">
        <span className="font-mono text-xs font-semibold">LEFT JOIN</span>
        <span className="num text-2xl font-semibold">{cohort} <span className="text-sm font-normal text-muted-foreground">patients retained</span></span>
        <JoinBar total={cohort} kept={withResult} dropped={lost} />
        <span className="flex items-center gap-1.5 text-sm text-status-success"><CircleCheck className="size-4" aria-hidden />{lost} never-tested patients preserved</span>
      </div>
      <div className="flex flex-col gap-2 rounded-xl border-2 border-status-danger/30 p-4">
        <span className="font-mono text-xs font-semibold">INNER JOIN</span>
        <span className="num text-2xl font-semibold">{withResult} <span className="text-sm font-normal text-muted-foreground">patients retained</span></span>
        <JoinBar total={cohort} kept={withResult} dropped={0} />
        <span className="flex items-center gap-1.5 text-sm text-status-danger"><X className="size-4" aria-hidden />{lost} never-tested patients lost, without an error</span>
      </div>
    </div>
  );
}

export function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed"><code>{children}</code></pre>;
}
