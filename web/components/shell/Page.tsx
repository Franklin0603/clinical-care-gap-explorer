import { ReactNode } from "react";

import { cn } from "cn";
import { PageHeader } from "./PageHeader";

/**
 * A page: its header, then its content, on a consistent width and gutter.
 *
 * A <div>, not a <main>. SidebarInset already renders the page's <main>, and
 * this used to render a second one inside it - two main landmarks, nested,
 * which screen readers report as a malformed page.
 *
 * `width="wide"` is for operational tables, where the columns earn the space.
 * `blurb` is the older name for `description` and still works, so no existing
 * page had to change to move into the new shell.
 */
export function Page({
  title, description, blurb, actions, width = "default", children,
}: {
  title: string;
  description?: ReactNode;
  /** @deprecated use `description` */
  blurb?: ReactNode;
  actions?: ReactNode;
  width?: "default" | "wide";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-8 px-4 pb-20 pt-6 sm:px-6",
        width === "wide" ? "max-w-384" : "max-w-6xl",
      )}
    >
      <PageHeader title={title} description={description ?? blurb} actions={actions} />
      <div className="flex flex-col gap-8">{children}</div>
    </div>
  );
}

/** A titled region within a page. This is the SectionHeader the shell needed;
 *  it already existed, so it was kept rather than duplicated. */
export function Section({
  id, title, blurb, actions, children,
}: { id?: string; title: string; blurb?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {blurb && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{blurb}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
