"use client";

import { ReactNode } from "react";
import { GLOSSARY } from "@/lib/glossary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * A clinical term with its definition one tap away.
 *
 * The reason this exists rather than a glossary page alone: somebody reading
 * the Overview who hits "cohort" wants to know what it means without leaving
 * the page they are on. A glossary they have to navigate to gets read by
 * nobody, and a dashboard full of unexplained vocabulary gets closed.
 *
 *   <Term k="a1c" /> renders the term's own name
 *   <Term k="cohort">these 116 patients</Term> renders your words instead
 */
export function Term({ k, children }: { k: string; children?: ReactNode }) {
  const entry = GLOSSARY[k];
  if (!entry) return <>{children ?? k}</>;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-4 transition-colors hover:decoration-primary"
          />
        }
      >
        {children ?? entry.term}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-sm">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{entry.term}</span>
            {entry.tag && (
              <span className="font-mono text-xs text-muted-foreground">{entry.tag}</span>
            )}
          </div>
          <p className="leading-relaxed text-muted-foreground">{entry.short}</p>
          {entry.long && (
            <p className="border-t pt-2 text-xs leading-relaxed text-muted-foreground">
              {entry.long}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
