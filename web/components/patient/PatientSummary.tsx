import { ComponentType, ReactNode } from "react";

import { PatientRow } from "@/lib/data";
import { gapStatus, lastA1cValue, settingLabel, shortMrn } from "@/lib/cohort";
import { longDate } from "@/lib/dates";
import { INSULIN_DOC_TEXT, InsulinDoc } from "@/lib/patientDetail";
import { GapStatusBadge } from "@/components/GapStatusBadge";
import { None } from "./parts";

/**
 * The patient's header and four summary tiles, shared by the patient
 * workspace and the task workspace so the same patient reads the same way in
 * both. Everything here is clinical source data, from the report row.
 */

export type TitleProps = { className?: string; children: ReactNode };
const H1 = ({ className, children }: TitleProps) => <h1 className={className}>{children}</h1>;

export function PatientHeader({
  patient: r, Title = H1, badges, actions,
}: {
  patient: PatientRow;
  Title?: ComponentType<TitleProps>;
  /** Extra badges after the gap status, e.g. a task status. */
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  const seen = longDate(r.last_encounter_date as string | null);
  const sex = r.sex === "M" ? "male" : r.sex === "F" ? "female" : null;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Title className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-semibold tracking-tight">
          <span className="font-mono">
            <span className="text-muted-foreground">MRN </span>{shortMrn(r)}
          </span>
          <GapStatusBadge status={gapStatus(r)} />
          {badges}
        </Title>
        <p className="text-sm text-muted-foreground">
          {String(r.age)}-year-old{sex ? ` ${sex}` : ""} · {settingLabel(r.unit)}
          {seen && <> · Last seen {seen}</>}
        </p>
      </div>
      {actions}
    </div>
  );
}

export function PatientSummaryTiles({ patient: r, insulin }: { patient: PatientRow; insulin: InsulinDoc }) {
  const status = gapStatus(r);
  const a1c = lastA1cValue(r);
  const seen = longDate(r.last_encounter_date as string | null);
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Patient summary">
      <Tile label="Gap status">
        <GapStatusBadge status={status} />
        <span className="text-xs text-muted-foreground">
          {status === "current" ? "No current A1C monitoring gap" : "Open A1C monitoring gap"}
        </span>
      </Tile>
      <Tile label="Latest A1C">
        {a1c === null ? (
          <span className="text-lg font-semibold"><None /></span>
        ) : (
          <span className="num text-lg font-semibold">{a1c.toFixed(1)}%</span>
        )}
        <span className="text-xs text-muted-foreground">
          {a1c === null ? "No qualifying result in the available data" : longDate(r.last_a1c_date as string)}
        </span>
      </Tile>
      <Tile label="Last seen">
        <span className="text-lg font-semibold">{seen ?? <None>Not recorded</None>}</span>
        <span className="text-xs text-muted-foreground">{settingLabel(r.unit)}</span>
      </Tile>
      <Tile label="Diabetes therapy">
        <span className="text-sm font-medium">{INSULIN_DOC_TEXT[insulin].short}</span>
        <span className="text-xs text-muted-foreground">In the available medication data</span>
      </Tile>
    </ul>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border bg-card p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </li>
  );
}
