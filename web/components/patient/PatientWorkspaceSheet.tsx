"use client";

import Link from "next/link";
import { SquareArrowOutUpRight } from "lucide-react";

import { PatientRow } from "@/lib/data";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PatientWorkspace } from "./PatientWorkspace";

/** Where a review was opened from, carried to the full record so it can send
 *  the reader back to the same list. */
export type ReviewFrom = "home" | "care-gaps" | "patients";

export const recordHref = (r: PatientRow, from?: ReviewFrom) =>
  `/patients/${encodeURIComponent(String(r.patient_id))}/${from ? `?from=${from}` : ""}`;

/**
 * The workspace in a sheet: the quick-review host, opened by Review.
 *
 * Wide on purpose - a serious review surface, not a quick-view popover. The
 * width classes carry the component's own data-[side=right] prefix: a plain
 * sm:max-w-* loses to its data-[side=right]:sm:max-w-sm on specificity, and the
 * panel stayed 384px wide the first time this was tried. On a phone it is the
 * whole screen.
 */
export function PatientWorkspaceSheet({
  patient, cohort, from, onClose,
}: {
  patient: PatientRow | null;
  cohort: PatientRow[];
  from?: ReviewFrom;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!patient} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        className="w-full gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-[88vw] data-[side=right]:lg:w-[80vw] data-[side=right]:2xl:w-[min(75vw,100rem)]"
      >
        {patient && (
          <div className="flex flex-col gap-4 p-4 pr-12 sm:p-6 sm:pr-14">
            <SheetDescription className="sr-only">
              Patient workspace: A1c status, the evidence for it, and the patient&apos;s history.
            </SheetDescription>
            <PatientWorkspace
              patient={patient}
              cohort={cohort}
              Title={SheetTitle}
              actions={
                <Link
                  href={recordHref(patient, from)}
                  className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Open full record
                  <SquareArrowOutUpRight className="size-3.5" aria-hidden />
                </Link>
              }
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
