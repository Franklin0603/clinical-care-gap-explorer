import AskView from "./AskView";

export const metadata = {
  title: "Ask the Data",
  description: "Ask questions of the care-gap cohort. Every answer shows the SQL that produced it.",
};

export default function Page() {
  return <AskView />;
}
