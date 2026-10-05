import Link from "next/link";
import { ArrowRight, BookOpenText, Compass, Droplet, UsersRound, type LucideIcon } from "lucide-react";

import { LEARN_MODULES, VIDEOS } from "@/lib/learn";
import { Page, Section } from "@/components/shell/Page";
import { AppLink, VideoCard } from "@/components/learn/LearnBits";

export const metadata = { title: "Learn" };

const ICONS: Record<string, LucideIcon> = {
  diabetes: Droplet,
  "care-gaps": BookOpenText,
  "using-the-app": Compass,
  "care-teams": UsersRound,
};

/**
 * The Learn hub: four modules, the three videos, and a pointer to what the
 * data cannot tell you. Educational only: nothing here is advice about a
 * patient, and every definition is the one the rest of the app uses.
 */
export default function LearnPage() {
  return (
    <Page
      title="Learn"
      description="Understand diabetes, A1c monitoring, and how to use Care Gap Explorer."
    >
      <ul className="grid gap-4 md:grid-cols-2">
        {LEARN_MODULES.map((m, i) => {
          const Icon = ICONS[m.slug] ?? BookOpenText;
          return (
            <li key={m.slug}>
              <Link
                href={m.href}
                className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg border bg-primary/5">
                    <Icon className="size-5 text-primary" aria-hidden />
                  </span>
                  <span className="num text-xs font-medium text-muted-foreground">Module {i + 1}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-base font-semibold tracking-tight">{m.title}</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">{m.summary}</p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Start <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Section title="Videos" blurb="Three short videos to go with the modules. They are being produced and will appear here.">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VIDEOS.map((v) => <li key={v.id} className="flex"><VideoCard video={v} /></li>)}
        </ul>
      </Section>

      <Section title="About the project and its data" blurb="Why this application exists, and what the synthetic data behind every page can and cannot tell you.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AppLink href="/" label="Introduction" about="What this project is, and how the data gets from source to list." />
          <AppLink href="/data-quality#limitations" label="Data limitations" about="No orders table, fills are not doses, and how role-scoped exports work." />
          <AppLink href="/data-quality" label="Data & Quality" about="How the data is loaded, checked and corrected before it reaches a list." />
        </div>
      </Section>
    </Page>
  );
}
