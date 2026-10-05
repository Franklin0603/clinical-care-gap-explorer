import Link from "next/link";
import { ArrowRight, BarChart3, Building2, Layers, ShieldCheck, Users } from "lucide-react";

import { fmt, gold, patients } from "@/lib/data";
import {
  GroupRow, cohortSummary, daysOverdue, gapsSeenWithin, latestA1cDistribution, monitoringByAgeBand,
  monitoringBySetting, pctText, settingLabel,
} from "@/lib/cohort";
import { cn } from "cn";
import { Page } from "@/components/shell/Page";
import { ChartCard, headerLink } from "@/components/analytics/ChartCard";
import { A1cDistribution } from "@/components/analytics/A1cDistribution";
import { Donut } from "@/components/analytics/Donut";
import { GapRateBars } from "@/components/analytics/GapRateBars";
import { GapRateColumns } from "@/components/analytics/GapRateColumns";
import { FILL } from "@/components/analytics/chartBits";
import { TestingOverTime } from "@/components/analytics/TestingOverTime";

export const metadata = { title: "Analytics" };

/**
 * How A1c monitoring is performing across the cohort: coverage, what the gaps
 * are made of, where they sit, and what the testing history shows.
 *
 * Every figure is a lib/cohort.ts derivation over the same rows Home, Care
 * Gaps and Patients read, and the tests hold them to the pipeline's own gold
 * report - so this page cannot disagree with the others. It reports the data;
 * it does not grade it. No targets, no benchmarks, no control rates, and no
 * use of the 7% reference line: this is about whether A1c is being monitored,
 * not about what the results say. Every sentence of interpretation is
 * computed; none says why a pattern exists.
 *
 * Layout follows a dashboard grid: compact figures, then the testing history
 * as the primary chart with the two composition cards beside it, then the two
 * breakdowns side by side.
 */

const s = cohortSummary(patients, gold.asof);
const byAge = monitoringByAgeBand(patients);
const bySetting = monitoringBySetting(patients);
const recentlySeen = gapsSeenWithin(patients, gold.asof, 6);
const overdueDays = patients.map(daysOverdue).filter((d): d is number => d !== null);
const longest = overdueDays.length ? Math.max(...overdueDays) : null;

/** Small groups are listed but never headlined: a 1-of-1 setting at 100% is
 *  not where gaps are concentrated. */
const SMALL = 10;
const highest = (rows: GroupRow[]) =>
  [...rows].filter((r) => r.total >= SMALL).sort((a, b) => b.gapRate - a.gapRate || b.total - a.total)[0];
const topAge = highest(byAge);
const topSetting = highest(bySetting);
const smallSettings = bySetting.filter((r) => r.total > 0 && r.total < SMALL);
const smallAges = byAge.filter((r) => r.total > 0 && r.total < SMALL);
const settingLabels = Object.fromEntries(bySetting.map((r) => [r.key, settingLabel(r.key)]));
const dist = latestA1cDistribution(patients);

function Kpi({ label, value, context, tone }: {
  label: string; value: string; context?: string; tone?: "success" | "danger";
}) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3.5 shadow-xs">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="num text-2xl font-semibold tracking-tight">{value}</span>
        {context && (
          <span
            className={cn(
              "num rounded-md border px-1.5 py-0.5 text-xs",
              tone === "success" && "border-status-success/30 bg-status-success/10 text-status-success",
              tone === "danger" && "border-status-danger/30 bg-status-danger/10 text-status-danger",
              !tone && "bg-muted text-muted-foreground",
            )}
          >
            {context}
          </span>
        )}
      </div>
    </li>
  );
}

