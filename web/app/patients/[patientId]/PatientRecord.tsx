"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PatientRow, patients } from "@/lib/data";
import { PatientWorkspace } from "@/components/patient/PatientWorkspace";

/** Where "back" goes, by where the review started. Unknown or missing goes to
 *  Patients, the record's own list. */
const BACK: Record<string, { href: string; label: string }> = {
  home: { href: "/home", label: "Back to Home" },
  "care-gaps": { href: "/care-gaps", label: "Back to Care Gaps" },
  patients: { href: "/patients", label: "Back to Patients" },
  tasks: { href: "/tasks", label: "Back to Tasks" },
};

const linkClass =
  "inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function PatientRecord({ patient, from }: { patient: PatientRow; from: string | null }) {
  const back = BACK[from ?? ""] ?? BACK.patients;
  return (
    <>
      <Link href={back.href} className={linkClass}>
        <ArrowLeft className="size-3.5" aria-hidden />
        {back.label}
      </Link>
      <PatientWorkspace
        patient={patient}
        cohort={patients}
        unavailable={
          <Link href={back.href} className="inline-flex h-7 items-center rounded-md px-2.5 text-[0.8rem] font-medium text-primary hover:underline">
            {back.label}
          </Link>
        }
      />
    </>
  );
}

export function PatientRecordFromUrl({ patient }: { patient: PatientRow }) {
  return <PatientRecord patient={patient} from={useSearchParams().get("from")} />;
}
