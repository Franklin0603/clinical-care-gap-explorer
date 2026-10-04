import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { dq, recon } from "@/lib/data";
import { PIPELINE_SECTIONS } from "@/components/shell/nav";
import { Page, Section } from "@/components/shell/Page";
import { StatusBadge } from "@/components/shell/StatusBadge";

export const metadata = { title: "Data & Quality" };

/**
 * The way into the engineering work, kept out of the care workflow but one
 * click from it. Not a placeholder: every link lands on an existing section of
 * the Pipeline page, and the figures are the pipeline's own reports.
 */
export default function DataQualityPage() {
  const balanced = recon.every((r) => r.balances);

  return (
    <Page
      title="Data & Quality"
      description="How the data is loaded, checked and corrected before any of it reaches a care-gap list."
    >
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="success" label={`${dq.catch_rate_types} defect types caught`} />
        <StatusBadge tone="success" label={`${dq.catch_rate_rows} injected rows caught`} />
        <StatusBadge
          tone={balanced ? "success" : "danger"}
          label={balanced
            ? `Reconciles on all ${recon.length} tables`
            : `Reconciliation fails on ${recon.filter((r) => !r.balances).length} table(s)`}
        />
      </div>

      <Section
        title="The pipeline"
        blurb="Each part of the existing Pipeline page, in the order the data passes through it."
        actions={
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Open the full pipeline <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      >
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {PIPELINE_SECTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="group flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="text-sm text-muted-foreground">{s.about}</span>
                </span>
                <ArrowRight
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}
