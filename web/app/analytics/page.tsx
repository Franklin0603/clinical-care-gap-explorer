import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { fmt, gold, patients } from "@/lib/data";
import {
  cohortSummary, daysOverdue, gapsSeenWithin, monitoringByAgeBand, monitoringBySetting,
  pctText, settingLabel,
} from "@/lib/cohort";
import { Page, Section } from "@/components/shell/Page";
import { ProportionBar } from "@/components/analytics/ProportionBar";
import { RateBars } from "@/components/analytics/RateBars";
import { TestingOverTime } from "@/components/analytics/TestingOverTime";

export const metadata = { title: "Analytics" };

/**
 * How A1c monitoring is performing across the cohort, in four questions:
 * coverage, what the gaps are made of, where they sit, and what the testing
 * history shows.
 *
 * Every figure is a lib/cohort.ts derivation over the same rows Home, Care
 * Gaps and Patients read, and the tests hold them to the pipeline's own gold
 * report - so this page cannot disagree with the others. It reports the data;
 * it does not grade it. No targets, no benchmarks, no control rates, and no
 * use of the 7% reference line: this is about whether A1c is being monitored,
 * not about what the results say.
 *
 * Every sentence of interpretation is computed from the same numbers. None is
 * written by hand, and none says why a pattern exists.
 */

const s = cohortSummary(patients, gold.asof);
const byAge = monitoringByAgeBand(patients);
const bySetting = monitoringBySetting(patients);
const recentlySeen = gapsSeenWithin(patients, gold.asof, 6);
const overdueDays = patients.map(daysOverdue).filter((d): d is number => d !== null);
const longest = overdueDays.length ? Math.max(...overdueDays) : null;

const linkClass =
  "inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function Metric({ label, value, context }: { label: string; value: string; context?: string }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="num text-2xl font-semibold tracking-tight">{value}</span>
      {context && <span className="text-xs text-muted-foreground">{context}</span>}
    </li>
  );
}

function Panel({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm">{summary}</p>
      </div>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const largest = bySetting[0];
  return (
    <Page
      title="Analytics"
      description="Understand A1c monitoring across the diabetes population."
      width="wide"
    >
      <ul aria-label="Summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Total cohort" value={fmt(s.total)} context="Patients in the diabetes cohort" />
        <Metric label="Current" value={fmt(s.current)} context={`${pctText(s.current, s.total)} of cohort`} />
        <Metric label="Open A1c gaps" value={fmt(s.openGaps)} context={`${pctText(s.openGaps, s.total)} of cohort`} />
        <Metric
          label="Never tested among gaps"
          value={fmt(s.neverTested)}
          context={`${pctText(s.neverTested, s.openGaps)} of open gaps`}
        />
      </ul>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-6">
        <Section
          title="A1c monitoring coverage"
          blurb="How the diabetes cohort is distributed between current monitoring and open A1c gaps."
        >
          <Panel
            title="Current and open gap"
            summary={`${fmt(s.openGaps)} of ${fmt(s.total)} patients (${pctText(s.openGaps, s.total)}) have an open A1c monitoring gap: no A1c result in the 365 days before the data date.`}
          >
            <ProportionBar
              total={s.total}
              parts={[
                { key: "current", label: "Current", about: "A1c result within 365 days", n: s.current, tone: "bg-status-success",
                  href: "/patients?status=current", hrefLabel: "View patients" },
                { key: "gap", label: "Open gap", about: "No A1c result within 365 days", n: s.openGaps, tone: "bg-status-danger",
                  href: "/care-gaps", hrefLabel: "View care gaps" },
              ]}
            />
          </Panel>
        </Section>

        <Section
          title="Open gap composition"
          blurb="What the open-gap population is made of: no result at all, or an earlier result that is now out of date."
        >
          <Panel
            title="Never tested and overdue"
            summary={`${fmt(s.neverTested)} of the ${fmt(s.openGaps)} open gaps (${pctText(s.neverTested, s.openGaps)}) have no A1c result in the available data.`}
          >
            <ProportionBar
              total={s.openGaps}
              parts={[
                { key: "never", label: "Never tested", about: "No A1c result found in the available data", n: s.neverTested,
                  tone: "bg-status-danger", href: "/care-gaps?status=never", hrefLabel: "View never tested" },
                { key: "overdue", label: "Overdue", about: "An earlier result, more than 365 days old", n: s.gapPreviouslyTested,
                  tone: "bg-status-danger/55", href: "/care-gaps?status=overdue", hrefLabel: "View overdue" },
              ]}
            />
            <ul className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
              <li>
                {fmt(recentlySeen)} of the {fmt(s.openGaps)} open gaps had an encounter in the six months
                before the data date.
              </li>
              {longest !== null && (
                <li>The longest overdue result is {fmt(longest)} days past due.</li>
              )}
            </ul>
          </Panel>
        </Section>
      </div>

      <Section
        title="Where are monitoring gaps concentrated?"
        blurb="Open-gap rate across the population groups the data records. Descriptive only: a difference between groups here does not say what causes it."
        actions={<Link href="/care-gaps" className={linkClass}>View care gaps <ArrowRight className="size-3.5" aria-hidden /></Link>}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Gap rate by age band"
            summary={`Bands follow the measure's age boundaries. The highest rate is ${(() => {
              const top = [...byAge].filter((b) => b.total > 0).sort((a, b) => b.gapRate - a.gapRate)[0];
              return top ? `${top.key}, with ${fmt(top.gaps)} open gaps among ${fmt(top.total)} patients` : "not available";
            })()}.`}
          >
            <RateBars
              rows={byAge}
              label={(k) => `Age ${k}`}
              href={(r) => `/patients?status=gap&age=${encodeURIComponent(r.key)}`}
            />
          </Panel>
          <Panel
            title="Gap rate by care setting"
            summary={largest
              ? `Care setting of each patient's last encounter, largest group first. ${settingLabel(largest.key)} has ${fmt(largest.gaps)} open gaps among ${fmt(largest.total)} patients in this dataset.`
              : "No care setting is recorded."}
          >
            <RateBars
              rows={bySetting}
              label={settingLabel}
              href={(r) => `/patients?status=gap&setting=${encodeURIComponent(r.key)}`}
            />
          </Panel>
        </div>
      </Section>

      <Section
        title="A1c testing patterns"
        blurb="How recorded A1c testing changes across the available historical data."
      >
        <TestingOverTime />
      </Section>

      <p className="text-sm text-muted-foreground">
        The earlier <Link href="/overview" className="font-medium text-primary hover:underline">Overview</Link> is
        still available, including how the open-gap count would grow as the reporting date moves forward.
      </p>
    </Page>
  );
}
