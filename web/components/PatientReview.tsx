"use client";

import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { PatientRow, patients } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { PatientDetailSheet } from "@/app/patients/PatientDetail";

export const shortMrn = (r: PatientRow) => String(r.mrn).slice(0, 8);

/**
 * Review, wherever a list of patients offers it: a button per row and the one
 * patient drawer the Patients page already uses, so a record looks the same
 * from every page and there is one detail view to maintain.
 *
 * The drawer is opened from code rather than a dialog trigger, so on close it
 * has nowhere to send focus and drops it on the page; keyboard users would
 * land back at the top. This returns them to the Review they pressed.
 */
export function usePatientReview() {
  const [open, setOpen] = useState<PatientRow | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  const close = () => {
    setOpen(null);
    setTimeout(() => opener.current?.focus(), 0);
  };

  const button = (r: PatientRow) => (
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => { opener.current = e.currentTarget; setOpen(r); }}
    >
      Review<span className="sr-only"> patient {shortMrn(r)}</span>
      <ArrowRight aria-hidden />
    </Button>
  );

  const drawer = <PatientDetailSheet patient={open} cohort={patients} onClose={close} />;

  return { button, drawer };
}
