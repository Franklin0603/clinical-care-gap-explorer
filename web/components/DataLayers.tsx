import { cn } from "cn";

/**
 * The three kinds of information the application keeps apart: what the
 * clinical source records, what the application derives from it, and the
 * demo workflow data saved in the browser. Shared by Learn and Data & Quality
 * so the two pages draw the line in the same place.
 */
export const LAYERS = [
  {
    key: "source",
    title: "Clinical source data",
    tone: "border-status-info/30",
    note: "From the synthetic healthcare source, through the pipeline.",
    items: ["Patient demographics", "Encounters and their care settings", "Diagnoses", "A1C observations, with dates and values", "Medications and their fill counts", "Procedures performed"],
  },
  {
    key: "derived",
    title: "Derived application data",
    tone: "border-border",
    note: "Calculated by Care Gap Explorer from the source.",
    items: ["Diabetes cohort membership", "Latest A1C and its date", "Monitoring status: current, overdue, never tested", "Open-gap indicator, days overdue, next due date", "Population metrics"],
  },
  {
    key: "workflow",
    title: "Demo workflow data",
    tone: "border-status-warning/30",
    note: "Saved in this browser only. Not part of the clinical source.",
    items: ["Task status and assignee", "Due dates and workflow notes", "Workflow activity history", "Ask AI conversations"],
  },
];

export function DataLayers({ className }: { className?: string }) {
  return (
    <ul className={cn("grid gap-3 md:grid-cols-3", className)}>
      {LAYERS.map((l) => (
        <li key={l.key} className={cn("flex flex-col gap-2 rounded-xl border-2 bg-card p-4", l.tone)}>
          <h3 className="text-sm font-semibold">{l.title}</h3>
          <p className="text-xs text-muted-foreground">{l.note}</p>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-foreground/85">
            {l.items.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </li>
      ))}
    </ul>
  );
}
