import Link from "next/link";
import { ArrowRight, BarChart3, CircleAlert, House, ListChecks, Sparkles, UserRound, type LucideIcon } from "lucide-react";

import { videoById } from "@/lib/learn";
import { LearnModulePage, ScreenshotSlot, VideoCard } from "@/components/learn/LearnBits";

export const metadata = { title: "Using Care Gap Explorer" };

/**
 * A walkthrough of the six areas in the order a user moves through them.
 * Each says what the area is for and links to it; screenshots will replace
 * the slots. It points at the application rather than copying it.
 */
const AREAS: { icon: LucideIcon; name: string; href: string; for: string; use: string[] }[] = [
  {
    icon: House, name: "Home", href: "/home",
    for: "Where the population needs attention, at a glance.",
    use: ["See the cohort, open gaps, never tested and current in four figures", "Spot the first patients needing attention", "Jump to Care Gaps, Patients or Analytics"],
  },
  {
    icon: CircleAlert, name: "Care Gaps", href: "/care-gaps",
    for: "The work queue: every patient with an open A1c gap.",
    use: ["Filter by never tested or overdue, setting, age and insulin", "Work in Care Gaps order, never tested first", "Review any patient's evidence"],
  },
  {
    icon: UserRound, name: "Patient workspace", href: "/patients",
    for: "One patient: why they have their status, and their history.",
    use: ["Read the care-gap assessment and its evidence", "Inspect every A1c on file, testing per year, medications and procedures", "Open the follow-up task for the gap"],
  },
  {
    icon: ListChecks, name: "Tasks", href: "/tasks",
    for: "Follow-up on each open gap, as demo workflow data.",
    use: ["Move a task through review, outreach, scheduling and completion", "Assign it, set a due date and add a workflow note", "See its workflow activity"],
  },
  {
    icon: BarChart3, name: "Analytics", href: "/analytics",
    for: "How A1c monitoring is going across the whole cohort.",
    use: ["Coverage and the make-up of the gaps", "Gap rates by age band and care setting, with their denominators", "Testing over time and the spread of latest results"],
  },
  {
    icon: Sparkles, name: "Ask AI", href: "/ask",
    for: "Questions about the cohort, in plain words.",
    use: ["Ask how many, which patients, or how groups compare", "Follow up on the last answer", "Ask how an answer was calculated"],
  },
];

export default function UsingTheAppModule() {
  return (
    <LearnModulePage slug="using-the-app">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">The route through the application</h2>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Order of the walkthrough">
          {AREAS.map((a, i) => (
            <li key={a.name} className="flex items-center gap-2">
              <a href={`#${a.name.toLowerCase().replace(/\s+/g, "-")}`} className="rounded-md border bg-card px-2 py-1 font-medium hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">{a.name}</a>
              {i < AREAS.length - 1 && <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />}
            </li>
          ))}
        </ol>
      </section>

      <ol className="flex flex-col gap-8">
        {AREAS.map((a, i) => (
          <li key={a.name} id={a.name.toLowerCase().replace(/\s+/g, "-")} className="grid scroll-mt-20 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg border bg-primary/5">
                  <a.icon className="size-4 text-primary" aria-hidden />
                </span>
                <div>
                  <span className="num text-xs text-muted-foreground">Step {i + 1}</span>
                  <h2 className="text-lg font-semibold leading-tight tracking-tight">{a.name}</h2>
                </div>
              </div>
              <p className="max-w-prose text-sm font-medium">{a.for}</p>
              <ul className="flex max-w-prose list-disc flex-col gap-1 pl-5 text-sm text-foreground/90">
                {a.use.map((u) => <li key={u}>{u}</li>)}
              </ul>
              <Link href={a.href} className="inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                Open {a.name} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            <ScreenshotSlot label={`${a.name} in Care Gap Explorer`} />
          </li>
        ))}
      </ol>

      {videoById("walkthrough") && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Watch the walkthrough</h2>
          <div className="max-w-md"><VideoCard video={videoById("walkthrough")!} /></div>
        </section>
      )}
    </LearnModulePage>
  );
}
