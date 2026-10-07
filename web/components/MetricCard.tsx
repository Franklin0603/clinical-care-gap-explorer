"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";

import { cn } from "cn";
import { StatusBadge, StatusTone } from "@/components/shell/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * One figure, with what it means and somewhere to go.
 *
 * The action is a filter rather than a link. A number a reader cannot act on is
 * decoration, and these sit directly above the table the filter applies to, so
 * "47 above target" and the 47 rows are one click apart.
 *
 * Where the figure's rows live on another page, `href` makes the footer a link
 * there instead. `status` adds a worded badge; the value itself stays in the
 * neutral foreground colour then, so the colour is small and never the only
 * signal. `context` is a second, quieter line for a related figure.
 */
export function MetricCard({
  label, value, caption, hint, context, status, href, hrefLabel,
  action, actionLabel, tone = "default", active = false,
}: {
  label: string;
  value: ReactNode;
  caption: string;
  hint: string;
  context?: ReactNode;
  status?: { tone: StatusTone; label: string };
  href?: string;
  hrefLabel?: string;
  action?: () => void;
  actionLabel?: string;
  tone?: "default" | "warn" | "bad";
  active?: boolean;
}) {
  const colour =
    tone === "bad" ? "text-destructive" : tone === "warn" ? "text-chart-2" : "text-foreground";

  return (
    <Card className={cn("gap-0 py-0", active && "ring-2 ring-primary")}>
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={`What ${label} means`}
                    className="text-muted-foreground/60 transition-colors hover:text-foreground"
                  >
                    <Info className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent className="max-w-64 text-xs leading-relaxed">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {status && <StatusBadge tone={status.tone} label={status.label} className="ml-auto" />}
        </div>

        <div className={cn("num text-3xl font-semibold tracking-tight", colour)}>
          {value}
        </div>

        {context && <div className="text-xs leading-relaxed text-muted-foreground">{context}</div>}

        <div className="mt-auto flex items-end justify-between gap-3">
          <span className="text-xs leading-relaxed text-muted-foreground">{caption}</span>
          {href && (
            <Link
              href={href}
              className="flex shrink-0 items-center gap-1 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {hrefLabel ?? "View"}
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          )}
          {action && (
            <button
              type="button"
              onClick={action}
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition-opacity hover:opacity-70"
            >
              {active ? "Clear" : actionLabel ?? "Show"}
              <ArrowRight className="size-3" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
