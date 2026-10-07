"use client";

import { ReactNode, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

import { fmt, patients } from "@/lib/data";
import {
  AGE_BANDS, DIRECTORY_DEFAULTS, DirectoryState, PATIENT_SORTS, PatientSort, StatusFilter,
  cohortOptionCounts, filterPatients, gapStatus, readDirectory, settingLabel, sortPatients,
  writeDirectory,
} from "@/lib/cohort";
import { cn } from "cn";
import { GapStatusBadge } from "@/components/GapStatusBadge";
import { usePatientReview } from "@/components/PatientReview";
import {
  InsulinCell, LastSeen, LastTest, LatestA1c, PatientCell,
} from "@/components/patient/cells";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { longDate } from "@/lib/dates";

/**
 * The whole diabetic cohort as a register: search, filter, open a record.
 *
 * Not a work queue - that is Care Gaps. So the default order is the MRN, not
 * priority, and every patient is here whatever their status. Filtering and
 * sorting are lib/cohort.ts, the same functions Care Gaps uses, so the two
 * pages cannot disagree about who matches; the cells are
 * components/patient/cells.tsx, so they cannot disagree about what a patient's
 * fields say either.
 *
 * State lives in the address bar (?status=overdue&setting=ambulatory...), so a
 * view can be linked, refreshed, and walked back through with the browser's
 * back button. Filter changes push a history entry; typing in search replaces
 * the current one, so back does not step through every keystroke.
 */

const PAGE_SIZE = 25;

const SETTINGS = [...new Set(patients.map((r) => String(r.unit)))]
  .sort((a, b) => settingLabel(a).localeCompare(settingLabel(b)));

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Any status",
  current: "Current",
  gap: "Open gap",
  never: "Never tested",
  overdue: "Overdue",
};

const INSULIN_LABELS: Record<string, string> = {
  all: "Any insulin status",
  yes: "Active insulin documented",
  no: "No active insulin documented",
};

/** Base UI shows the raw value in a closed trigger unless given a formatter. */
const shown = (label: (v: string) => string) => (v: string | null) => label(v ?? "all");

type Set_ = (patch: Partial<DirectoryState>, how?: "push" | "replace") => void;

/** The directory bound to the URL. */
export function PatientDirectoryFromUrl() {
  const state = readDirectory(useSearchParams());
  const set: Set_ = (patch, how = "push") => {
    // Any change but paging returns to the first page of the new result.
    const next = { ...state, ...patch, page: patch.page ?? 1 };
    const qs = writeDirectory(next);
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (how === "replace") window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  };
  return <PatientDirectory state={state} set={set} />;
}

