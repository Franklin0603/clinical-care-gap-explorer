"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";

import { PatientRow, fmt, patients } from "@/lib/data";
import { gapStatus } from "@/lib/cohort";
import { longDate } from "@/lib/dates";
import { GapStatusBadge } from "@/components/GapStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PatientDetailSheet } from "@/app/patients/PatientDetail";

/**
 * The first few open gaps, with a way into each record.
 *
 * Review opens the same patient drawer the Patients page uses, so a record
 * looks the same whichever page it was opened from and there is one detail
 * view to maintain. Below md the table becomes a list of cards; each card keeps
 * the patient, the status, the one timing fact that matters and Review.
 */

const mrn = (r: PatientRow) => String(r.mrn).slice(0, 8);

/** Last A1c as value and date, or a plain statement that there is none.
 *  Never a blank or a zero: a missing result is the finding. */
function lastA1c(r: PatientRow) {
  if (r.last_a1c_date === null || r.last_a1c_date === undefined) return null;
  const v = r.last_a1c_value === null || r.last_a1c_value === undefined ? null : Number(r.last_a1c_value);
  return { value: v === null ? null : `${v.toFixed(1)}%`, date: longDate(String(r.last_a1c_date)) };
}

/** Days overdue exists only for a patient with an earlier result. For the
 *  never tested there is no due date to be late against, so it says so. */
function overdue(r: PatientRow) {
  return r.days_overdue === null || r.days_overdue === undefined ? null : Number(r.days_overdue);
}

export function AttentionList({ rows }: { rows: PatientRow[] }) {
  const [open, setOpen] = useState<PatientRow | null>(null);
  // The drawer is opened from code, not from a dialog trigger, so on close it
  // has nowhere to send focus and drops it on the page. Keyboard users would
  // land back at the top; this returns them to the Review they pressed.
  const opener = useRef<HTMLButtonElement | null>(null);
  const close = () => {
    setOpen(null);
    setTimeout(() => opener.current?.focus(), 0);
  };

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-10 text-center">
        <CircleCheck className="size-6 text-status-success" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold">No open A1c gaps</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Every patient in the cohort has an A1c result within the last twelve months.
          </p>
        </div>
        <Link
          href="/patients"
          className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          View all patients
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    );
  }

  const review = (r: PatientRow) => (
    <Button variant="outline" size="sm" onClick={(e) => { opener.current = e.currentTarget; setOpen(r); }}>
      Review<span className="sr-only"> patient {mrn(r)}</span>
      <ArrowRight aria-hidden />
    </Button>
  );

  return (
    <>
      {/* md and up: a table. Last seen gives way first on a tablet. */}
      <div className="hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Patient</TableHead>
              <TableHead>A1c status</TableHead>
              <TableHead>Last A1c</TableHead>
              <TableHead className="text-right">Days overdue</TableHead>
              <TableHead className="hidden lg:table-cell">Last seen</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Action</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const a1c = lastA1c(r);
              const late = overdue(r);
              return (
                <TableRow key={String(r.patient_id)}>
                  <TableCell className="pl-4">
                    <div className="flex flex-col">
                      <span className="font-mono text-sm"><span className="text-muted-foreground">MRN </span>{mrn(r)}</span>
                      <span className="text-xs text-muted-foreground">Age {String(r.age)}</span>
                    </div>
                  </TableCell>
                  <TableCell><GapStatusBadge status={gapStatus(r)} /></TableCell>
                  <TableCell>
                    {a1c ? (
                      <div className="flex flex-col">
                        <span className="num">{a1c.value ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">{a1c.date}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No result</span>
                    )}
                  </TableCell>
                  <TableCell className="num text-right">
                    {late === null ? (
                      <span className="text-muted-foreground">
                        <span aria-hidden>—</span>
                        <span className="sr-only">Not applicable, never tested</span>
                      </span>
                    ) : (
                      fmt(late)
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {longDate(r.last_encounter_date as string | null) ?? "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right">{review(r)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Below md: one card per patient. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => {
          const a1c = lastA1c(r);
          const late = overdue(r);
          return (
            <li key={String(r.patient_id)} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <span className="font-mono text-sm"><span className="text-muted-foreground">MRN </span>{mrn(r)}</span>
                  <span className="text-xs text-muted-foreground">Age {String(r.age)}</span>
                </div>
                <GapStatusBadge status={gapStatus(r)} />
              </div>
              <div className="flex items-end justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {late !== null
                    ? <><span className="num font-medium text-foreground">{fmt(late)}</span> days overdue</>
                    : a1c
                      ? <>Last A1c {a1c.date}</>
                      : <>No A1c result on file</>}
                </p>
                {review(r)}
              </div>
            </li>
          );
        })}
      </ul>

      <PatientDetailSheet patient={open} cohort={patients} onClose={close} />
    </>
  );
}
