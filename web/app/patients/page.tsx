import { Suspense } from "react";

import { fmt, patients } from "@/lib/data";
import { Page, Section } from "@/components/shell/Page";
import { PatientDirectoryFromUrl, PatientDirectoryStatic } from "./PatientDirectory";

export const metadata = {
  title: "Patients",
  description: "Every patient in the diabetic cohort, searchable by MRN, with each patient's A1c status and history a click away.",
};

/** Three things the record cannot tell you, kept from the earlier page because
 *  the patient workspace looks like a chart, and a chart invites conclusions
 *  it cannot support. */
const LIMITS = [
  {
    title: "No orders, anywhere",
    body: "A clinician can order an A1c and the patient never goes. This data records results and procedures that happened, never requests, so that patient is indistinguishable from one nobody ordered a test for. It is the single biggest thing a real deployment would add.",
  },
  {
    title: "Fills are not doses",
    body: "The medication history counts dispenses, because that is the only quantity the source exports. A rising fill count suggests a rising insulin burden; it does not measure one, and nothing here should be read as a dose.",
  },
  {
    title: "Columns are no longer scoped by role",
    body: "The pipeline still builds a separate export per role, and the access matrix and its tests still describe which fields a technician, a nurse and a physician may each see. That argument moved to the documentation; this page shows the whole record.",
  },
];

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
          the unfiltered register, so it is never a blank shell. */}
      <Suspense fallback={<PatientDirectoryStatic />}>
        <PatientDirectoryFromUrl />
      </Suspense>

      <Section title="What the record does not carry">
        <ul className="grid gap-4 lg:grid-cols-3">
          {LIMITS.map((c) => (
            <li key={c.title} className="flex flex-col gap-1.5 rounded-lg border bg-card p-4">
              <h3 className="text-sm font-medium">{c.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}
