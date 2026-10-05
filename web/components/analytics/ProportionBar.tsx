import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { fmt } from "@/lib/data";
import { pctText } from "@/lib/cohort";
import { cn } from "cn";

/**
 * Parts of one whole as a single bar, with every part also written out as a
 * row: label, what it means, count and share. The bar is decoration for the
 * eye (aria-hidden); the rows carry the numbers, so nothing depends on reading
 * a colour or a length. Drawn in CSS, so it renders in the static HTML with no
 * layout shift and no animation.
 *
 * The parts must be mutually exclusive and add up to `total` - the callers
 * pass statuses from gapStatus, which are.
 */
export type Part = {
  key: string;
  label: string;
  about?: string;
  n: number;
  /** A Tailwind background class for the bar segment and the legend dot. */
  tone: string;
  href?: string;
  hrefLabel?: string;
};

export function ProportionBar({ parts, total }: { parts: Part[]; total: number }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {parts.map((p) =>
          p.n > 0 ? <div key={p.key} className={p.tone} style={{ width: `${(p.n / total) * 100}%` }} /> : null,
        )}
      </div>
      <dl className="flex flex-col divide-y">
        {parts.map((p) => (
          <div key={p.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className={cn("size-2.5 shrink-0 rounded-full", p.tone)} aria-hidden />
            <dt className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{p.label}</span>
              {p.about && <span className="text-xs text-muted-foreground">{p.about}</span>}
            </dt>
            <dd className="num flex items-baseline gap-2 text-right">
              <span className="text-sm font-semibold">{fmt(p.n)}</span>
              <span className="w-12 text-xs text-muted-foreground">{pctText(p.n, total)}</span>
            </dd>
            {p.href && (
              <dd className="hidden min-w-28 shrink-0 whitespace-nowrap text-right sm:block">
                <Link
                  href={p.href}
                  className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {p.hrefLabel ?? "View"}
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </dd>
            )}
          </div>
        ))}
      </dl>
      {/* The links again, below the list, where a phone has room for them. */}
      {parts.some((p) => p.href) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 sm:hidden">
          {parts.filter((p) => p.href).map((p) => (
            <Link key={p.key} href={p.href!} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {p.hrefLabel ?? `View ${p.label.toLowerCase()}`}
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
