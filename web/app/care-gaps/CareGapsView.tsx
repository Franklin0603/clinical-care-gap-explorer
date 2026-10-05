"use client";

import { ReactNode, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { PatientRow, fmt, patients } from "@/lib/data";
import {
  AGE_BANDS, GAP_SORTS, GapFilters, GapSort, NO_FILTERS,
  daysOverdue, filterGaps, gapStatus, lastA1cValue, optionCounts, settingLabel, sortGaps,
} from "@/lib/cohort";
import { longDate } from "@/lib/dates";
import { cn } from "cn";
import { GapStatusBadge } from "@/components/GapStatusBadge";
import { NoOpenGaps } from "@/components/NoOpenGaps";
import { shortMrn, usePatientReview } from "@/components/PatientReview";
import { InsulinBadge } from "@/components/patient/PatientTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

/**
 * The care-gap work queue: every open gap, in the pipeline's priority order,
 * narrowed by status, search and three filters.
 *
 * Filtering and sorting are lib/cohort.ts, tested against the gold report;
 * this file only lays them out. Each filter option shows how many gaps it
 * would leave, so an option that empties the list says so before it is chosen.
 * Today that matters for insulin: none of the 25 open gaps is on insulin.
 */

const GAPS = patients.filter((r) => r.gap_flag);
const SETTINGS = [...new Set(GAPS.map((r) => String(r.unit)))]
  .sort((a, b) => settingLabel(a).localeCompare(settingLabel(b)));

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "never", label: "Never tested" },
  { value: "overdue", label: "Overdue" },
] as const;

const INSULIN_LABELS: Record<string, string> = { all: "Any insulin", yes: "Insulin documented", no: "No insulin documented" };

/** Base UI shows the raw value in a closed trigger unless given a formatter. */
const shown = (label: (v: string) => string) => (v: string | null) => label(v ?? "all");

const dateOrDash = (v: unknown) => longDate(v as string | null) ?? "—";

const STATUSES = ["all", "never", "overdue"] as const;

/** Reads ?status= so a link elsewhere (Home's "Review 21 patients") can open
 *  the queue already filtered. Only status is read from the address; the
 *  other filters stay in the page. */
export function CareGapsFromUrl() {
  const raw = useSearchParams().get("status");
  const status = (STATUSES as readonly string[]).includes(raw ?? "") ? (raw as GapFilters["status"]) : "all";
  // Keyed, so following a different status link resets the queue to it.
  return <CareGapsView key={status} initialStatus={status} />;
}

