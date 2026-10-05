import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "cn";

/**
 * The analytics card: a header (icon, title, one small control), then the
 * body in a fixed order - headline figure, one line of insight, the
 * visualisation, and a small note. Detail lives in hover tooltips and in the
 * note, not in paragraphs above the chart.
 */
export function ChartCard({
  icon: Icon, title, action, metric, insight, note, children, className, headingLevel = "h2",
}: {
  icon?: LucideIcon;
  title: string;
  action?: ReactNode;
  metric?: ReactNode;
  insight?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  const H = headingLevel;
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border bg-card shadow-xs", className)}>
      <header className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50">
              <Icon className="size-3.5 text-muted-foreground" aria-hidden />
            </span>
          )}
          <H className="truncate text-sm font-semibold">{title}</H>
        </div>
        {action}
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        {(metric || insight) && (
          <div className="flex flex-col gap-0.5">
            {metric && <div className="num text-2xl font-semibold tracking-tight">{metric}</div>}
            {insight && <p className="text-sm text-muted-foreground">{insight}</p>}
          </div>
        )}
        {children}
        {note && <div className="mt-auto text-xs leading-relaxed text-muted-foreground">{note}</div>}
      </div>
    </section>
  );
}

/** A small text action for a card header. */
export const headerLink =
  "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * The body of every data tooltip on the analytics page - the chart's and the
 * rate rows' - so they read as one design: a title, then label/value rows.
 */
export function DataTip({ title, rows }: { title: string; rows: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <div className="flex min-w-44 flex-col gap-1.5 text-xs">
      <div className="border-b pb-1.5 font-medium">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-4">
          <span className="text-muted-foreground">{r.label}</span>
          <span className={cn("num", r.strong && "font-semibold")}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Classes that turn the app's dark tooltip into the light data card. */
export const dataTipClass =
  "max-w-none rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md [&>:last-child]:hidden";
