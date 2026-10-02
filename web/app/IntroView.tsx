"use client";

import Link from "next/link";
import { ArrowRight, GitBranch, FlaskConical, ShieldCheck } from "lucide-react";

import { gold, dq, layerTotals, fmt } from "@/lib/data";
import { Page } from "@/components/shell/Page";
import { Term } from "@/components/Term";
import { ConceptsTab } from "./ConceptsTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function IntroView() {
  return (
    <Page title="Introduction" blurb="What this is, and why the middle part matters">
      <Tabs defaultValue="project">
        <TabsList>
          <TabsTrigger value="project">The project</TabsTrigger>
          <TabsTrigger value="concepts">Clinical concepts</TabsTrigger>
          <TabsTrigger value="limits">What it cannot tell you</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------- the project */}
        <TabsContent value="project" className="flex flex-col gap-8 pt-2">
          <div className="flex flex-col gap-5">
            <Badge variant="secondary" className="w-fit">
              Synthea · Massachusetts · as of {gold.asof}
            </Badge>
            <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Which diabetic patients have not had an A1c test in the last twelve months?
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
              An <Term k="a1c">A1c</Term> measures average blood sugar over about three
              months. A diabetic patient is meant to have one roughly every six months.
              When twelve months pass with no result, that is a{" "}
              <Term k="care gap">care gap</Term>, and this project finds them.
            </p>
            <p className="text-sm text-muted-foreground">
              New to clinical data? The{" "}
              <strong className="text-foreground">Clinical concepts</strong> tab above
              explains every term, and any term with a dotted underline will define
              itself wherever you meet it.
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

          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">
                Why it is really a data quality project
              </h3>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                A care-gap list gets handed to a nurse who picks up a phone, so a wrong
                list costs something in both directions.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-sm">A false positive</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  A wasted call to someone who already had the test. Their result was
                  filed under a duplicate record, or with a broken link back to the
                  patient.
                </CardContent>
              </Card>
              <Card className="border-destructive/40">
                <CardHeader><CardTitle className="text-sm">A false negative</CardTitle></CardHeader>
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
              caught, and only then report the gaps.
            </p>
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold tracking-tight">What was found</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: FlaskConical,
                  stat: `${gold.open_gaps} of ${gold.cohort}`,
                  label: "have an open A1c gap",
                  note: `${gold.gap_rate_pct}% of the diabetic cohort alive on the as-of date`,
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
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold tracking-tight">How the data gets here</h3>
            <Card>
              <CardContent className="grid gap-px overflow-hidden rounded-lg bg-border p-0 sm:grid-cols-3">
                {[
                  ["bronze", "Bronze", fmt(layerTotals.bronze), "Raw CSVs, every column text, nothing cleaned"],
                  ["silver", "Silver", fmt(layerTotals.silver), "Typed and validated; rejects quarantined with a reason"],
                  ["gold", "Gold", String(gold.cohort), "One row per diabetic patient. This is the care-gap list"],
                ].map(([key, layer, rows, what]) => (
                  <div key={layer} className="flex flex-col gap-1 bg-card p-5">
                    <div className="text-xs font-medium uppercase tracking-wider text-primary">
                      <Term k={key}>{layer}</Term>
                    </div>
                    <div className="num text-xl font-semibold">{rows}</div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{what}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        {/* ------------------------------------------------- clinical concepts */}
        <TabsContent value="concepts" className="pt-2">
          <ConceptsTab />
        </TabsContent>

        {/* ------------------------------------------------------- the limits */}
        <TabsContent value="limits" className="flex flex-col gap-4 pt-2">
          <p className="max-w-3xl text-sm text-muted-foreground">
            Stated here rather than left for a reader to discover.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Synthea patients are fictional", "Their care is more diligent than a real population's, so the gap rate here is not a claim about any real clinic."],
              ["There is no orders table", "A clinician can order an A1c and the patient simply never goes for the test. That patient looks exactly the same here as one nobody ever ordered a test for, because this data only records results, never requests. In a real clinic they are two different problems: the first needs someone to call the patient, the second needs someone to ask the clinician why no test was ordered."],
              ["No phone, no email", "Whether a patient can actually be reached has no answer here. The date they were last seen is the honest proxy."],
              ["Nobody is lost to follow-up", "Zero of 116. These synthetic patients never disappear, so the column was dropped rather than shipped always false."],
              ["The defects are the ones injected", "The catch rate measures the checks against a known list, not against reality. Real data fails in ways nobody wrote a rule for."],
              ["Not a certified quality measure", "This implements the idea of the HEDIS diabetes measure, not the specification. The real one has enrolment requirements, exclusion criteria and hospice carve-outs that this does not."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-lg border p-4">
                <div className="text-sm font-medium">{t}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
