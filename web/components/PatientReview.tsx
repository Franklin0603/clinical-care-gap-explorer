"use client";

import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { PatientRow, patients } from "@/lib/data";
import { shortMrn } from "@/lib/cohort";
import { Button } from "@/components/ui/button";
import { PatientWorkspaceSheet, ReviewFrom } from "@/components/patient/PatientWorkspaceSheet";

export { shortMrn };

/**
 * Review, wherever a list of patients offers it: a button per row, and the one
 * patient workspace every page shares, so a record looks the same from Home,
 * Care Gaps and Patients and there is one detail view to maintain.
 *
 * The sheet is opened from code rather than a dialog trigger, so on close it
 * has nowhere to send focus and drops it on the page; keyboard users would
 * land back at the top. This remembers what had focus when the sheet opened -
 * a Review button, or a patient identifier in the Patients table - and
 * returns there.
 */
export function usePatientReview(from: ReviewFrom) {
  const [open, setOpen] = useState<PatientRow | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  // The control that opened the sheet is passed in, not read from
  // document.activeElement: Safari does not focus a button on click, so the
  // active element can be whatever was focused before - a filter, say - and
  // closing the sheet would send focus there instead.
  const show = (r: PatientRow, from?: HTMLElement | null) => {
    const el = from ?? document.activeElement;
    opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
    setOpen(r);
  };

  const close = () => {
    setOpen(null);
    setTimeout(() => opener.current?.focus(), 0);
  };

  const button = (r: PatientRow) => (
    <Button variant="outline" size="sm" onClick={(e) => show(r, e.currentTarget)}>
      Review<span className="sr-only"> patient {shortMrn(r)}</span>
      <ArrowRight aria-hidden />
    </Button>
  );

  const drawer = <PatientWorkspaceSheet patient={open} cohort={patients} from={from} onClose={close} />;

  return { button, show, drawer };
}
