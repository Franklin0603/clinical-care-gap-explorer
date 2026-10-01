"use client";

import { useState } from "react";
import { Lock, LogIn, UserRound } from "lucide-react";

import {
  Role, roleMeta, roleRows, defaultRole, COLUMN_LABELS, COLUMN_ORDER, PatientRow,
} from "@/lib/data";
import { Page, Section } from "@/components/shell/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Term } from "@/components/Term";

const ROLES: Role[] = ["pct", "nurse", "physician"];
const INITIALS: Record<Role, string> = { pct: "PT", nurse: "RN", physician: "MD" };

function cell(row: PatientRow, key: string) {
  const v = row[key];
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof v === "boolean") {
    if (key === "gap_flag") {
      return v ? (
        <Badge variant="outline" className="border-destructive/40 text-destructive">overdue</Badge>
      ) : (
        <span className="text-muted-foreground">current</span>
      );
    }
    return v ? "yes" : "no";
  }
  if (key === "mrn" || key === "patient_id") {
    return <span className="font-mono text-xs">{String(v).slice(0, 8)}</span>;
  }
  return <span className="num">{String(v)}</span>;
}

export default function PatientView() {
  const [role, setRole] = useState<Role>(defaultRole);
  const meta = roleMeta[role];
  const rows = roleRows[role];

  const visible = COLUMN_ORDER.filter((c) => meta.columns.includes(c));
  const restricted = COLUMN_ORDER.filter((c) => meta.restricted.includes(c));

  return (
    <Page
      title="Patients"
      blurb={<>The <Term k="cohort">cohort</Term>, scoped to what the signed-in role needs</>}
      actions={
        /* Styled as an account switcher because that is what it stands in for.
           There is no authentication here and the page says so — but a reviewer
           should see the shape of the thing being modelled. */
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-2">
                <Avatar className="size-5">
                  <AvatarFallback className="text-[10px]">{INITIALS[role]}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">{meta.label}</span>
                <LogIn className="size-3.5 opacity-60" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-72">
            {/* A radio group, not loose items: picking one of three roles is a
                single-choice control, so it gets role="menuitemradio" and a real
                checked state instead of a tick drawn by hand. It is also what
                gives DropdownMenuLabel a parent — Base UI's GroupLabel throws
                outside a Group or RadioGroup, which is what left this menu
                empty and the role unchangeable. */}
            <DropdownMenuRadioGroup
              value={role}
              onValueChange={(v) => setRole(v as Role)}
            >
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Signed in as — demonstration control, no authentication
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ROLES.map((r) => (
                <DropdownMenuRadioItem
                  key={r}
                  value={r}
                  /* Base UI keeps a radio menu open on click, which suits a
                     filter you tune repeatedly. This one re-scopes the whole
                     page, so it should close and let you see what changed. */
                  closeOnClick
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <div className="flex w-full items-center gap-2">
                    <Avatar className="size-5">
                      <AvatarFallback className="text-[10px]">{INITIALS[r]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{roleMeta[r].label}</span>
                  </div>
                  <span className="num pl-7 text-xs text-muted-foreground">
                    {roleMeta[r].patients} patients · {roleMeta[r].columns.length} columns
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" />
              <CardTitle className="text-base">{meta.label}</CardTitle>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="num text-2xl font-semibold text-primary">{meta.patients}</span>
              <span className="text-sm text-muted-foreground">patients visible</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="num text-2xl font-semibold text-destructive">{meta.gaps}</span>
              <span className="text-sm text-muted-foreground">with an open gap</span>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {meta.scope}{meta.units && ` — ${meta.units.join(", ")}`}
            </Badge>
          </div>
          <CardDescription className="max-w-3xl pt-2">{meta.rationale}</CardDescription>
        </CardHeader>
        {restricted.length > 0 && (
          <CardContent>
            <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <Lock className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-sm leading-relaxed">
                <strong>{restricted.length} fields are withheld.</strong> Each one is{" "}
                <Term k="phi">PHI</Term> this role has no need for. They are not hidden
                in the browser — this role loads a different file, built by a query that
                never selected them. Open the network tab and read it: the fields are
                absent, not blank.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      <Section
        title="Patients"
        blurb={`First 20 of ${rows.length}. Columns marked "not available" carry no value in this role's payload at all.`}
      >
        <Card className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {visible.map((c) => <TableHead key={c}>{COLUMN_LABELS[c]}</TableHead>)}
                {restricted.map((c) => (
                  <TableHead key={c} className="italic text-muted-foreground/60">
                    {COLUMN_LABELS[c]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 20).map((row, i) => (
                <TableRow key={i}>
                  {visible.map((c) => <TableCell key={c}>{cell(row, c)}</TableCell>)}
                  {restricted.map((c) => (
                    <TableCell
                      key={c}
                      className="bg-muted/40 text-xs italic text-muted-foreground/70"
                      title="Not available for this role"
                    >
                      not available
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section title="How the restriction actually works">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Filtering is in the query layer",
              body: "The site is a static export, so there is no request-time server. Instead the pipeline writes one payload per role, each from SQL that never selects the restricted columns and never returns out-of-unit rows. Hiding a column with CSS would not be access control — which is why the row counts change too, not only the columns.",
            },
            {
              title: "Column filtering alone would leak",
              body: "next_due_date is the last A1c date plus 365 days, and days_overdue is the same date in different clothes. Withhold the value but keep either one and the test date is reconstructable exactly, so the derived columns are restricted alongside what they derive from.",
            },
            {
              title: "What this does not do",
              body: "There is no authentication, so every role's file is reachable by anyone who guesses its URL. In a real system the same queries would sit behind a session and an authorization check. What is demonstrated here is where the restriction lives, not that this deployment is secure.",
            },
          ].map((c) => (
            <Card key={c.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{c.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                {c.body}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
    </Page>
  );
}
