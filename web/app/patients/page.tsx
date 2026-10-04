import PatientView from "./PatientView";

export const metadata = {
  title: "Patients",
  description: "Every patient in the diabetic cohort, open A1c gaps first, with each patient's history a click away.",
};

export default function Page() {
  return <PatientView />;
}
