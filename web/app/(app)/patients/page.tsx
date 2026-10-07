import { Suspense } from "react";

import { fmt, patients } from "@/lib/data";
import { Page } from "@/components/shell/Page";
import { PatientDirectoryFromUrl, PatientDirectoryStatic } from "./PatientDirectory";

export const metadata = {
  title: "Patients",
  description: "Every patient in the diabetic cohort, searchable by MRN, with each patient's A1c status and history a click away.",
};

export default function PatientsPage() {
  const n = patients.length;
  return (
    <Page
      title="Patients"
      description="Search the diabetes cohort and review each patient's A1c monitoring status and available clinical history."
      actions={
        <span className="num text-sm text-muted-foreground">
          {fmt(n)} {n === 1 ? "patient" : "patients"} in the cohort
        </span>
      }
      width="wide"
    >
      {/* Filters live in the URL, read on the client; the prerendered page is
          the unfiltered register, so it is never a blank shell. What the
          record cannot tell you lives on Data & Quality, under limitations. */}
      <Suspense fallback={<PatientDirectoryStatic />}>
        <PatientDirectoryFromUrl />
      </Suspense>
    </Page>
  );
}
