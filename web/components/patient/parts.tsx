import { ReactNode } from "react";

import { cn } from "cn";

/** A titled block inside the workspace. Flat: a border, no shadow, so the
 *  workspace reads as one document rather than a stack of cards. */
export function Panel({
  title, description, actions, children, className, as: H = "h3",
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <H className="text-sm font-semibold">{title}</H>
          {description && (
            <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Label/value pairs, as a real description list. */
export function Facts({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((i) => (
        <div key={i.label} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className="text-sm">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Missing, said plainly in the muted colour. Never a blank or a zero. */
export const None = ({ children = "No result" }: { children?: ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);

/** An empty section, said as a sentence rather than drawn as an empty chart. */
export function NoData({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-dashed px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{children}</p>}
    </div>
  );
}
