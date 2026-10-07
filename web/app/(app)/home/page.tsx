import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, GraduationCap, Sparkles, Users } from "lucide-react";

import { gold, patients } from "@/lib/data";
import { cohortSummary, monitoringByAgeBand, needingAttention, pctText } from "@/lib/cohort";
import { Page, Section } from "@/components/shell/Page";
import { MetricCard } from "@/components/MetricCard";
import { AttentionList } from "./AttentionList";
import { GapsByAgeBand, MonitoringStatus } from "./PopulationMonitoring";

export const metadata = { title: "Home" };

/**
 * The care team's starting point: how the population is doing, who needs
 * attention first, and where to go next.
 *
 * Every figure is derived from the exported rows by lib/cohort.ts, and a test
 * holds those derivations equal to the pipeline's own gold report. Nothing is
 * shown that the data does not record: there are no orders, outreach or task
 * events in it, so there are no metrics about them here.
 */
const summary = cohortSummary(patients, gold.asof);
const attention = needingAttention(patients, 5);
const bands = monitoringByAgeBand(patients);

const NEXT = [
  { href: "/patients", label: "Patients", about: "The full cohort, every column, with filters.", icon: Users },
  { href: "/analytics", label: "Analytics", about: "Gap rates by age band and care setting.", icon: ChartNoAxesCombined },
  { href: "/ask", label: "Ask AI", about: "Ask questions of the cohort data.", icon: Sparkles },
  { href: "/learn/care-teams#how-it-works", label: "How it works", about: "The care-gap workflow, step by step.", icon: GraduationCap },
];

const linkClass =
  "inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default function HomePage() {
  const s = summary;
  return (
    <Page
      title="Home"
      description="Here's where your diabetes population needs attention."
      width="wide"
    >
      <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total cohort"
          value={s.total.toLocaleString("en-US")}
          caption="Patients with diabetes in the report"
          hint="Every patient with a diabetes diagnosis on record who was alive on the data date. Records that failed data-quality checks are held back and never counted here."
          href="/patients"
          hrefLabel="View patients"
        />
        <MetricCard
          label="Open A1C gaps"
          value={s.openGaps.toLocaleString("en-US")}
          status={{ tone: s.openGaps ? "danger" : "success", label: s.openGaps ? "Needs attention" : "None open" }}
          context={`${pctText(s.openGaps, s.total)} of the cohort`}
          caption="No A1C in the last 12 months"
          hint="Patients with no A1C result in the twelve months before the data date. Includes those who have never been tested."
          href="/care-gaps"
          hrefLabel="View care gaps"
        />
        <MetricCard
          label="Never tested"
          value={s.neverTested.toLocaleString("en-US")}
          context={`${s.neverTested} of ${s.openGaps} open gaps`}
          caption="No A1C result on record at all"
          hint="Open gaps with no A1C in the record at any time. Part of the open-gap count, not in addition to it."
          href={s.neverTested ? "/care-gaps?status=never" : undefined}
          hrefLabel={`Review ${s.neverTested} ${s.neverTested === 1 ? "patient" : "patients"}`}
        />
        <MetricCard
          label="Current"
          value={s.current.toLocaleString("en-US")}
          status={{ tone: "success", label: "Up to date" }}
          context={`${s.dueWithin90} due again within 90 days`}
          caption="A1C within the last 12 months"
          hint="Patients whose most recent A1C is within twelve months of the data date. Due within 90 days counts those whose next test falls due in the next three months."
        />
      </section>

      <Section
        title="Patients needing attention"
        blurb={
          attention.length
            ? `The first ${attention.length} of ${s.openGaps} open gaps, in the pipeline's priority order: never tested first, then the longest overdue.`
            : undefined
        }
        actions={
          <Link href="/care-gaps" className={linkClass}>
            View all care gaps
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      >
        <AttentionList rows={attention} />
      </Section>

      <Section
        title="Population monitoring"
        blurb="How A1C monitoring stands across the whole cohort."
        actions={
          <Link href="/analytics" className={linkClass}>
            View analytics
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <MonitoringStatus s={s} />
          <GapsByAgeBand bands={bands} />
        </div>
      </Section>

      <Section title="Where to next">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {NEXT.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                className="group flex h-full items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <n.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium group-hover:underline">{n.label}</span>
                  <span className="text-xs text-muted-foreground">{n.about}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}
