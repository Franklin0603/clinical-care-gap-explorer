import { gold, patients } from "@/lib/data";
import { cohortSummary } from "@/lib/cohort";
import { Page } from "@/components/shell/Page";
import { CareGapsView } from "./CareGapsView";

export const metadata = { title: "Care Gaps" };

const summary = cohortSummary(patients, gold.asof);

export default function CareGapsPage() {
  const n = summary.openGaps;
  return (
    <Page
      title="Care Gaps"
      description={
        n === 0
          ? "No patient currently has an A1c monitoring gap."
          : `${n} ${n === 1 ? "patient currently has" : "patients currently have"} an A1c monitoring gap.`
      }
      width="wide"
    >
      <CareGapsView />
    </Page>
  );
}
