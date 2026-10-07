import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

import { StatusBadge } from "./StatusBadge";

/**
 * A route that exists on purpose but is not built yet.
 *
 * The test for every placeholder is that it reads as intentional rather than
 * broken, and that it never pretends. So it says what the area is for, marks it
 * plainly as planned, and points at whatever already answers part of the
 * question today. No sample rows, no disabled buttons dressed as features, no
 * counts that imply work exists.
 */
export function EmptyState({
  icon: Icon, title, description, note, links = [],
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** One honest sentence about what is and is not there yet. */
  note?: string;
  links?: { href: string; label: string; about: string }[];
}) {
  return (
    <div className="flex flex-col gap-6 rounded-lg border border-dashed bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-muted">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <StatusBadge tone="info" label="Planned" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        {note && <p className="max-w-2xl text-sm leading-relaxed">{note}</p>}
      </div>

      {links.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Available today
          </h3>
          <ul className="flex flex-col divide-y rounded-md border">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="group flex items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{l.label}</span>
                    <span className="text-sm text-muted-foreground">{l.about}</span>
                  </span>
                  <ArrowRight
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
