import { ReactNode } from "react";
import { Syringe } from "lucide-react";

import { PatientRow, fmt } from "@/lib/data";
import { daysOverdue, lastA1cValue, settingLabel, shortMrn } from "@/lib/cohort";
import { longDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";

/**
 * How a patient's fields read in any list - Care Gaps, Patients, the
 * workspace. One implementation each, so a patient cannot show one A1c on one
 * page and another elsewhere, or "No result" here and a blank there.
 */

const muted = (text: ReactNode, sr?: string) => (
  <span className="text-muted-foreground">
    <span aria-hidden={sr ? true : undefined}>{text}</span>
    {sr && <span className="sr-only">{sr}</span>}
  </span>
);

/** The neutral insulin marker: a word, with the icon as decoration. Shown
 *  when an insulin prescription active on the data date is documented. */
export function InsulinBadge() {
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Syringe className="size-3" aria-hidden /> Insulin
    </Badge>
  );
}

/** Information only, never a control. */
export function InsulinCell({ r }: { r: PatientRow }) {
  return r.on_insulin ? <InsulinBadge /> : muted("—", "No active insulin documented");
}

/** MRN, optionally as the button that opens the record, with age beneath. */
export function PatientCell({ r, onOpen }: { r: PatientRow; onOpen?: (el: HTMLElement) => void }) {
  const id = (
    <>
      <span className="text-muted-foreground">MRN </span>
      {shortMrn(r)}
    </>
  );
  return (
    <div className="flex flex-col">
      {onOpen ? (
        <button
          type="button"
          onClick={(e) => onOpen(e.currentTarget)}
          className="w-fit rounded-sm text-left font-mono text-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {id}
          <span className="sr-only">, open patient record</span>
        </button>
      ) : (
        <span className="font-mono text-sm">{id}</span>
      )}
      <span className="text-xs text-muted-foreground">Age {String(r.age)}</span>
    </div>
  );
}

/** The latest A1c value, or "No result". Never 0, never blank. */
export function LatestA1c({ r }: { r: PatientRow }) {
  const v = lastA1cValue(r);
  return v === null ? muted("No result") : <span className="num">{v.toFixed(1)}%</span>;
}

/** The last test date, with days overdue beneath when the measure defines it. */
export function LastTest({ r }: { r: PatientRow }) {
  if (!r.last_a1c_date) return muted("—", "No A1c result on file");
  const late = daysOverdue(r);
  return (
    <div className="flex flex-col">
      <span className="num">{longDate(String(r.last_a1c_date))}</span>
      {late !== null && <span className="num text-xs text-muted-foreground">{fmt(late)} days overdue</span>}
    </div>
  );
}

/** Last seen, date first and the care setting beneath it. */
export function LastSeen({ r }: { r: PatientRow }) {
  return (
    <div className="flex flex-col">
      <span className="num">{longDate(r.last_encounter_date as string | null) ?? "—"}</span>
      <span className="text-xs text-muted-foreground">{settingLabel(r.unit)}</span>
    </div>
  );
}

/** The one timing fact a phone card has room for. */
export function TimingLine({ r }: { r: PatientRow }) {
  const late = daysOverdue(r);
  if (late !== null) return <><span className="num font-medium text-foreground">{fmt(late)}</span> days overdue</>;
  if (r.last_a1c_date) return <>Last A1c {longDate(String(r.last_a1c_date))}</>;
  return <>No A1c result on file</>;
}
