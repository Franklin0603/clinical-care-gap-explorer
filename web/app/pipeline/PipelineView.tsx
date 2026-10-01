"use client";

import { useState } from "react";
import {
  CheckCircle2, Database, FlaskConical, ShieldAlert, Users, Wrench, Target,
  ChevronRight,
} from "lucide-react";

import {
  dq, recon, checks, quarantineRows, identityRows, remediationRows, gold,
  layerTotals, fmt,
} from "@/lib/data";
import { Page, Section } from "@/components/shell/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** The five stages, as the sidebar's subtasks list them. */
const STAGES = [
  { id: "ingest", icon: Database, name: "Ingest", sub: "Raw CSVs into Bronze",
    detail: "Every column loaded as text. Nothing cast, deduped or filtered — the only additions are a load timestamp and the source filename.",
    stat: `${fmt(layerTotals.bronze)} rows` },
  { id: "corrupt", icon: FlaskConical, name: "Inject defects", sub: "249 rows damaged on purpose",
    detail: "Six realistic failure modes, each one logged. Without that log a catch rate is a claim rather than a measurement.",
    stat: "249 rows" },
  { id: "validate", icon: ShieldAlert, name: "Validate", sub: "Six checks into Silver",
    detail: "Surviving rows are typed; rejected rows land in quarantine with a reason. Never dropped.",
    stat: `${fmt(layerTotals.silver)} rows` },
  { id: "gold", icon: Target, name: "Gold", sub: "One row per diabetic patient",
    detail: "Sourced from Silver only. If Gold ever read Bronze, the whole validation layer would be decorative.",
    stat: `${gold.cohort} patients` },
];

