"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Info, TriangleAlert } from "lucide-react";

import { PatientRow, fmt, patients } from "@/lib/data";
import { gapStatus, pctText, settingLabel, shortMrn } from "@/lib/cohort";
import { longDate } from "@/lib/dates";
import type { AssistantBlock } from "@/lib/ask/chats";
import { GapStatusBadge } from "@/components/GapStatusBadge";
import { InsulinCell, LastTest, LatestA1c } from "@/components/patient/cells";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

/**
 * How an answer looks. The interpreter decides what an answer is made of
 * (lib/ask/engine.ts); this file only draws each block, using the same cells
 * and badges as the rest of the app so a patient reads the same here as on
 * Care Gaps or Patients. Patient lists store ids and are drawn from the
 * source rows, so a saved conversation always shows current data.
 */

const byId = new Map(patients.map((r) => [String(r.patient_id), r]));
const PREVIEW = 10;

export function AnswerBlocks({ blocks, onAsk }: { blocks: AssistantBlock[]; onAsk: (q: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) => <BlockView key={i} b={b} onAsk={onAsk} />)}
    </div>
  );
}

function BlockView({ b, onAsk }: { b: AssistantBlock; onAsk: (q: string) => void }) {
  switch (b.kind) {
    case "text":
      return <p className="max-w-3xl text-sm leading-relaxed">{b.text}</p>;
    case "metric":
      return (
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="num text-3xl font-semibold tracking-tight">{b.value}</span>
            <span className="text-sm font-medium">{b.label}</span>
          </div>
          {b.detail && <p className="max-w-3xl text-xs text-muted-foreground">{b.detail}</p>}
        </div>
      );
    case "patients":
      return <PatientList ids={b.ids} />;
    case "patient":
      return <PatientCard id={b.id} />;
    case "groups":
      return (
        <ScrollTable caption={b.dimension === "age" ? "Open-gap rate by age band" : "Open-gap rate by care setting"}
          head={[b.dimension === "age" ? "Age band" : "Care setting", "Patients", "Open gaps", "Gap rate"]}
          numeric={[1, 2, 3]}
          rows={b.rows.map((r) => ({
            key: r.key,
            strong: r.key === b.highlight,
            cells: [
              <span key="l">
                {b.dimension === "age" ? r.key.replace("-", "–") : settingLabel(r.key)}
                {r.total > 0 && r.total < b.small && <span className="ml-1.5 text-xs text-muted-foreground">small group</span>}
              </span>,
              fmt(r.total), fmt(r.gaps), pctText(r.gaps, r.total),
            ],
          }))}
        />
      );
    case "years":
      return (
        <ScrollTable caption="A1C results recorded and patients tested, by year"
          head={["Year", "A1C results", "Patients tested"]}
          numeric={[1, 2]}
          rows={b.rows.map((r) => ({
            key: r.year,
            cells: [
              <span key="y">{r.year}{b.partial.includes(r.year) && <span className="ml-1.5 text-xs text-muted-foreground">partial year</span>}</span>,
              fmt(r.tests), fmt(r.patients),
            ],
          }))}
        />
      );
    case "table":
      return (
        <ScrollTable caption="Query result" head={b.columns}
          rows={b.rows.slice(0, 200).map((r, i) => ({ key: String(i), cells: r.map((c) => (c === null ? "—" : String(c))) }))} />
      );
    case "links":
      return (
        <div className="flex flex-wrap gap-2">
          {b.links.map((l) => (
            <Button key={l.href} variant="outline" size="sm" render={<Link href={l.href} />}>
              {l.label} <ArrowRight aria-hidden />
            </Button>
          ))}
        </div>
      );
    case "method":
      return (
        <dl className="flex max-w-3xl flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          {b.items.map((it) => (
            <div key={it.label} className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
              <dt className="text-xs font-medium text-muted-foreground">{it.label}</dt>
              <dd>{it.value}</dd>
            </div>
          ))}
        </dl>
      );
    case "sql":
      return <SqlBlock sql={b.sql} note={b.note} />;
    case "limitation":
      return (
        <p className="flex max-w-3xl items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3 text-sm leading-relaxed">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden />
          <span>{b.text}</span>
        </p>
      );
    case "suggestions":
      return b.items.length ? (
        <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Suggested follow-up questions">
          {b.items.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onAsk(q)}
              className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null;
  }
}

