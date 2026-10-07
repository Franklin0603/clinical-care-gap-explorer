"use client";

import { PatientRow, fmt } from "@/lib/data";
import { daysOverdue, gapStatus, lastA1cValue } from "@/lib/cohort";
import { longDate } from "@/lib/dates";
import { GapStatusBadge } from "@/components/GapStatusBadge";
import { NoOpenGaps } from "@/components/NoOpenGaps";
import { shortMrn as mrn, usePatientReview } from "@/components/PatientReview";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

/**
 * The first few open gaps, with a way into each record.
 *
 * Review opens the same patient drawer the Patients page uses, so a record
 * looks the same whichever page it was opened from and there is one detail
 * view to maintain. Below md the table becomes a list of cards; each card keeps
 * the patient, the status, the one timing fact that matters and Review.
 */

/** Last A1C as value and date, or null - shown as "No result", never a
 *  blank or a zero: a missing result is the finding. */
function lastA1c(r: PatientRow) {
  if (!r.last_a1c_date) return null;
  const v = lastA1cValue(r);
  return { value: v === null ? null : `${v.toFixed(1)}%`, date: longDate(String(r.last_a1c_date)) };
}

export function AttentionList({ rows }: { rows: PatientRow[] }) {
  const { button: review, drawer } = usePatientReview("home");

  if (rows.length === 0) return <NoOpenGaps />;

  return (
    <>
      {/* md and up: a table. Last seen gives way first on a tablet. */}
      <div className="hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Patient</TableHead>
              <TableHead>A1C status</TableHead>
              <TableHead>Last A1C</TableHead>
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
              const late = daysOverdue(r);
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
          const late = daysOverdue(r);
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
                      ? <>Last A1C {a1c.date}</>
                      : <>No A1C result on file</>}
                </p>
                {review(r)}
              </div>
            </li>
          );
        })}
      </ul>

      {drawer}
    </>
  );
}
