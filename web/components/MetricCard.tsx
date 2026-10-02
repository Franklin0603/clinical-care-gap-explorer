"use client";

import { ReactNode } from "react";
import { ArrowRight, Info } from "lucide-react";

import { cn } from "cn";
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
 */
export function MetricCard({
  label, value, caption, hint, action, actionLabel, tone = "default", active = false,
}: {
  label: string;
  value: ReactNode;
  caption: string;
  hint: string;
  action?: () => void;
  actionLabel?: string;
  tone?: "default" | "warn" | "bad";
  active?: boolean;
}) {
  const colour =
    tone === "bad" ? "text-destructive" : tone === "warn" ? "text-chart-2" : "text-foreground";

  return (
    <Card className={cn("gap-0 py-0", active && "ring-2 ring-primary")}>
      <CardContent className="flex flex-col gap-3 p-5">
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
        </div>

        <div className={cn("num text-3xl font-semibold tracking-tight", colour)}>
          {value}
        </div>

        <div className="flex items-end justify-between gap-3">
          <span className="text-xs leading-relaxed text-muted-foreground">{caption}</span>
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
