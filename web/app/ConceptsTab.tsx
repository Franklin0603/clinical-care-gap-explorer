import { ArrowRight } from "lucide-react";

import { GLOSSARY, GLOSSARY_GROUPS } from "@/lib/glossary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** The primer, for a reader with no healthcare background.
 *
 *  It lives as a tab on Introduction rather than its own sidebar section: it is
 *  read once, by somebody orienting themselves, and the sidebar should stay a
 *  list of places to work rather than a table of contents. Terms used elsewhere
 *  in the app carry their own definition inline via <Term>. */
export function ConceptsTab() {
  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">The one thing to know first</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">
          <p>
            A person with type 2 diabetes is supposed to get a blood test called an{" "}
            <strong>A1c</strong> roughly every six months. It measures average blood
            sugar over the previous three months. If that number drifts upward and
            nobody notices, the damage lands on kidneys, eyes and nerves, slowly at
            first and then all at once.
          </p>
          <p className="text-muted-foreground">
            Sometimes nobody notices. The patient moves, changes doctors, misses an
            appointment, or falls off a list. Twelve months pass with no result on
            file. <strong className="text-foreground">That is a care gap</strong>,
            and this project finds them.
          </p>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-semibold">Why nothing is stored as words</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Healthcare does not store &ldquo;diabetes&rdquo; as text. It stores a
            number from an agreed vocabulary, because free text does not survive
            contact with reality.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 text-sm leading-relaxed">
            <p className="text-muted-foreground">
              One system writes <code className="font-mono text-xs">Diabetes mellitus type 2</code>,
              another <code className="font-mono text-xs">DM Type II</code>, a third{" "}
              <code className="font-mono text-xs">T2DM</code>, a fourth{" "}
              <code className="font-mono text-xs">NIDDM</code>, a term abandoned in the
              1990s. All four mean the same thing and no text match will ever catch
              them all. Worse, a display string can be quietly reworded by a vendor
              during a routine upgrade, and a report breaks without erroring.
            </p>
            <p className="font-medium">Join on codes. Never join on display names.</p>
            <div className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2">
              {[
                ["SNOMED CT", "what the clinician means", "44054006 · Diabetes mellitus type 2"],
                ["LOINC", "the question a lab was asked", "4548-4 · Hemoglobin A1c"],
                ["RxNorm", "what the pharmacy dispenses", "860975 · Metformin 500 mg"],
                ["ICD-10", "what the biller submits (out of scope)", "E11.9"],
              ].map(([name, role, example]) => (
                <div key={name} className="flex flex-col gap-1 bg-card p-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{name}</span>
                    <span className="text-xs text-muted-foreground">{role}</span>
                  </div>
                  <code className="font-mono text-xs text-muted-foreground">{example}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-semibold">A LOINC code is a question, not an answer</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            This is where unit errors live, and it is the reason one of the six data
            quality checks exists.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 text-sm leading-relaxed text-muted-foreground">
            <p>
              <code className="font-mono text-xs">4548-4</code> means precisely one
              thing: <em>the proportion of haemoglobin that is glycated, in blood</em>.
              The result value and its unit are stored in separate columns.
            </p>
            <p>
              An A1c is reported in <strong className="text-foreground">percent</strong>,
              where around 5 is normal and 9 is poorly controlled. Blood glucose is
              reported in{" "}
              <strong className="text-foreground">mg/dL</strong>, where normal is around
              90. Put a mg/dL value into a percent field and you get an A1c of 250:
              biologically impossible, and a perfectly valid number as far as the
              database is concerned.
            </p>
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-foreground">
              No type system catches that. Only a range check does, which is why one
              of the six checks is a plausibility range, and why getting that range
              wrong mattered.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-semibold">Every term, defined</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Grouped by what they are about rather than alphabetically. Terms used
            elsewhere in this app carry the same definition inline. Look for the
            dotted underline.
          </p>
        </div>

        {GLOSSARY_GROUPS.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle className="text-sm">{group.title}</CardTitle>
              <CardDescription>{group.blurb}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col">
              {group.keys.map((key, i) => {
                const e = GLOSSARY[key];
                return (
                  <div
                    key={key}
                    className={`flex flex-col gap-1 py-3 ${i > 0 ? "border-t" : ""}`}
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-semibold">{e.term}</span>
                      {e.tag && <Badge variant="secondary" className="font-mono text-[10px]">{e.tag}</Badge>}
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{e.short}</p>
                    {e.long && (
                      <p className="text-xs leading-relaxed text-muted-foreground/80">{e.long}</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-3 pt-6 text-sm">
          <ArrowRight className="size-4 shrink-0 text-primary" />
          <span>
            That is the whole vocabulary. Everything else on this site is ordinary
            data engineering: layers, checks, and a reconciliation that has to
            balance.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
