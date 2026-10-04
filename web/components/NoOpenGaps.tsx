import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";

/** What a gap list shows when the cohort has no open gaps at all - as distinct
 *  from filters that happen to match nobody, which each list handles itself. */
export function NoOpenGaps() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-10 text-center">
      <CircleCheck className="size-6 text-status-success" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold">No open A1c gaps</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Every patient in the cohort has an A1c result within the last twelve months.
        </p>
      </div>
      <Link
        href="/patients"
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        View all patients
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
