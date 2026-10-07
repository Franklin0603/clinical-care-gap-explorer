import type { ReactNode } from "react";

import { PatientRow, fmt, gold } from "@/lib/data";
import { daysOverdue, gapStatus, lastA1cValue, settingLabel } from "@/lib/cohort";
import { longDate } from "@/lib/dates";
import { GapStatusBadge } from "@/components/GapStatusBadge";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Facts, None, Panel } from "./parts";

/**
 * Why this patient has the A1C status they have, from the measure's own fields.
 *
 * The measure (pipeline decision D6): an open gap is no A1C result in the 365
 * days before the data date, and no result at all is a gap. Every figure here
 * is a column Gold computed - days overdue and the next due date included - so
 * nothing is recalculated in the browser and nothing is shown that the
 * measure does not define. In particular, a patient with no result has no
 * days-overdue figure, because there is no due date to be late against.
 *
 * The wording is evidence-aware throughout: "no qualifying result was found in
 * the available data", never "this patient has never been tested".
 */
export function CareGapAssessment({ patient: r, title }: { patient: PatientRow; title?: string }) {
  const status = gapStatus(r);
  const asof = longDate(gold.asof);
  const a1c = lastA1cValue(r);
  const lastTest = longDate(r.last_a1c_date as string | null);
  const seen = longDate(r.last_encounter_date as string | null);
  const setting = settingLabel(r.unit);
  const late = daysOverdue(r);

  const latest = a1c === null ? <None /> : <span className="num">{a1c.toFixed(1)}%</span>;

  if (status === "never") {
    return (
      <Panel
        as="h2"
        title={title ?? "A1C care-gap assessment"}
        actions={<StatusBadge tone="danger" label="Needs attention" />}
      >
        <Verdict status={status} summary="Open A1C monitoring gap">
          No qualifying A1C result was found for this patient in the available data.
          Under the measure, a patient with no A1C result on file has an open gap.
        </Verdict>
        <Facts
          items={[
            { label: "Latest A1C", value: <None /> },
            { label: "Last A1C date", value: <None /> },
            { label: "Last seen", value: seen ?? <None>Not recorded</None> },
            { label: "Care setting", value: setting },
          ]}
        />
      </Panel>
    );
  }

  if (status === "overdue") {
    return (
      <Panel
        as="h2"
        title={title ?? "A1C care-gap assessment"}
        actions={<StatusBadge tone="danger" label="Needs attention" />}
      >
        <Verdict status={status} summary="Open A1C monitoring gap">
          The most recent A1C in the available data is from {lastTest}, more than
          365 days before the data date ({asof}).
        </Verdict>
        <Facts
          items={[
            { label: "Latest A1C", value: latest },
            { label: "Last tested", value: lastTest },
            { label: "Days overdue", value: late === null ? <None>—</None> : <span className="num">{fmt(late)}</span> },
            { label: "Last seen", value: seen ?? <None>Not recorded</None> },
            { label: "Care setting", value: setting },
          ]}
        />
      </Panel>
    );
  }

  const due = longDate(r.next_due_date as string | null);
  return (
    <Panel
      as="h2"
      title={title ?? "A1C monitoring status"}
      actions={<StatusBadge tone="success" label="Up to date" />}
    >
      <Verdict status={status} summary="No current A1C monitoring gap">
        An A1C result from {lastTest} falls within the 365 days before the data date ({asof}).
      </Verdict>
      <Facts
        items={[
          { label: "Latest A1C", value: latest },
          { label: "Tested", value: lastTest },
          // next_due_date is Gold's: the last result plus the measure's 365 days.
          ...(due ? [{ label: "Next due", value: <>{due} <span className="text-xs text-muted-foreground">(365 days after the last result)</span></> }] : []),
        ]}
      />
    </Panel>
  );
}

function Verdict({ status, summary, children }: {
  status: ReturnType<typeof gapStatus>; summary: string; children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <GapStatusBadge status={status} />
        <span className="text-sm font-medium">{summary}</span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
