import Link from "next/link";
import { ArrowRight, GitBranch, FlaskConical, ShieldCheck } from "lucide-react";

import { gold, dq, layerTotals, fmt } from "@/lib/data";
import { Page, Section } from "@/components/shell/Page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Introduction() {
  return (
    <Page title="Introduction" blurb="What this is, and why the middle part matters">
      <div className="flex flex-col gap-5">
        <Badge variant="secondary" className="w-fit">Synthea · Massachusetts · as of {gold.asof}</Badge>
        <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Which diabetic patients have not had an A1c test in the last twelve months?
        </h2>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          An <strong className="text-foreground">A1c</strong> measures average blood
          sugar over about three months. A diabetic patient is meant to have one
          roughly every six months. When twelve months pass with no result, that is
          a <strong className="text-foreground">care gap</strong> — and this finds them.
        </p>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          The query is four lines of SQL. The project is not about the query.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/overview" />}>
            See the numbers <ArrowRight className="size-4" />
          </Button>
          <Button variant="outline" render={<Link href="/pipeline" />}>
            How the data gets there
          </Button>
        </div>
      </div>

      <Section
        title="Why it is really a data quality project"
        blurb="A care-gap list gets handed to a nurse who picks up a phone, so a wrong list costs something in both directions."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">A false positive</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              A wasted call to someone who already had the test — their result was
              filed under a duplicate record, or with a broken link back to the
              patient.
            </CardContent>
          </Card>
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-sm">A false negative</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Worse. The patient stays invisible, and everybody trusts the report
              that hid them.
            </CardContent>
          </Card>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Real clinical data arrives with duplicate rows, lab values in the wrong
          units, patients registered twice under different record numbers, and
          timestamps that contradict each other. So the build order is: load it,
          deliberately break it, catch the breakage, measure what fraction was
          caught — and only then report the gaps.
        </p>
      </Section>

      <Section title="What was found" blurb="Three numbers that between them describe the whole project.">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: FlaskConical,
              stat: `${gold.open_gaps} of ${gold.cohort}`,
              label: "have an open A1c gap",
              note: `${gold.gap_rate_pct}% of diabetic patients alive on the as-of date`,
            },
            {
              icon: GitBranch,
              stat: String(gold.never_tested),
              label: "have never been tested",
              note: "Three separate ordinary mistakes would each have hidden exactly these people",
              accent: true,
            },
            {
              icon: ShieldCheck,
              stat: dq.catch_rate_types,
              label: "defect types caught",
              note: `${dq.catch_rate_rows} injected rows, each by the check meant for it`,
            },
          ].map(({ icon: Icon, stat, label, note, accent }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <Icon className={`size-4 ${accent ? "text-destructive" : "text-primary"}`} />
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <div className={`num text-3xl font-semibold tracking-tight ${accent ? "text-destructive" : ""}`}>
                  {stat}
                </div>
                <div className="text-sm font-medium">{label}</div>
                <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="How the data gets here">
        <Card>
          <CardContent className="grid gap-px overflow-hidden rounded-lg bg-border p-0 sm:grid-cols-3">
            {[
              ["Bronze", fmt(layerTotals.bronze), "Raw CSVs, every column text, nothing cleaned"],
              ["Silver", fmt(layerTotals.silver), "Typed and validated; rejects quarantined with a reason"],
              ["Gold", String(gold.cohort), "One row per diabetic patient — the care-gap list"],
            ].map(([layer, rows, what]) => (
              <div key={layer} className="flex flex-col gap-1 bg-card p-5">
                <div className="text-xs font-medium uppercase tracking-wider text-primary">{layer}</div>
                <div className="num text-xl font-semibold">{rows}</div>
                <p className="text-xs leading-relaxed text-muted-foreground">{what}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </Section>

      <Section title="What this cannot tell you" blurb="Stated here rather than discovered later.">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Synthea patients are fictional", "Their care is more diligent than a real population's."],
            ["There is no orders table", "“We ordered it and the patient never went” is indistinguishable from “we never ordered it”."],
            ["No phone, no email", "Whether a patient can actually be reached has no answer here."],
            ["The defects are the ones injected", "The catch rate measures the checks against a known list, not against reality."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border p-4">
              <div className="text-sm font-medium">{t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </Section>
    </Page>
  );
}
