import { CircleAlert } from "lucide-react";

import { gold } from "@/lib/data";
import { Page } from "@/components/shell/Page";
import { EmptyState } from "@/components/shell/EmptyState";

export const metadata = { title: "Care Gaps" };

export default function CareGapsPage() {
  return (
    <Page
      title="Care Gaps"
      description="Review and prioritize patients with potential A1c monitoring gaps."
    >
      <EmptyState
        icon={CircleAlert}
        title="The care-gap work queue"
        description="A focused list of the patients whose A1c is overdue, ranked by urgency, where each gap can be reviewed and worked through to closure."
        note={`Not built yet. The Patients list already shows all ${gold.open_gaps} open gaps, most overdue first, and opens any patient's record.`}
        links={[
          { href: "/patients", label: "Patients", about: "Every patient in the cohort, open gaps first." },
          { href: "/overview", label: "Overview", about: "How the gaps break down by age band and care setting." },
        ]}
      />
    </Page>
  );
}
