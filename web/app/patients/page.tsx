import PatientView from "./PatientView";

export const metadata = {
  title: "Patient Care — Clinical Care Gap Explorer",
  description: "The care-gap cohort, scoped by clinical role. Models minimum-necessary access.",
};

export default function Page() {
  return <PatientView />;
}
