"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, Syringe } from "lucide-react";

import { patients, COLUMN_LABELS, PatientRow, fmt } from "@/lib/data";
import { Page, Section } from "@/components/shell/Page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Term } from "@/components/Term";
import { PatientDetailSheet } from "./PatientDetail";

/** Columns worth showing in the list. The rest are in the detail panel. */
const LIST = [
  "mrn", "age", "sex", "unit", "gap_flag", "last_a1c_date", "last_a1c_value",
  "days_overdue", "on_insulin",
];

const STATUS_LABELS: Record<string, string> = {
  all: "All patients",
  overdue: "Overdue only",
  never: "Never tested",
  current: "Up to date",
};
const shown = (labels: Record<string, string>) => (v: string | null) =>
  labels[v ?? "all"] ?? v ?? "";

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
    if (key === "on_insulin") {
      return v ? <Syringe className="size-3.5 text-primary" /> : null;
    }
    return v ? "yes" : "no";
  }
  if (key === "mrn") return <span className="font-mono text-xs">{String(v).slice(0, 8)}</span>;
  return <span className="num">{String(v)}</span>;
}

export default function PatientView() {
  const [status, setStatus] = useState("all");
  const [unit, setUnit] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<PatientRow | null>(null);

  const units = useMemo(
    () => [...new Set(patients.map((r) => String(r.unit)))].sort(),
    [],
  );

  const rows = useMemo(
    () =>
      patients.filter((r) => {
        if (unit !== "all" && r.unit !== unit) return false;
        if (status === "overdue" && !r.gap_flag) return false;
        if (status === "current" && r.gap_flag) return false;
        if (status === "never" && r.last_a1c_date !== null) return false;
        if (q && !String(r.mrn).toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [status, unit, q],
  );

  const gaps = rows.filter((r) => r.gap_flag).length;
  const insulin = rows.filter((r) => r.on_insulin).length;
  const never = rows.filter((r) => r.last_a1c_date === null).length;

  return (
    <Page
      title="Patients"
      blurb={
        <>
          The diabetic <Term k="cohort">cohort</Term>. Open a row for that
          person&apos;s A1c history, medications and what has been done.
        </>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find an MRN"
              className="h-9 w-[150px] pl-8"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
            <SelectTrigger className="w-[150px]" size="sm">
              <SelectValue>{shown(STATUS_LABELS)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All patients</SelectItem>
              <SelectItem value="overdue">Overdue only</SelectItem>
              <SelectItem value="never">Never tested</SelectItem>
              <SelectItem value="current">Up to date</SelectItem>
            </SelectContent>
          </Select>
          <Select value={unit} onValueChange={(v) => setUnit(v ?? "all")}>
            <SelectTrigger className="w-[150px]" size="sm">
              <SelectValue>{shown({ all: "All settings" })}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All settings</SelectItem>
              {units.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <Card>
        <CardContent className="flex flex-wrap items-baseline gap-x-8 gap-y-3 pt-6">
          {[
            [String(rows.length), "patients in view", "text-primary"],
            [String(gaps), "with an open gap", "text-destructive"],
            [String(never), "never tested", "text-destructive"],
            [String(insulin), "on insulin", "text-primary"],
          ].map(([n, label, tone]) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <span className={`num text-2xl font-semibold ${tone}`}>{n}</span>
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
          {rows.length !== patients.length && (
            <Badge variant="secondary" className="ml-auto">
              filtered from {fmt(patients.length)}
            </Badge>
          )}
        </CardContent>
      </Card>

      <Section
        title="The cohort"
        blurb="Sorted with the open gaps first, most overdue at the top. Click any row."
      >
        <Card className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {LIST.map((c) => <TableHead key={c}>{COLUMN_LABELS[c]}</TableHead>)}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={String(row.patient_id)}
                  onClick={() => setOpen(row)}
                  className="cursor-pointer"
                >
                  {LIST.map((c) => <TableCell key={c}>{cell(row, c)}</TableCell>)}
                  <TableCell className="w-8 text-right">
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={LIST.length + 1} className="py-10 text-center text-sm text-muted-foreground">
                    No patient matches those filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section
        title="What the report does not carry"
        blurb="Stated here because the detail panel looks like a chart, and a chart invites conclusions it cannot support."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "No orders, anywhere",
              body: "A clinician can order an A1c and the patient never goes. This data records results and procedures that happened, never requests, so that patient is indistinguishable from one nobody ordered a test for. It is the single biggest thing a real deployment would add.",
            },
            {
              title: "Fills are not doses",
              body: "The medication table counts dispenses, because that is the only quantity the source exports. A rising fill count suggests a rising insulin burden; it does not measure one, and nothing here should be read as a dose.",
            },
            {
              title: "Columns are no longer scoped by role",
              body: "The pipeline still builds a separate export per role, and the access matrix and its tests still describe which fields a technician, a nurse and a physician may each see. That argument moved to the documentation; this page now shows the whole record.",
            },
          ].map((c) => (
            <Card key={c.title}>
              <CardContent className="flex flex-col gap-1.5 pt-6">
                <div className="text-sm font-medium">{c.title}</div>
                <p className="text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <PatientDetailSheet
        patient={open}
        cohort={patients}
        onClose={() => setOpen(null)}
      />
    </Page>
  );
}
