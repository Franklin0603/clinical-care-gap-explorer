"use client";

import { useState } from "react";
import {
  Role, roleMeta, roleRows, defaultRole, bands,
  COLUMN_LABELS, COLUMN_ORDER, PatientRow,
} from "@/lib/data";
import { Section, Card, Scroller, th, td } from "@/components/ui";

const ROLES: Role[] = ["pct", "nurse", "physician"];

function cell(row: PatientRow, key: string) {
  const v = row[key];
  if (v === null || v === undefined) return <span style={{ color: "var(--faint)" }}>—</span>;
  if (typeof v === "boolean") {
    if (key === "gap_flag")
      return v ? (
        <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ background: "var(--orange-wash)", color: "var(--orange)" }}>
          overdue
        </span>
      ) : (
        <span style={{ color: "var(--muted)" }}>current</span>
      );
    return v ? "yes" : "no";
  }
  if (key === "mrn" || key === "patient_id") return <span className="font-mono text-xs">{String(v).slice(0, 8)}</span>;
  return <span className="num">{String(v)}</span>;
}

export default function PatientView() {
  const [role, setRole] = useState<Role>(defaultRole);
  const meta = roleMeta[role];
  const rows = roleRows[role];

  // Columns the table shows: everything this role may see, plus a placeholder
  // for everything it may not. The restricted ones are absent from the payload -
  // this renders the *label*, never a value, because no value was sent.
  const visible = COLUMN_ORDER.filter((c) => meta.columns.includes(c));
  const restricted = COLUMN_ORDER.filter((c) => meta.restricted.includes(c));

  return (
    <div className="pt-12">
      <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        The care-gap list, scoped to what each role needs
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "var(--muted)" }}>
        This models the <strong style={{ color: "var(--ink)" }}>minimum necessary standard</strong> —
        the principle that a workforce member sees only the information their job
        requires. It is not HIPAA compliance, and there is no authentication: the
        selector below is a demonstration control.
      </p>

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Clinical role">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            aria-pressed={role === r}
            className="rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            style={{
              borderColor: role === r ? "var(--blue)" : "var(--rule)",
              background: role === r ? "var(--blue-wash)" : "var(--surface)",
              color: role === r ? "var(--blue)" : "var(--muted)",
            }}
          >
            {roleMeta[r].label}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-lg border p-5" style={{ borderColor: "var(--rule)", background: "var(--surface)" }}>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <span className="num text-2xl font-semibold" style={{ color: "var(--blue)" }}>{meta.patients}</span>
            <span className="ml-2 text-sm" style={{ color: "var(--muted)" }}>patients visible</span>
          </div>
          <div>
            <span className="num text-2xl font-semibold" style={{ color: "var(--orange)" }}>{meta.gaps}</span>
            <span className="ml-2 text-sm" style={{ color: "var(--muted)" }}>with an open gap</span>
          </div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            <strong style={{ color: "var(--ink)" }}>Scope:</strong> {meta.scope}
            {meta.units && ` — ${meta.units.join(", ")}`}
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          {meta.rationale}
        </p>
        {restricted.length > 0 && (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            <strong style={{ color: "var(--ink)" }}>{restricted.length} fields are withheld.</strong>{" "}
            They are not hidden in the browser — this role loads a different file,
            built by a query that never selected them. Open the network tab and
            read it: the fields are absent, not blank.
          </p>
        )}
      </div>

      <Section
        title="Patients"
        lede={`Showing the first 20 of ${rows.length}. Columns marked "not available" carry no value in this role's payload at all.`}
      >
        <Card>
          <Scroller>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--blue-wash)" }}>
                  {visible.map((c) => (
                    <th key={c} className={th}>{COLUMN_LABELS[c]}</th>
                  ))}
                  {restricted.map((c) => (
                    <th key={c} className={th} style={{ color: "var(--faint)", fontStyle: "italic" }}>
                      {COLUMN_LABELS[c]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--rule)" }}>
                    {visible.map((c) => (
                      <td key={c} className={td}>{cell(row, c)}</td>
                    ))}
                    {restricted.map((c) => (
                      <td
                        key={c}
                        className={`${td} text-xs italic`}
                        style={{ color: "var(--faint)", background: "var(--raised, transparent)" }}
                        title="Not available for this role"
                      >
                        not available
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        </Card>
      </Section>

      <Section
        title="Gap rate by age band"
        lede="Bands follow the HEDIS diabetes measure rather than round decades: it applies to members 18 to 75 and stratifies 18–64 and 65–75. The 76-plus band sits outside the measure's age range entirely, which is worth seeing rather than hiding."
      >
        <Card>
          <div className="p-5">
            {bands.map((b) => {
              const pct = Math.round((b.gaps / b.patients) * 100);
              return (
                <div key={b.band} className="flex items-center gap-3 py-2">
                  <div className="num w-16 shrink-0 text-sm font-medium">{b.band}</div>
                  <div className="h-6 flex-1 overflow-hidden rounded" style={{ background: "var(--blue-wash)" }}>
                    <div className="h-full" style={{ width: `${(b.patients / 51) * 100}%`, background: "var(--blue)", opacity: 0.25 }}>
                      <div className="h-full" style={{ width: `${(b.gaps / b.patients) * 100}%`, background: "var(--orange)" }} />
                    </div>
                  </div>
                  <div className="num w-28 shrink-0 text-right text-sm" style={{ color: "var(--muted)" }}>
                    {b.gaps} of {b.patients} · {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </Section>

      <Section title="How the restriction actually works">
        <div className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          <p>
            <strong style={{ color: "var(--ink)" }}>Filtering happens in the query layer, not the component.</strong>{" "}
            The site is a static export, so there is no request-time server. Instead
            the pipeline writes one payload per role, each produced by SQL that never
            selects the restricted columns and never returns out-of-unit rows. Hiding
            a column with CSS would not be access control; this is why the row counts
            change too, not only the columns.
          </p>
          <p>
            <strong style={{ color: "var(--ink)" }}>Column filtering alone would still leak.</strong>{" "}
            <code className="font-mono text-xs">next_due_date</code> is the last A1c
            date plus 365 days, and <code className="font-mono text-xs">days_overdue</code>{" "}
            is the same date in different clothes. Withhold the value but keep either
            one and the test date is reconstructable exactly, so the derived columns
            are restricted with the thing they were derived from.
          </p>
          <p>
            <strong style={{ color: "var(--ink)" }}>What this does not do.</strong>{" "}
            There is no authentication, so every role&apos;s file is reachable by anyone
            who guesses its URL. With a real system the same queries would sit behind
            a session and an authorization check. The part being demonstrated is where
            the restriction lives, not that this deployment is secure.
          </p>
        </div>
      </Section>
    </div>
  );
}
