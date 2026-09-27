"use client";

import { useEffect, useRef, useState } from "react";
import { Role, roleMeta, defaultRole } from "@/lib/data";
import { CHIPS, Chip, matchIntent, REFUSAL } from "@/lib/chips";
import { connect, guardSelectOnly, run, QueryResult } from "@/lib/sql";
import { Section, Card, Scroller, th, td } from "@/components/ui";

const ROLES: Role[] = ["pct", "nurse", "physician"];
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Entry = {
  at: string;
  role: Role;
  question: string;
  sql: string | null;
  rows: number | null;
  outcome: "answered" | "refused" | "failed";
  detail?: string;
};

type Answer =
  | { kind: "ok"; question: string; sql: string; result: Extract<QueryResult, { ok: true }> }
  | { kind: "refused"; question: string; sql: string | null; reason: string };

export default function AskView() {
  const [role, setRole] = useState<Role>(defaultRole);
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [log, setLog] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const conn = useRef<Awaited<ReturnType<typeof connect>> | null>(null);

  // Reconnect whenever the role changes: the views are rebuilt over that role's
  // own Parquet export, so a restricted column is genuinely absent, not hidden.
  useEffect(() => {
    let live = true;
    setEngine("loading");
    conn.current = null;
    connect(role, BASE)
      .then((c) => { if (live) { conn.current = c; setEngine("ready"); } })
      .catch(() => { if (live) setEngine("error"); });
    return () => { live = false; };
  }, [role]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ccg-audit");
      if (saved) setLog(JSON.parse(saved));
    } catch { /* storage unavailable; the log just starts empty */ }
  }, []);

  function record(e: Entry) {
    setLog((prev) => {
      const next = [e, ...prev].slice(0, 40);
      try { localStorage.setItem("ccg-audit", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  async function execute(question: string, sql: string) {
    const guard = guardSelectOnly(sql);
    if (!guard.ok) {
      setAnswer({ kind: "refused", question, sql, reason: guard.reason });
      record({ at: new Date().toISOString(), role, question, sql, rows: null, outcome: "refused", detail: guard.reason });
      return;
    }
    if (!conn.current) {
      setAnswer({ kind: "refused", question, sql, reason: "The query engine is still loading. Try again in a moment." });
      return;
    }
    setBusy(true);
    const result = await run(conn.current, guard.sql);
    setBusy(false);
    if (result.ok) {
      setAnswer({ kind: "ok", question, sql: guard.sql, result });
      record({ at: new Date().toISOString(), role, question, sql: guard.sql, rows: result.rows.length, outcome: "answered" });
    } else {
      setAnswer({ kind: "refused", question, sql: guard.sql, reason: result.reason });
      record({ at: new Date().toISOString(), role, question, sql: guard.sql, rows: null, outcome: "failed", detail: result.reason });
    }
  }

  function ask(raw: string) {
    const question = raw.trim();
    if (!question) return;
    // Looks like SQL? Run it through the guard. Otherwise match it to a question.
    if (/^\s*(select|with|drop|delete|insert|update|alter|create|truncate|grant|copy|attach|pragma)\b/i.test(question)) {
      void execute(question, question);
      return;
    }
    const chip = matchIntent(question);
    if (!chip) {
      setAnswer({ kind: "refused", question, sql: null, reason: REFUSAL });
      record({ at: new Date().toISOString(), role, question, sql: null, rows: null, outcome: "refused", detail: "No matching question" });
      return;
    }
    void execute(question, chip.sql);
  }

  return (
    <div className="pt-12">
      <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        Ask the data
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "var(--muted)" }}>
        Every answer shows the SQL that produced it, and that SQL runs in your
        browser against the same files the rest of the site reads. Only a single
        SELECT is allowed to run — you can try to break that below, and it is more
        interesting when you do.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            aria-pressed={role === r}
            className="rounded-md border px-3 py-1.5 text-sm font-medium"
            style={{
              borderColor: role === r ? "var(--blue)" : "var(--rule)",
              background: role === r ? "var(--blue-wash)" : "var(--surface)",
              color: role === r ? "var(--blue)" : "var(--muted)",
            }}
          >
            {roleMeta[r].label}
          </button>
        ))}
        <span className="text-xs" style={{ color: "var(--faint)" }}>
          {engine === "loading" && "loading query engine…"}
          {engine === "ready" && `${roleMeta[role].patients} patients, ${roleMeta[role].columns.length} columns visible`}
          {engine === "error" && "query engine unavailable — the preset answers still describe what it would return"}
        </span>
      </div>

      <form
        className="mt-5 flex flex-wrap gap-2"
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
      >
        <input
          id="ask-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question, or type a SELECT statement"
          className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--rule)", background: "var(--surface)", color: "var(--ink)" }}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: "var(--blue)", color: "#fff", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Running…" : "Ask"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((c: Chip) => (
          <button
            key={c.q}
            onClick={() => { setInput(c.q); void execute(c.q, c.sql); }}
            className="rounded-full border px-3 py-1.5 text-xs"
            style={{ borderColor: "var(--rule)", background: "var(--surface)", color: "var(--muted)" }}
            title={c.note}
          >
            {c.q}
          </button>
        ))}
      </div>

      {answer && (
        <Section title="Answer">
          <Card>
            <div className="border-b px-4 py-3 text-sm" style={{ borderColor: "var(--rule)" }}>
              <span style={{ color: "var(--faint)" }}>Question · </span>
              {answer.question}
            </div>
            {answer.sql && (
              <div className="border-b" style={{ borderColor: "var(--rule)" }}>
                <div className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                  SQL that ran
                </div>
                <Scroller>
                  <pre className="px-4 pb-3 pt-1 font-mono text-xs leading-relaxed" style={{ color: "var(--ink)" }}>{answer.sql}</pre>
                </Scroller>
              </div>
            )}
            {answer.kind === "refused" ? (
              <p className="px-4 py-4 text-sm leading-relaxed" style={{ color: "var(--orange)" }}>
                {answer.reason}
              </p>
            ) : (
              <>
                <Scroller>
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: "var(--blue-wash)" }}>
                        {answer.result.columns.map((c) => <th key={c} className={th}>{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {answer.result.rows.map((row, i) => (
                        <tr key={i} className="border-t" style={{ borderColor: "var(--rule)" }}>
                          {row.map((v, j) => (
                            <td key={j} className={`${td} num`}>
                              {v === null ? <span style={{ color: "var(--faint)" }}>—</span> : String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Scroller>
                <p className="px-4 py-2 text-xs" style={{ color: "var(--faint)" }}>
                  {answer.result.rows.length} row{answer.result.rows.length === 1 ? "" : "s"} · {answer.result.ms} ms · run in your browser
                </p>
              </>
            )}
          </Card>
        </Section>
      )}

      <Section
        title="Access log"
        lede="Every question is recorded with the role that asked it, the SQL, the row count and the outcome — refusals included. Attempted access matters as much as successful access, which is why a refused query still leaves a row."
      >
        <Card>
          {log.length === 0 ? (
            <p className="px-4 py-5 text-sm" style={{ color: "var(--muted)" }}>
              Nothing asked yet. Click a question above and it will appear here.
            </p>
          ) : (
            <Scroller>
              <table className="w-full">
                <thead>
                  <tr style={{ background: "var(--blue-wash)" }}>
                    <th className={th}>Time</th>
                    <th className={th}>Role</th>
                    <th className={th}>Question</th>
                    <th className={th}>Rows</th>
                    <th className={th}>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((e, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--rule)" }}>
                      <td className={`${td} num text-xs`} style={{ color: "var(--faint)" }}>
                        {e.at.slice(11, 19)}
                      </td>
                      <td className={td}>{roleMeta[e.role].label}</td>
                      <td className={td} style={{ color: "var(--muted)" }}>{e.question.slice(0, 60)}</td>
                      <td className={`${td} num`}>{e.rows ?? "—"}</td>
                      <td className={td}>
                        <span
                          className="rounded px-2 py-0.5 text-xs font-medium"
                          style={
                            e.outcome === "answered"
                              ? { background: "var(--blue-wash)", color: "var(--blue)" }
                              : { background: "var(--orange-wash)", color: "var(--orange)" }
                          }
                        >
                          {e.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroller>
          )}
        </Card>
      </Section>

      <Section title="How this works, and what it is not">
        <div className="max-w-2xl space-y-4 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          <p>
            <strong style={{ color: "var(--ink)" }}>This is a query builder, not a language model.</strong>{" "}
            The site is a static export with no server, so there is nowhere to hold
            an API key. The preset questions carry hand-written SQL, and the free-text
            box matches your wording against them by keyword. Anything it does not
            recognise gets a refusal naming what it can answer, rather than a guess.
          </p>
          <p>
            <strong style={{ color: "var(--ink)" }}>The SQL shown is the SQL that ran.</strong>{" "}
            DuckDB compiled to WebAssembly executes it in your browser against the
            Parquet files this site already ships. Copy any statement above and run
            it against the repo&apos;s warehouse — you will get the same rows.
          </p>
          <p>
            <strong style={{ color: "var(--ink)" }}>Only a single SELECT runs.</strong>{" "}
            The check is an allowlist on what the statement <em>is</em>, not a
            blocklist of words it must avoid: a blocklist rejects a harmless
            <code className="mx-1 font-mono text-xs">WHERE note LIKE &apos;%drop%&apos;</code>
            and still misses a keyword split by a comment. Stacked statements are
            refused too, because <code className="mx-1 font-mono text-xs">SELECT 1; DROP TABLE patients</code>
            starts with SELECT and would pass a check that reads only the first one.
          </p>
          <p>
            <strong style={{ color: "var(--ink)" }}>The role is enforced by the data.</strong>{" "}
            Switching role reloads a different Parquet file. Ask a PCT for an A1c
            value and the query fails because that column is not in the file — the
            same restriction as the patient page, in a place the UI cannot undo.
          </p>
        </div>
      </Section>
    </div>
  );
}
