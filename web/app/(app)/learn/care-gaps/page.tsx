import { gold } from "@/lib/data";
import { longDate } from "@/lib/dates";
import { videoById } from "@/lib/learn";
import { GapStatusBadge } from "@/components/GapStatusBadge";
import { Term } from "@/components/Term";
import { A1cTimeline } from "@/components/learn/A1cTimeline";
import { DataLayers } from "@/components/DataLayers";
import { AppLink, GoDeeper, LearnModulePage, LearnSection, VideoCard } from "@/components/learn/LearnBits";

export const metadata = { title: "Understanding A1C Care Gaps" };

/**
 * The application's monitoring logic in plain words. Every definition here is
 * the one the pipeline computes and every page shows (pipeline decision D6);
 * this page explains it and pictures it, and defines nothing new.
 */
const STATUSES = [
  {
    status: "current" as const,
    title: "Current",
    def: "An A1C result within the 365 days before the data date.",
    note: "No current monitoring gap. The next result is due 365 days after the last one.",
  },
  {
    status: "overdue" as const,
    title: "Overdue",
    def: "An earlier A1C result, but none in the 365 days before the data date.",
    note: "An open gap. Days overdue counts the days past those 365.",
  },
  {
    status: "never" as const,
    title: "Never tested",
    def: "No A1C result anywhere in the available data.",
    note: "An open gap. There is no days-overdue figure, because there is no earlier result to be late against.",
  },
];

export default function CareGapsModule() {
  return (
    <LearnModulePage slug="care-gaps">
      <LearnSection title="What is an A1C monitoring gap?">
        <p>
          A <Term k="care gap">care gap</Term> is routine care a patient qualifies for but has not received. In
          this application it is specific: a patient with diabetes who has no A1C result in the 365 days before
          the data date, {longDate(gold.asof)}. The rule follows the published <Term k="hedis">HEDIS</Term> idea
          of at least one A1C a year.
        </p>
        <p>
          A gap status identifies <strong className="font-medium">missing or outdated monitoring</strong> under
          that definition. It is not a diagnosis, and it says nothing about whether a patient&apos;s diabetes is
          well controlled: a patient with a gap may have excellent results that simply have not been repeated.
        </p>
        <GoDeeper title="Why a fixed data date?">
          <p>
            Every window is measured from the same <Term k="as-of date">data date</Term>, the day the synthetic
            data ends. Measured from the real calendar instead, every patient would drift into a gap as time
            passed and the numbers would describe the calendar rather than the data.
          </p>
          <p>
            Clinical guidance often suggests testing more than once a year; this measure checks only for at
            least one result in 365 days.
          </p>
        </GoDeeper>
      </LearnSection>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">The three statuses</h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {STATUSES.map((s) => (
            <li key={s.status} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <GapStatusBadge status={s.status} />
              <p className="text-sm font-medium">{s.def}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{s.note}</p>
            </li>
          ))}
        </ul>
        <p className="max-w-prose text-xs text-muted-foreground">
          Overdue and never tested are both open gaps. &ldquo;Never tested&rdquo; means no result in the
          available data, which may not hold a patient&apos;s complete history. An A1C exactly 365 days old still
          counts as current; at 366 days the patient is overdue.
        </p>
      </section>

      <A1cTimeline />

      {videoById("care-gap") && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Watch: the 365-day window in motion</h2>
          <p className="max-w-prose text-sm text-muted-foreground">A one-minute visual explanation of the definitions above.</p>
          <div className="max-w-2xl"><VideoCard video={videoById("care-gap")!} /></div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Clinical data, derived status, workflow</h2>
        <p className="max-w-prose text-sm leading-relaxed text-foreground/90">
          The application keeps three kinds of information apart, and every page labels which one you are looking
          at. A gap status is derived from clinical data; a task is never part of it.
        </p>
        <DataLayers />
      </section>

      <LearnSection title="What a gap status does not tell you">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Whether a test was ordered. The source has no orders table, so an ordered-but-missed test looks the same as no request at all.</li>
          <li>Whether a patient&apos;s diabetes is controlled. The status is about monitoring, not results.</li>
          <li>What should happen next for the patient. That is a clinical decision.</li>
          <li>Whether follow-up has closed the gap. Completing a task never changes the status; only a new qualifying result does.</li>
        </ul>
      </LearnSection>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">See it in the application</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <AppLink href="/care-gaps" label="Care Gaps" about="Every open gap, with the evidence for each." />
          <AppLink href="/analytics" label="Analytics" about="How the three statuses split the cohort." />
        </div>
      </section>
    </LearnModulePage>
  );
}