export default function PipelineView() {
  const [showAll, setShowAll] = useState(false);
  const reasons = [...new Set(quarantineRows.map((r) => r.failure_reason))];
  const quarantined = Object.values(dq.quarantine_by_check as Record<string, number>)
    .reduce((a, b) => a + b, 0);
  const example = remediationRows[0];

  return (
    <Page
      title="Pipeline"
      blurb="Five stages, and the checks between them"
      actions={
        <Badge variant="outline" className="gap-1.5">
          <CheckCircle2 className="size-3.5 text-primary" />
          {dq.catch_rate_types} caught
        </Badge>
      }
    >
      <Section
        id="ingest"
        title="The stages"
        blurb="Each is re-runnable and verifies its own work. A stage that cannot prove what it did raises rather than printing a warning nobody reads."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s, i) => (
            <Card key={s.id} id={s.id} className="scroll-mt-20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <s.icon className="size-4 text-primary" />
                  <span className="num text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <CardTitle className="text-sm">{s.name}</CardTitle>
                <CardDescription className="text-xs">{s.sub}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="num text-sm font-semibold">{s.stat}</div>
                <p className="text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        id="corrupt"
        title="Nothing is silently dropped"
        blurb="For every table, bronze rows must equal silver rows plus quarantined rows. The pipeline asserts this on every run and stops when it fails — which is what turns the claim into a property somebody can check."
      >
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead className="text-right">Bronze</TableHead>
                <TableHead className="text-right">Silver</TableHead>
                <TableHead className="text-right">Quarantined</TableHead>
                <TableHead className="text-right">Balances</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recon.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="num text-right">{fmt(r.bronze)}</TableCell>
                  <TableCell className="num text-right">{fmt(r.silver)}</TableCell>
                  <TableCell className="num text-right">{r.quarantined || "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.balances ? (
                      <CheckCircle2 className="ml-auto size-4 text-primary" />
                    ) : (
                      <span className="text-destructive">no</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section
        id="validate"
        title="The six checks"
        blurb="Each defect has a real operational cause — knowing the cause is the difference between “duplicate rows” and “an interface replayed the message”. A defect found by the wrong check is a coincidence, so the score only counts a check that caught its own."
      >
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Check</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>What causes it in a real system</TableHead>
                <TableHead className="text-right">Injected</TableHead>
                <TableHead className="text-right">Caught</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checks.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-semibold">{c.id}</div>
                    <div className="text-xs text-muted-foreground">{c.name}</div>
                  </TableCell>
                  <TableCell className="max-w-[16rem] text-muted-foreground">{c.rule}</TableCell>
                  <TableCell className="max-w-[16rem] text-muted-foreground">{c.cause}</TableCell>
                  <TableCell className="num text-right">{c.injected}</TableCell>
                  <TableCell className="num text-right font-semibold">
                    <span className={c.caught === c.injected ? "text-primary" : "text-destructive"}>
                      {c.caught}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section
        id="quarantine"
        title="Quarantine"
        blurb={`${quarantined} rows held back, ${reasons.length} distinct reasons. Showing the rows is the argument — a count would be the claim, not the evidence. Somebody will eventually ask why a patient is missing from a report, and this is how that gets answered.`}
        actions={
          <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show first 15" : `Show all ${quarantined}`}
            <ChevronRight className={`size-4 transition-transform ${showAll ? "rotate-90" : ""}`} />
          </Button>
        }
      >
        <Card className="max-h-[32rem] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Check</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Row</TableHead>
                <TableHead>Why it was held back</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(showAll ? quarantineRows : quarantineRows.slice(0, 15)).map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.check_id}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.source_table.replace("bronze_", "")}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.source_row_id.slice(0, 16)}…
                  </TableCell>
                  <TableCell>{r.failure_reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section
        id="identity"
        title="Suspected duplicate patients"
        blurb="These records look like the same human registered twice. Nothing downstream merges them, and both patients continue to exist separately in Silver. That restraint is a choice, not a missing feature — a wrong merge combines two people's medication lists, which is a patient safety event rather than a data bug."
      >
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record A</TableHead>
                <TableHead>Record B</TableHead>
                <TableHead>Fields that match</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {identityRows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.candidate_a_mrn.slice(0, 8)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.candidate_b_mrn.slice(0, 8)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.match_fields.split(",").join(", ").replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="num text-right">{r.confidence.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="gap-1.5 border-destructive/40 text-destructive">
                      <Users className="size-3" /> awaiting review
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section
        id="remediation"
        title="One correction, in full"
        blurb="Not every bad value is thrown away. An A1c is a percentage, so 250 is impossible — but blood glucose in mg/dL lands there routinely, which makes this a unit error rather than nonsense."
      >
        <Tabs defaultValue="example">
          <TabsList>
            <TabsTrigger value="example">The correction</TabsTrigger>
            <TabsTrigger value="all">All {remediationRows.length}</TabsTrigger>
          </TabsList>

          <TabsContent value="example">
            <Card>
              <CardContent className="grid gap-px overflow-hidden rounded-lg bg-border p-0 sm:grid-cols-3">
                <div className="flex flex-col gap-1 bg-card p-5">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    As it arrived
                  </div>
                  <div className="num text-2xl font-semibold text-destructive">
                    {example.original_value}
                  </div>
                  <p className="text-xs text-muted-foreground">percent — biologically impossible</p>
                </div>
                <div className="flex flex-col gap-1 bg-card p-5">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    After correction
                  </div>
                  <div className="num text-2xl font-semibold text-primary">
                    {example.corrected_value}
                  </div>
                  <p className="text-xs text-muted-foreground">percent — a poorly controlled diabetic</p>
                </div>
                <div className="flex flex-col gap-1 bg-card p-5">
                  <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Wrench className="size-3" /> Rule applied
                  </div>
                  <code className="font-mono text-xs">A1c = (value + 46.7) / 28.7</code>
                  <p className="text-xs text-muted-foreground">
                    The ADA mapping between A1c and estimated average glucose. The
                    original is kept, so a reviewer who disagrees excludes every
                    corrected row with one filter.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card className="max-h-[26rem] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead className="text-right">Was</TableHead>
                    <TableHead className="text-right">Now</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remediationRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.source_row_id.slice(0, 22)}…
                      </TableCell>
                      <TableCell className="num text-right text-destructive">{r.original_value}</TableCell>
                      <TableCell className="num text-right text-primary">{r.corrected_value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </Section>
    </Page>
  );
}
