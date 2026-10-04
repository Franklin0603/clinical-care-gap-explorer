import { ChartNoAxesCombined } from "lucide-react";

import { Page } from "@/components/shell/Page";
import { EmptyState } from "@/components/shell/EmptyState";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <Page
      title="Analytics"
      description="Explore population-level A1c monitoring and care-gap trends."
    >
      <EmptyState
        icon={ChartNoAxesCombined}
        title="Population analytics"
        description="Gap rates over time, by age band and care setting, and how each part of the population is trending."
        note="The redesigned analytics area is not built yet. The current population dashboard is unchanged and still available."
        links={[
          { href: "/overview", label: "Overview", about: "Headline figures, gap rate by age band and care setting, and how the count would grow." },
        ]}
      />
    </Page>
  );
}
