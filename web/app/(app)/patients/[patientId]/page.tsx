import { Suspense } from "react";

import { patients } from "@/lib/data";
import { shortMrn } from "@/lib/cohort";
import { PatientRecord, PatientRecordFromUrl } from "./PatientRecord";

/**
 * The full patient record, one static page per patient.
 *
 * A static export cannot render a route on request, so every patient in the
 * report is generated at build time and any other id is a 404
 * (dynamicParams = false) rather than an empty shell.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return patients.map((r) => ({ patientId: String(r.patient_id) }));
}

const find = (id: string) => patients.find((r) => String(r.patient_id) === decodeURIComponent(id));

export async function generateMetadata({ params }: { params: Promise<{ patientId: string }> }) {
  const r = find((await params).patientId);
  return { title: r ? `MRN ${shortMrn(r)}` : "Patient" };
}

export default async function PatientRecordPage({ params }: { params: Promise<{ patientId: string }> }) {
  const r = find((await params).patientId)!;
  return (
    <div className="mx-auto flex w-full max-w-384 flex-1 flex-col gap-6 px-4 pb-20 pt-6 sm:px-6">
      {/* ?from= is read on the client, so the page is prerendered with the
          default return link and swaps in the right one on load. */}
      <Suspense fallback={<PatientRecord patient={r} from={null} />}>
        <PatientRecordFromUrl patient={r} />
      </Suspense>
    </div>
  );
}