function PatientList({ ids }: { ids: string[] }) {
  const [all, setAll] = useState(false);
  const rows = ids.map((id) => byId.get(id)).filter((r): r is PatientRow => !!r);
  const shown = all ? rows : rows.slice(0, PREVIEW);
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <caption className="sr-only">Patients in this answer</caption>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-3">MRN</TableHead>
              <TableHead className="hidden sm:table-cell">Age</TableHead>
              <TableHead>Gap status</TableHead>
              <TableHead className="hidden sm:table-cell">Last seen</TableHead>
              <TableHead className="hidden md:table-cell">Care setting</TableHead>
              <TableHead className="pr-3 text-right"><span className="sr-only">Action</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => {
              const id = String(r.patient_id);
              const s = gapStatus(r);
              return (
                <TableRow key={id}>
                  <TableCell className="py-1.5 pl-3 font-mono text-sm">{shortMrn(r)}</TableCell>
                  <TableCell className="num hidden py-1.5 sm:table-cell">{String(r.age)}</TableCell>
                  <TableCell className="py-1.5"><GapStatusBadge status={s} /></TableCell>
                  <TableCell className="num hidden py-1.5 sm:table-cell">{longDate(r.last_encounter_date as string | null) ?? "—"}</TableCell>
                  <TableCell className="hidden py-1.5 md:table-cell">{settingLabel(r.unit)}</TableCell>
                  <TableCell className="py-1.5 pr-3 text-right">
                    <Link
                      href={`/patients/${encodeURIComponent(id)}/?from=ask`}
                      className="whitespace-nowrap rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className="sm:hidden">Open</span>
                      <span className="hidden sm:inline">{s === "current" ? "View patient" : "Review gap"}</span>
                      <span className="sr-only"> for MRN {shortMrn(r)}</span>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {rows.length > PREVIEW && (
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setAll((a) => !a)}>
          {all ? `Show the first ${PREVIEW}` : `Show all ${rows.length}`}
        </Button>
      )}
    </div>
  );
}

function PatientCard({ id }: { id: string }) {
  const r = byId.get(id);
  if (!r) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border bg-card p-3 text-sm sm:grid-cols-3">
      <Item label="Patient"><span className="font-mono">MRN {shortMrn(r)}</span> · age {String(r.age)}</Item>
      <Item label="Gap status"><GapStatusBadge status={gapStatus(r)} /></Item>
      <Item label="Latest A1C"><LatestA1c r={r} /></Item>
      <Item label="Last test"><LastTest r={r} /></Item>
      <Item label="Last seen">{longDate(r.last_encounter_date as string | null) ?? "—"} · {settingLabel(r.unit)}</Item>
      <Item label="Insulin"><InsulinCell r={r} /></Item>
    </dl>
  );
}

const Item = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-0.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd>{children}</dd></div>
);

function ScrollTable({ caption, head, rows, numeric = [] }: {
  caption: string; head: string[]; numeric?: number[];
  rows: { key: string; cells: ReactNode[]; strong?: boolean }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} scope="col" className={`px-3 py-2 font-medium ${numeric.includes(i) ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={`border-b last:border-0 ${r.strong ? "bg-primary/5 font-medium" : ""}`}>
              {r.cells.map((c, i) =>
                i === 0
                  ? <th key={i} scope="row" className="px-3 py-1.5 text-left font-normal">{c}</th>
                  : <td key={i} className={`num px-3 py-1.5 ${numeric.includes(i) ? "text-right" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SqlBlock({ sql, note }: { sql: string; note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 pr-10 font-mono text-xs leading-relaxed"><code>{sql}</code></pre>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-1.5 top-1.5"
          aria-label={copied ? "Copied" : "Copy query"}
          onClick={() => {
            navigator.clipboard?.writeText(sql).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="size-3" aria-hidden />{note}</p>
    </div>
  );
}
