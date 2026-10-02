"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Search, Syringe, X } from "lucide-react";

import { patients, PatientRow, gold, fmt } from "@/lib/data";
import { Page, Section } from "@/components/shell/Page";
import { MetricCard } from "@/components/MetricCard";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/data-table/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/data-table/DataTableViewOptions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Term } from "@/components/Term";
import { PatientDetailSheet } from "./PatientDetail";

/** Above this, a last result is not at goal. The usual adult target. */
const TARGET = 7;

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const date = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const dash = <span className="text-muted-foreground">—</span>;

/** Months between a date and the as-of date. */
function monthsBefore(d: string | null, asof: string) {
  if (!d) return null;
  return (new Date(asof).getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

const LABELS: Record<string, string> = {
  mrn: "MRN", age: "Age", sex: "Sex", unit: "Unit", gap_flag: "A1c gap",
  last_a1c_date: "Last A1c", last_a1c_value: "Value", days_overdue: "Days overdue",
  on_insulin: "Insulin", a1c_count_2y: "Tests 2yr", active_med_count: "Meds",
  last_encounter_date: "Last seen", priority: "Priority", first_dx_date: "Diagnosed",
};

const columns: ColumnDef<PatientRow, unknown>[] = [
  {
    accessorKey: "mrn",
    header: ({ column }) => <DataTableColumnHeader column={column} title="MRN" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs">{String(row.original.mrn).slice(0, 8)}</span>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "age",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Age" />,
    cell: ({ row }) => <span className="num">{String(row.original.age)}</span>,
  },
  {
    accessorKey: "sex",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Sex" />,
  },
  {
    accessorKey: "unit",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Unit" />,
    filterFn: (row, id, value: string[]) => value.includes(String(row.getValue(id))),
  },
  {
    id: "status",
    accessorFn: (r) =>
      r.last_a1c_date === null ? "never" : r.gap_flag ? "overdue" : "current",
    header: ({ column }) => <DataTableColumnHeader column={column} title="A1c gap" />,
    cell: ({ getValue }) => {
      const v = getValue() as string;
      if (v === "never") {
        return (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            never tested
          </Badge>
        );
      }
      if (v === "overdue") {
        return (
          <Badge variant="outline" className="border-chart-2/50 text-chart-2">
            overdue
          </Badge>
        );
      }
      return <span className="text-muted-foreground">current</span>;
    },
    filterFn: (row, id, value: string[]) => value.includes(String(row.getValue(id))),
    enableHiding: false,
  },
  {
    accessorKey: "last_a1c_date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last A1c" />,
    cell: ({ row }) => {
      const d = date(row.original.last_a1c_date);
      return d ? <span className="num">{d}</span> : dash;
    },
    sortUndefined: "last",
  },
  {
    accessorKey: "last_a1c_value",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Value" className="justify-end" />
    ),
    cell: ({ row }) => {
      const v = num(row.original.last_a1c_value);
      if (v === null) return <div className="text-right">{dash}</div>;
      return (
        <div className="num text-right">
          <span className={v >= TARGET ? "font-medium text-destructive" : ""}>
            {v.toFixed(1)}%
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "days_overdue",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Days overdue" className="justify-end" />
    ),
    cell: ({ row }) => {
      const v = num(row.original.days_overdue);
      return (
        <div className="num text-right">
          {v === null ? dash : <span className="text-destructive">{fmt(v)}</span>}
        </div>
      );
    },
  },
  {
    accessorKey: "a1c_count_2y",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tests 2yr" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="num text-right">{String(row.original.a1c_count_2y ?? 0)}</div>
    ),
  },
  {
    accessorKey: "last_encounter_date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last seen" />,
    cell: ({ row }) => {
      const d = date(row.original.last_encounter_date);
      return d ? <span className="num">{d}</span> : dash;
    },
  },
  {
    accessorKey: "active_med_count",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Meds" className="justify-end" />
    ),
    cell: ({ row }) => (
      <div className="num text-right">{String(row.original.active_med_count ?? 0)}</div>
    ),
  },
  {
    accessorKey: "on_insulin",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Insulin" />,
    cell: ({ row }) =>
      row.original.on_insulin ? (
        <Syringe className="size-3.5 text-primary" />
      ) : (
        <span className="sr-only">no</span>
      ),
    filterFn: (row, id, value: string[]) =>
      value.includes(row.getValue(id) ? "yes" : "no"),
  },
];