export function PatientDirectory({ state: s, set }: { state: DirectoryState; set: Set_ }) {
  const { button: review, show, drawer } = usePatientReview("patients");
  const top = useRef<HTMLDivElement>(null);

  const results = useMemo(() => sortPatients(filterPatients(patients, s), s.sort), [s]);
  const counts = useMemo(() => ({
    status: cohortOptionCounts(patients, s, "status", ["all", "current", "gap", "never", "overdue"]),
    setting: cohortOptionCounts(patients, s, "setting", SETTINGS),
    band: cohortOptionCounts(patients, s, "band", [...AGE_BANDS]),
    insulin: cohortOptionCounts(patients, s, "insulin", ["yes", "no"]),
  }), [s]);

  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(s.page, pages);
  const shownRows = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filtersOn = s.status !== "all" || s.setting !== "all" || s.band !== "all" || s.insulin !== "all";
  const searching = s.query.trim() !== "";
  const clearAll = () => set({ status: "all", setting: "all", band: "all", insulin: "all", query: "" });

  const goPage = (p: number) => {
    set({ page: p });
    top.current?.scrollIntoView({ block: "start" });
  };

  const segment = s.status === "all" ? "all" : s.status === "current" ? "current" : "gap";

  return (
    <div className="flex flex-col gap-4">
      {/* Population segments: three views of one cohort, not three datasets.
          Open gap stays selected while a gap sub-status is chosen below. */}
      <div role="group" aria-label="Population" className="flex w-fit flex-wrap gap-1 rounded-lg border bg-muted/50 p-1">
        {([
          ["all", "All"], ["current", "Current"], ["gap", "Open gap"],
        ] as const).map(([v, label]) => {
          const on = segment === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => set({ status: v })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span className="num text-xs text-muted-foreground">{counts.status.get(v)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={s.query}
            onChange={(e) => set({ query: e.target.value }, "replace")}
            placeholder="Search by MRN"
            aria-label="Search patients by MRN"
            className="h-8 pl-8"
          />
        </div>

        <Select value={s.status} onValueChange={(v) => set({ status: (v as StatusFilter | null) ?? "all" })}>
          <SelectTrigger aria-label="Gap status" className="min-w-36">
            <SelectValue>{shown((v) => STATUS_LABELS[v as StatusFilter] ?? v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((v) => (
              <SelectItem key={v} value={v}>
                {STATUS_LABELS[v]}
                {v !== "all" && <span className="num text-muted-foreground"> ({counts.status.get(v)})</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={s.setting} onValueChange={(v) => set({ setting: v ?? "all" })}>
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

        <Select value={s.band} onValueChange={(v) => set({ band: (v as DirectoryState["band"] | null) ?? "all" })}>
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

        <Select value={s.insulin} onValueChange={(v) => set({ insulin: (v as DirectoryState["insulin"] | null) ?? "all" })}>
          <SelectTrigger aria-label="Insulin documentation" className="min-w-40">
            <SelectValue>{shown((v) => INSULIN_LABELS[v] ?? v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{INSULIN_LABELS.all}</SelectItem>
            {(["yes", "no"] as const).map((v) => (
              <SelectItem key={v} value={v}>
                {INSULIN_LABELS[v]} <span className="num text-muted-foreground">({counts.insulin.get(v)})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-sm text-muted-foreground" id="patients-sort-label">Sort</span>
          <Select value={s.sort} onValueChange={(v) => set({ sort: (v as PatientSort | null) ?? "mrn" })}>
            <SelectTrigger aria-labelledby="patients-sort-label" className="min-w-44">
              <SelectValue>{shown((v) => PATIENT_SORTS[v as PatientSort] ?? v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PATIENT_SORTS) as PatientSort[]).map((k) => (
                <SelectItem key={k} value={k}>{PATIENT_SORTS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div ref={top} className="flex min-h-8 scroll-mt-20 items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {filtersOn || searching
            ? <><span className="num">{fmt(results.length)}</span> of <span className="num">{fmt(patients.length)}</span> patients</>
            : <><span className="num">{fmt(results.length)}</span> {results.length === 1 ? "patient" : "patients"}</>}
        </p>
        {(filtersOn || searching) && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X aria-hidden />
            Clear filters
          </Button>
        )}
      </div>

      {results.length === 0 ? (
        searching && !filtersOn ? (
          <Empty
            title="No patient found"
            body={<>No patient in this diabetes cohort matches &ldquo;{s.query.trim()}&rdquo;.</>}
            action="Clear search"
            onAction={() => set({ query: "" })}
          />
        ) : (
          <Empty
            title="No patients match these filters"
            body="Try changing or clearing one or more filters."
            action="Clear filters"
            onAction={clearAll}
          />
        )
      ) : (
        <>
          {/* md and up: the register. Last test and Insulin give way first. */}
          <div className="hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Patient</TableHead>
                  <TableHead>Gap status</TableHead>
                  <TableHead className="text-right">Latest A1c</TableHead>
                  <TableHead className="hidden lg:table-cell">Last test</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="hidden lg:table-cell">Insulin</TableHead>
                  <TableHead className="pr-4 text-right"><span className="sr-only">Action</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownRows.map((r) => (
                  <TableRow key={String(r.patient_id)}>
                    <TableCell className="py-1.5 pl-4"><PatientCell r={r} onOpen={(el) => show(r, el)} /></TableCell>
                    <TableCell className="py-1.5"><GapStatusBadge status={gapStatus(r)} /></TableCell>
                    <TableCell className="py-1.5 text-right"><LatestA1c r={r} /></TableCell>
                    <TableCell className="hidden py-1.5 lg:table-cell"><LastTest r={r} /></TableCell>
                    <TableCell className="py-1.5"><LastSeen r={r} /></TableCell>
                    <TableCell className="hidden py-1.5 lg:table-cell"><InsulinCell r={r} /></TableCell>
                    <TableCell className="py-1.5 pr-4 text-right">{review(r)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Below md: one compact card per patient. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {shownRows.map((r) => (
              <li key={String(r.patient_id)} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <PatientCell r={r} onOpen={(el) => show(r, el)} />
                  <GapStatusBadge status={gapStatus(r)} />
                </div>
                <div className="flex items-end justify-between gap-3">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                    <dt className="text-muted-foreground">Latest A1c</dt>
                    <dd><LatestA1c r={r} /></dd>
                    <dt className="text-muted-foreground">Last seen</dt>
                    <dd className="num">{longDate(r.last_encounter_date as string | null) ?? "—"}</dd>
                  </dl>
                  {review(r)}
                </div>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="num text-muted-foreground">
                {fmt((page - 1) * PAGE_SIZE + 1)}–{fmt(Math.min(page * PAGE_SIZE, results.length))} of {fmt(results.length)}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>
                  <ChevronLeft aria-hidden /> Previous
                </Button>
                <span className="num text-muted-foreground">Page {page} of {pages}</span>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => goPage(page + 1)}>
                  Next <ChevronRight aria-hidden />
                </Button>
              </div>
            </nav>
          )}
        </>
      )}

      {drawer}
    </div>
  );
}

function Empty({ title, body, action, onAction }: {
  title: string; body: ReactNode; action: string; onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-6 py-10 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
      <Button variant="outline" size="sm" className="mt-2" onClick={onAction}>{action}</Button>
    </div>
  );
}

/** Prerendered before the URL is known: the unfiltered register, inert until
 *  the client takes over, so the static HTML is never an empty shell. */
export function PatientDirectoryStatic() {
  return <PatientDirectory state={DIRECTORY_DEFAULTS} set={() => {}} />;
}
