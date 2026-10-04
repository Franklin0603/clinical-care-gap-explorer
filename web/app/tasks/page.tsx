import { ListChecks } from "lucide-react";

import { Page } from "@/components/shell/Page";
import { EmptyState } from "@/components/shell/EmptyState";

export const metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <Page
      title="Tasks"
      description="Track follow-up work related to identified care gaps."
    >
      <EmptyState
        icon={ListChecks}
        title="Follow-up work"
        description="Calls, messages and orders made about a care gap, who made them, and whether the patient followed through."
        // Said plainly, because a Tasks page with anything in it would imply
        // patients had been contacted.
        note="Not built yet, and there is nothing to show: this dataset has no outreach, task or order records, so no patient has been contacted through this application."
        links={[
          { href: "/patients", label: "Patients", about: "Who would be on the list, once follow-up can be recorded." },
        ]}
      />
    </Page>
  );
}
