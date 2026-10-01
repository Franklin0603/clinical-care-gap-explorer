import { ReactNode } from "react";
import { PageHeader } from "./PageHeader";

/** Every page is a sticky header plus a scrolling body on one max width. */
export function Page({
  title, blurb, actions, children,
}: { title: string; blurb?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} blurb={blurb} actions={actions} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-6">
        <div className="flex flex-col gap-8">{children}</div>
      </main>
    </>
  );
}

export function Section({
  id, title, blurb, actions, children,
}: { id?: string; title: string; blurb?: string; actions?: ReactNode; children: ReactNode }) {
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
