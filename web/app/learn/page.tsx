import Link from "next/link";

import { LEARN_MODULES } from "@/lib/learn";
import { Page } from "@/components/shell/Page";
import { StatusBadge } from "@/components/shell/StatusBadge";

export const metadata = { title: "Learn" };

/**
 * Four modules, none written yet, each pointing at what already covers part of
 * it. Driven by lib/learn.ts so a module goes live by gaining an `href`.
 */
export default function LearnPage() {
  return (
    <Page
      title="Learn"
      description="Understand diabetes, A1c care gaps, the application, and the data underneath it."
    >
      <ul className="grid gap-4 md:grid-cols-2">
        {LEARN_MODULES.map((m, i) => (
          <li key={m.slug} className="flex flex-col gap-4 rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="num text-xs font-medium text-muted-foreground">Module {i + 1}</span>
                <h2 className="text-base font-semibold tracking-tight">
                  {m.href ? (
                    <Link href={m.href} className="hover:underline">{m.title}</Link>
                  ) : (
                    m.title
                  )}
                </h2>
              </div>
              <StatusBadge
                tone={m.href ? "success" : "info"}
                label={m.href ? "Available" : "Planned"}
              />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{m.summary}</p>
            {!m.href && m.today.length > 0 && (
              <div className="mt-auto flex flex-col gap-1.5 border-t pt-3">
                <span className="text-xs font-medium text-muted-foreground">Covered in part today by</span>
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {m.today.map((t) => (
                    <li key={t.href + t.label}>
                      <Link
                        href={t.href}
                        className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {t.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Page>
  );
}