export default function PatientView() {
  const [open, setOpen] = useState<PatientRow | null>(null);
  /** A card's filter, applied to the table through its own column. */
  const [card, setCard] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const stats = useMemo(() => {
    const withValue = patients
      .map((r) => num(r.last_a1c_value))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    const median = withValue.length
      ? withValue.length % 2
        ? withValue[(withValue.length - 1) / 2]
        : (withValue[withValue.length / 2 - 1] + withValue[withValue.length / 2]) / 2
      : null;
    return {
      total: patients.length,
      gaps: patients.filter((r) => r.gap_flag).length,
      never: patients.filter((r) => r.last_a1c_date === null).length,
      insulin: patients.filter((r) => r.on_insulin).length,
      median,
      tested: withValue.length,
      aboveTarget: withValue.filter((v) => v >= TARGET).length,
      worst: Math.max(...patients.map((r) => num(r.days_overdue) ?? 0)),
      // Open gap, yet in the building recently. Nobody in this data is
      // unreachable - the furthest anyone is from their last encounter is 11
      // months - so "not seen in a year" was structurally always zero. This
      // is the number that is actually actionable.
      seenNotTested: patients.filter(
        (r) => r.gap_flag && (monthsBefore(date(r.last_encounter_date), gold.asof) ?? 99) <= 6,
      ).length,
    };
  }, []);

  /** Rows the cards narrow to. The table's own filters stack on top. */
  const rows = useMemo(() => {
    if (!card) return patients;
    if (card === "insulin") return patients.filter((r) => r.on_insulin);
    if (card === "above") return patients.filter((r) => (num(r.last_a1c_value) ?? 0) >= TARGET);
    if (card === "seenNotTested") {
      return patients.filter(
        (r) => r.gap_flag && (monthsBefore(date(r.last_encounter_date), gold.asof) ?? 99) <= 6,
      );
    }
    if (card === "overdue") return patients.filter((r) => r.gap_flag && r.last_a1c_date !== null);
    if (card === "never") return patients.filter((r) => r.last_a1c_date === null);
    if (card === "tested") return patients.filter((r) => r.last_a1c_value !== null);
    return patients;
  }, [card]);

  const toggle = (k: string) => () => setCard((c) => (c === k ? null : k));

  return (
    <Page
      title="Patients"
      blurb={
        <>
          The diabetic <Term k="cohort">cohort</Term>. Open a row for that
          person&apos;s A1c history, medications and what has been done.
        </>
      }
      actions={<Badge variant="outline" className="num">as of {gold.asof}</Badge>}
    >
      <Section
        title="The cohort at a glance"
        blurb="Eight figures about these patients specifically. The headline rate and its breakdowns live on Overview; these are the ones that decide who to call first."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="In the cohort" value={stats.total}
            caption="Alive on the as-of date"
            hint="Patients carrying any of eight type 2 diabetes codes and alive on 2026-08-23. Everything else on this page is a slice of these."
            action={() => setCard(null)} actionLabel="All" active={card === null}
          />
          <MetricCard
            label="Open A1c gaps" value={stats.gaps} tone="bad"
            caption="No result in twelve months"
            hint="Includes the never-tested. A gap opens at 366 days, so exactly 365 is not yet a gap."
            action={toggle("overdue")} actionLabel="Show" active={card === "overdue"}
          />
          <MetricCard
            label="Never tested" value={stats.never} tone="bad"
            caption="No A1c on file, ever"
            hint="The highest-risk group and the easiest to lose: three separate ordinary mistakes would each have hidden exactly these people."
            action={toggle("never")} actionLabel="Show" active={card === "never"}
          />
          <MetricCard
            label="On insulin" value={stats.insulin}
            caption="Insulin-treated, so less margin"
            hint="An insulin-treated patient drifting out of control has less room for error than one on metformin alone, which is why it sits in the worklist rank."
            action={toggle("insulin")} actionLabel="Show" active={card === "insulin"}
          />

          <MetricCard
            label="Median last A1c"
            value={stats.median === null ? "—" : `${stats.median.toFixed(1)}%`}
            caption={`Across the ${stats.tested} with a result`}
            hint="Median, not mean: a single implausible value would drag a mean, and this data has 13 results under 3% that are almost certainly unit errors."
            action={toggle("tested")} actionLabel="Show" active={card === "tested"}
          />
          <MetricCard
            label="Above target" value={stats.aboveTarget} tone="warn"
            caption={`Last result at or over ${TARGET}%`}
            hint="Not at goal on the most recent result. A gap is about whether anyone looked; this is about what they found when they did."
            action={toggle("above")} actionLabel="Show" active={card === "above"}
          />
          <MetricCard
            label="Longest overdue" value={fmt(stats.worst)} tone="bad"
            caption="Days, the worst case here"
            hint="The single most overdue patient. A list where the worst case is six years old is a list nobody has worked."
            action={toggle("overdue")} actionLabel="Show" active={card === "overdue"}
          />
          <MetricCard
            label="Seen, not tested" value={stats.seenNotTested} tone="bad"
            caption="Open gap, in clinic within 6 months"
            hint="The actionable group. These patients were not hard to reach, they were standing in the building: 24 of the 25 open gaps were in clinic within six months, and 20 of those have never had an A1c at all. That makes this an ordering problem rather than an outreach problem."
            action={toggle("seenNotTested")} actionLabel="Show" active={card === "seenNotTested"}
          />
        </div>
      </Section>

      <Section
        title="The cohort"
        blurb="Sort any column, filter, or search an MRN. Click a row to open that patient."
      >
        <DataTable
          columns={columns}
          data={rows}
          noun="patient"
          empty="No patient matches those filters."
          onRowClick={setOpen}
          initialSorting={[{ id: "days_overdue", desc: true }]}
          initialHidden={{ sex: false, a1c_count_2y: false, active_med_count: false }}
          toolbar={(table) => (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    table.getColumn("mrn")?.setFilterValue(e.target.value);
                  }}
                  placeholder="Find an MRN"
                  className="h-9 w-[170px] pl-8"
                />
              </div>
              <DataTableFacetedFilter
                column={table.getColumn("status")}
                title="A1c gap"
                options={[
                  { label: "Overdue", value: "overdue" },
                  { label: "Never tested", value: "never" },
                  { label: "Up to date", value: "current" },
                ]}
              />
              <DataTableFacetedFilter
                column={table.getColumn("unit")}
                title="Setting"
                options={[...new Set(patients.map((r) => String(r.unit)))]
                  .sort()
                  .map((u) => ({ label: u, value: u }))}
              />
              <DataTableFacetedFilter
                column={table.getColumn("on_insulin")}
                title="Insulin"
                options={[
                  { label: "On insulin", value: "yes" },
                  { label: "Not on insulin", value: "no" },
                ]}
              />
              {(table.getState().columnFilters.length > 0 || card) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2"
                  onClick={() => {
                    table.resetColumnFilters();
                    setCard(null);
                    setQ("");
                  }}
                >
                  Reset <X className="size-3.5" />
                </Button>
              )}
              <div className="ml-auto">
                <DataTableViewOptions table={table} labels={LABELS} />
              </div>
            </div>
          )}
        />
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
              body: "The pipeline still builds a separate export per role, and the access matrix and its tests still describe which fields a technician, a nurse and a physician may each see. That argument moved to the documentation; this page shows the whole record.",
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

      <PatientDetailSheet patient={open} cohort={patients} onClose={() => setOpen(null)} />
    </Page>
  );
}
