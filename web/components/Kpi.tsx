import { cn } from "cn";

/** A compact headline figure: label, value, and a small context chip whose
 *  colour is reinforcement, never the only signal. Shared by Analytics and
 *  Tasks. */
export function Kpi({ label, value, context, tone }: {
  label: string; value: string; context?: string; tone?: "success" | "danger";
}) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3.5 shadow-xs">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="num text-2xl font-semibold tracking-tight">{value}</span>
        {context && (
          <span
            className={cn(
              "num rounded-md border px-1.5 py-0.5 text-xs",
              tone === "success" && "border-status-success/30 bg-status-success/10 text-status-success",
              tone === "danger" && "border-status-danger/30 bg-status-danger/10 text-status-danger",
              !tone && "bg-muted text-muted-foreground",
            )}
          >
            {context}
          </span>
        )}
      </div>
    </li>
  );
}
