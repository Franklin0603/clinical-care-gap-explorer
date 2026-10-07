import { Info } from "lucide-react";

import { HowItWorks } from "@/components/learn/HowItWorks";
import { IllustrationSlot, LearnModulePage, LearnSection } from "@/components/learn/LearnBits";

export const metadata = { title: "For Care Teams" };

/**
 * How a hypothetical care-team member might use the application, step by
 * step, with the line between clinical source data and demo workflow data
 * drawn at every step. #how-it-works is the anchor Home links to.
 */
export default function CareTeamsModule() {
  return (
    <LearnModulePage slug="care-teams">
      <LearnSection title="A review, start to finish">
        <p>
          Imagine a nurse or care coordinator responsible for the diabetes population at a practice. Their
          question each week is the same: who has gone too long without an A1C, why, and what is being done
          about it. The application is organised around that question, in six steps.
        </p>
        <p>
          This is a hypothetical workflow for a demonstration built on synthetic data. It shows how the pieces
          fit together; it is not a protocol, and the application makes no clinical decisions.
        </p>
      </LearnSection>

      <IllustrationSlot id="workflow" />

      <section id="how-it-works" className="flex scroll-mt-20 flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">The workflow</h2>
        <HowItWorks />
      </section>

      <LearnSection title="Evidence first, workflow second">
        <p>
          Every gap rests on clinical source data: an A1C result and its date, or the absence of any result.
          The application derives the gap status from that data the same way on every page. Follow-up work is
          recorded separately, as workflow, and nothing recorded there can change the status. A completed task
          on an overdue patient is still an overdue patient until a new qualifying result arrives.
        </p>
      </LearnSection>

      <p className="flex max-w-prose items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        In this demo, task status, assignment, due dates, notes and workflow activity are application data saved in
        your browser only. They do not represent real outreach: no patient has been contacted, and nothing is sent
        anywhere.
      </p>
    </LearnModulePage>
  );
}