export function CareGapsView({ initialStatus = "all" }: { initialStatus?: GapFilters["status"] }) {
  const [f, setF] = useState<GapFilters>({ ...NO_FILTERS, status: initialStatus });
  const [sort, setSort] = useState<GapSort>("priority");
  const { button: review, drawer } = usePatientReview("care-gaps");

  const set = <K extends keyof GapFilters>(k: K) => (v: GapFilters[K] | null) =>
    setF((cur) => ({ ...cur, [k]: v ?? NO_FILTERS[k] }));

  const rows = useMemo(() => sortGaps(filterGaps(patients, f), sort), [f, sort]);
  const counts = useMemo(() => ({
    status: optionCounts(patients, f, "status", ["all", "never", "overdue"]),
    setting: optionCounts(patients, f, "setting", SETTINGS),
    band: optionCounts(patients, f, "band", [...AGE_BANDS]),
    insulin: optionCounts(patients, f, "insulin", ["yes", "no"]),
  }), [f]);

  const filtering = f.status !== "all" || f.query.trim() !== "" || f.setting !== "all"
    || f.band !== "all" || f.insulin !== "all";

  if (GAPS.length === 0) return <NoOpenGaps />;

  return (
    <div className="flex flex-col gap-4">
      {/* Status: the one filter used most, so it is always visible. */}
      <div role="group" aria-label="Gap status" className="flex w-fit flex-wrap gap-1 rounded-lg border bg-muted/50 p-1">
        {STATUS_OPTIONS.map((o) => {
          const on = f.status === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => set("status")(o.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
              <span className="num text-xs text-muted-foreground">{counts.status.get(o.value)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={f.query}
            onChange={(e) => set("query")(e.target.value)}
            placeholder="Search by MRN"
            aria-label="Search patients by MRN"
            className="h-8 pl-8"
          />
        </div>

        <Select value={f.setting} onValueChange={set("setting")}>
          <SelectTrigger aria-label="Care setting" className="min-w-36">
            <SelectValue>{shown((v) => (v === "all" ? "Any setting" : settingLabel(v)))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any setting</SelectItem>
            {SETTINGS.map((u) => (
              <SelectItem key={u} value={u}>
                {settingLabel(u)} <span className="num text-muted-foreground">({counts.setting.get(u)})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={f.band} onValueChange={set("band")}>
          <SelectTrigger aria-label="Age band" className="min-w-28">
            <SelectValue>{shown((v) => (v === "all" ? "Any age" : `Age ${v}`))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any age</SelectItem>
            {AGE_BANDS.map((b) => (
              <SelectItem key={b} value={b}>
                {b} <span className="num text-muted-foreground">({counts.band.get(b)})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={f.insulin} onValueChange={set("insulin")}>
          <SelectTrigger aria-label="Insulin" className="min-w-32">
            <SelectValue>{shown((v) => INSULIN_LABELS[v] ?? v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any insulin</SelectItem>
            {(["yes", "no"] as const).map((v) => (
              <SelectItem key={v} value={v}>
                {INSULIN_LABELS[v]} <span className="num text-muted-foreground">({counts.insulin.get(v)})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-sm text-muted-foreground" id="sort-label">Sort</span>
          <Select value={sort} onValueChange={(v) => setSort((v as GapSort | null) ?? "priority")}>
            <SelectTrigger aria-labelledby="sort-label" className="min-w-40">
              <SelectValue>{shown((v) => GAP_SORTS[v as GapSort] ?? v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(GAP_SORTS) as GapSort[]).map((k) => (
                <SelectItem key={k} value={k}>{GAP_SORTS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex min-h-8 items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {filtering
            ? <><span className="num">{fmt(rows.length)}</span> of <span className="num">{fmt(GAPS.length)}</span> open gaps</>
            : <><span className="num">{fmt(rows.length)}</span> open gaps</>}
        </p>
        {filtering && (
          <Button variant="ghost" size="sm" onClick={() => setF(NO_FILTERS)}>
            <X aria-hidden />
            Clear filters
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-6 py-10 text-center">
          <p className="text-base font-semibold">No open gaps match these filters</p>
          <p className="text-sm text-muted-foreground">Try a different filter, or clear them to see all {fmt(GAPS.length)}.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setF(NO_FILTERS)}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          {/* md and up: a table. Last A1c and Insulin give way on a tablet. */}
          <div className="hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Patient</TableHead>
                  <TableHead>Gap status</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Last A1c</TableHead>
                  <TableHead>Last test</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="hidden lg:table-cell">Insulin</TableHead>
                  <TableHead className="pr-4 text-right"><span className="sr-only">Action</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => <GapRow key={String(r.patient_id)} r={r} review={review} />)}
              </TableBody>
            </Table>
          </div>

          {/* Below md: one card per patient. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => <GapCard key={String(r.patient_id)} r={r} review={review} />)}
          </ul>
        </>
      )}

      {drawer}
    </div>
  );
}

type Review = (r: PatientRow) => ReactNode;

function GapRow({ r, review }: { r: PatientRow; review: Review }) {
  const a1c = lastA1cValue(r);
  const late = daysOverdue(r);
  return (
    <TableRow>
      <TableCell className="pl-4">
        <div className="flex flex-col">
          <span className="font-mono text-sm"><span className="text-muted-foreground">MRN </span>{shortMrn(r)}</span>
          <span className="text-xs text-muted-foreground">Age {String(r.age)}</span>
        </div>
      </TableCell>
      <TableCell><GapStatusBadge status={gapStatus(r)} /></TableCell>
      <TableCell className="num hidden text-right lg:table-cell">
        {a1c === null ? <span className="text-muted-foreground">No result</span> : `${a1c.toFixed(1)}%`}
      </TableCell>
      <TableCell>
        {r.last_a1c_date ? (
          <div className="flex flex-col">
            <span>{dateOrDash(r.last_a1c_date)}</span>
            {late !== null && <span className="num text-xs text-muted-foreground">{fmt(late)} days overdue</span>}
          </div>
        ) : (
          <span className="text-muted-foreground">
            <span aria-hidden>—</span><span className="sr-only">Never tested</span>
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>{dateOrDash(r.last_encounter_date)}</span>
          <span className="text-xs text-muted-foreground">{settingLabel(r.unit)}</span>
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {r.on_insulin ? <InsulinBadge /> : (
          <span className="text-muted-foreground">
            <span aria-hidden>—</span><span className="sr-only">No insulin documented</span>
          </span>
        )}
      </TableCell>
      <TableCell className="pr-4 text-right">{review(r)}</TableCell>
    </TableRow>
  );
}

function GapCard({ r, review }: { r: PatientRow; review: Review }) {
  const late = daysOverdue(r);
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-mono text-sm"><span className="text-muted-foreground">MRN </span>{shortMrn(r)}</span>
          <span className="text-xs text-muted-foreground">Age {String(r.age)}</span>
        </div>
        <GapStatusBadge status={gapStatus(r)} />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          <span>
            {late !== null
              ? <><span className="num font-medium text-foreground">{fmt(late)}</span> days overdue</>
              : r.last_a1c_date ? <>Last A1c {dateOrDash(r.last_a1c_date)}</> : <>No A1c result on file</>}
          </span>
          <span className="text-xs">Last seen {dateOrDash(r.last_encounter_date)} · {settingLabel(r.unit)}</span>
        </div>
        {review(r)}
      </div>
    </li>
  );
}