export default function AnalyticsPage() {
  return (
    <Page
      title="Analytics"
      description="Understand A1c monitoring across the diabetes population."
      width="wide"
    >
      <div className="flex flex-col gap-4">
        <ul aria-label="Summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi label="Total cohort" value={fmt(s.total)} context="patients" />
          <Kpi label="Current" value={fmt(s.current)} context={`${pctText(s.current, s.total)} of cohort`} tone="success" />
          <Kpi label="Open A1c gaps" value={fmt(s.openGaps)} context={`${pctText(s.openGaps, s.total)} of cohort`} tone="danger" />
          <Kpi label="Never tested among gaps" value={fmt(s.neverTested)} context={`${pctText(s.neverTested, s.openGaps)} of gaps`} />
        </ul>

        {/* Primary chart with the two composition cards beside it. */}
        <div className="grid gap-4 lg:grid-cols-3">
          <TestingOverTime className="lg:col-span-2" />

          <div className="flex flex-col gap-4">
            <ChartCard
              icon={ShieldCheck}
              title="Monitoring coverage"
              action={<Link href="/care-gaps" className={headerLink}>Care gaps <ArrowRight className="size-3" aria-hidden /></Link>}
              metric={<>{pctText(s.current, s.total)} <span className="text-sm font-normal text-muted-foreground">current</span></>}
              insight={`${fmt(s.openGaps)} of ${fmt(s.total)} patients have no A1c result in the 365 days before the data date.`}
            >
              <Donut
                total={s.total}
                of={`${fmt(s.total)} patients`}
                center={pctText(s.current, s.total)}
                centerLabel="Current"
                parts={[
                  { key: "current", label: "Current", about: "A1c result within 365 days", n: s.current,
                    fill: FILL.current, href: "/patients?status=current" },
                  { key: "gap", label: "Open gap", about: "No A1c result within 365 days", n: s.openGaps,
                    fill: FILL.gap, href: "/care-gaps" },
                ]}
              />
            </ChartCard>

            <ChartCard
              icon={Layers}
              title="Open gap composition"
              metric={<>{pctText(s.neverTested, s.openGaps)} <span className="text-sm font-normal text-muted-foreground">never tested</span></>}
              insight={`${fmt(s.neverTested)} of ${fmt(s.openGaps)} open gaps have no A1c result in the available data.`}
              note={
                <>
                  {fmt(recentlySeen)} of {fmt(s.openGaps)} had an encounter in the last six months.
                  {longest !== null && <> Longest overdue: {fmt(longest)} days.</>}
                </>
              }
            >
              <Donut
                total={s.openGaps}
                of={`${fmt(s.openGaps)} open gaps`}
                ofNote={`not ${fmt(s.total)} patients`}
                center={fmt(s.openGaps)}
                centerLabel="Open gaps"
                parts={[
                  { key: "never", label: "Never tested", about: "No A1c result found in the available data", n: s.neverTested,
                    fill: FILL.gap, href: "/care-gaps?status=never" },
                  { key: "overdue", label: "Overdue", about: "An earlier result, more than 365 days old", n: s.gapPreviouslyTested,
                    fill: FILL.gap, opacity: 0.5, href: "/care-gaps?status=overdue" },
                ]}
              />
            </ChartCard>
          </div>
        </div>

        {/* Where gaps sit. Descriptive only; said once, in each card's note. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            icon={Users}
            title="Gap rate by age band"
            action={<Link href="/patients?status=gap" className={headerLink}>Patients <ArrowRight className="size-3" aria-hidden /></Link>}
            metric={topAge ? <>{pctText(topAge.gaps, topAge.total)} <span className="text-sm font-normal text-muted-foreground">age {topAge.key}</span></> : "—"}
            insight={topAge ? `Highest rate: ${fmt(topAge.gaps)} of ${fmt(topAge.total)} patients aged ${topAge.key} have an open gap.` : undefined}
            note={
              <>
                Bands follow the measure&apos;s age boundaries. Descriptive only: a difference between bands
                does not show its cause.
                {smallAges.length > 0 && <> * Under {SMALL} patients: {smallAges.map((r) => r.key).join(", ")}.</>}
              </>
            }
          >
            <GapRateColumns rows={byAge} small={SMALL} linkParam="age" />
          </ChartCard>

          <ChartCard
            icon={Building2}
            title="Gap rate by care setting"
            action={<Link href="/patients?status=gap" className={headerLink}>Patients <ArrowRight className="size-3" aria-hidden /></Link>}
            metric={topSetting ? <>{pctText(topSetting.gaps, topSetting.total)} <span className="text-sm font-normal text-muted-foreground">{settingLabel(topSetting.key).toLowerCase()}</span></> : "—"}
            insight={topSetting
              ? `Highest rate among settings with ${SMALL}+ patients: ${fmt(topSetting.gaps)} of ${fmt(topSetting.total)} in ${settingLabel(topSetting.key)}.`
              : undefined}
            note={
              <>
                Setting of each patient&apos;s last encounter, largest group first. Descriptive only.
                {smallSettings.length > 0 && <> * Under {SMALL} patients: {smallSettings.map((r) => settingLabel(r.key)).join(", ")}.</>}
              </>
            }
          >
            <GapRateBars rows={bySetting} labels={settingLabels} small={SMALL} linkParam="setting" />
          </ChartCard>
        </div>

        <ChartCard
          icon={BarChart3}
          title="Latest A1c result distribution"
          metric={<>{fmt(dist.withResult)} <span className="text-sm font-normal text-muted-foreground">patients with a recorded A1c</span></>}
          insight={`No A1c result available: ${fmt(dist.without)} patients, not shown in the chart.`}
          note={
            <>
              Each patient&apos;s most recent result, whenever it was taken, including results more than
              a year old. Equal one-point ranges, not clinical categories; individual A1c goals differ.
              Values below 3% come from the synthetic records and are shown as recorded.
            </>
          }
        >
          {dist.bins.length
            ? <A1cDistribution bins={dist.bins} withResult={dist.withResult} />
            : <p className="py-10 text-center text-sm text-muted-foreground">No data available for this view.</p>}
        </ChartCard>

        <p className="text-xs text-muted-foreground">
          The earlier <Link href="/overview" className="font-medium text-primary hover:underline">Overview</Link> is
          still available, including how the open-gap count would grow as the reporting date moves forward.
        </p>
      </div>
    </Page>
  );
}
