"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Database, Info, Loader2, Sparkles, Terminal, User } from "lucide-react";

import { Role, roleMeta, defaultRole } from "@/lib/data";
import { CHIPS, Chip, matchIntent, checkScope, REFUSAL } from "@/lib/chips";
import { connect, guardSelectOnly, run, QueryResult } from "@/lib/sql";
import { Page } from "@/components/shell/Page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const ROLES: Role[] = ["pct", "nurse", "physician"];
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Turn =
  | { who: "you"; text: string }
  | { who: "it"; sql: string | null; result: Extract<QueryResult, { ok: true }> | null; reason?: string };

export default function AskView() {
  const [role, setRole] = useState<Role>(defaultRole);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  // Keyed by role rather than reset on role change: a settled status belongs to the
  // role it was settled for, so switching role reads as "loading" without an effect
  // having to synchronously set it back (react-hooks/set-state-in-effect).
  const [settled, setSettled] = useState<{ role: Role; status: "ready" | "error" } | null>(null);
  const engine = settled?.role === role ? settled.status : "loading";
  const conn = useRef<Awaited<ReturnType<typeof connect>> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Reconnect on role change: the views are rebuilt over that role's own Parquet,
  // so a restricted column is genuinely absent rather than hidden.
  useEffect(() => {
    let live = true;
    conn.current = null;
    connect(role, BASE)
      .then((c) => { if (live) { conn.current = c; setSettled({ role, status: "ready" }); } })
      .catch(() => { if (live) setSettled({ role, status: "error" }); });
    return () => { live = false; };
  }, [role]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, busy]);

  async function execute(question: string, sql: string) {
    setTurns((t) => [...t, { who: "you", text: question }]);
    const guard = guardSelectOnly(sql);
    if (!guard.ok) {
      setTurns((t) => [...t, { who: "it", sql, result: null, reason: guard.reason }]);
      return;
    }
    if (!conn.current) {
      setTurns((t) => [...t, { who: "it", sql, result: null, reason: "The query engine is still loading. Try again in a moment." }]);
      return;
    }
    setBusy(true);
    const result = await run(conn.current, guard.sql);
    setBusy(false);
    setTurns((t) => [
      ...t,
      result.ok
        ? { who: "it", sql: guard.sql, result }
        : { who: "it", sql: guard.sql, result: null, reason: result.reason },
    ]);
  }

  function ask(raw: string) {
    const q = raw.trim();
    if (!q) return;
    setInput("");
    if (/^\s*(select|with|drop|delete|insert|update|alter|create|truncate|grant|copy|attach|pragma)\b/i.test(q)) {
      void execute(q, q);
      return;
    }
    const outOfScope = checkScope(q);
    if (outOfScope) {
      setTurns((t) => [...t, { who: "you", text: q }, { who: "it", sql: null, result: null, reason: outOfScope }]);
      return;
    }
    const chip = matchIntent(q);
    if (!chip) {
      setTurns((t) => [...t, { who: "you", text: q }, { who: "it", sql: null, result: null, reason: REFUSAL }]);
      return;
    }
    void execute(q, chip.sql);
  }

  return (
    <Page
      title="Ask the data"
      blurb="Every answer shows the SQL that produced it"
      actions={
        <Select value={role} onValueChange={(v) => setRole((v ?? defaultRole) as Role)}>
          <SelectTrigger size="sm" className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {roleMeta[r].label} · {roleMeta[r].patients}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="flex min-h-[calc(100vh-18rem)] flex-col gap-6">
        {turns.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                What would you like to know about the cohort?
              </h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Ask in plain words. These are the questions a physician, a nurse or a
                care technician asks on the floor — pick one, or type your own.
              </p>
            </div>
            <div className="flex max-w-3xl flex-wrap justify-center gap-2">
              {CHIPS.slice(0, 6).map((c: Chip) => (
                <button
                  key={c.q}
                  onClick={() => void execute(c.q, c.sql)}
                  title={c.note}
                  className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  {c.q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {turns.map((turn, i) =>
              turn.who === "you" ? (
                <div key={i} className="flex justify-end gap-3">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {turn.text}
                  </div>
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="size-3.5" />
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Database className="size-3.5 text-primary" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    {turn.sql && (
                      <Card className="overflow-hidden p-0">
                        <div className="flex items-center gap-1.5 border-b bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                          <Terminal className="size-3" /> the SQL that ran
                        </div>
                        <pre className="overflow-x-auto px-3 py-2.5 font-mono text-xs leading-relaxed">
                          {turn.sql}
                        </pre>
                      </Card>
                    )}
                    {turn.reason ? (
                      <div className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5">
                        <Info className="mt-0.5 size-4 shrink-0 text-destructive" />
                        <p className="text-sm leading-relaxed">{turn.reason}</p>
                      </div>
                    ) : turn.result ? (
                      <Card className="overflow-hidden">
                        <div className="max-h-[26rem] overflow-auto">
                          <Table>
                            <TableHeader className="sticky top-0 bg-card">
                              <TableRow>
                                {turn.result.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {turn.result.rows.map((row, r) => (
                                <TableRow key={r}>
                                  {row.map((v, c) => (
                                    <TableCell key={c} className="num">
                                      {v === null ? <span className="text-muted-foreground">—</span> : String(v)}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
                          {turn.result.rows.length} row{turn.result.rows.length === 1 ? "" : "s"} ·{" "}
                          {turn.result.ms} ms · run in your browser
                        </div>
                      </Card>
                    ) : null}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex gap-3">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                </div>
                <span className="pt-1 text-sm text-muted-foreground">running…</span>
              </div>
            )}
            <div ref={bottom} />
          </div>
        )}

        <div className="sticky bottom-4 flex flex-col gap-2">
          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm"
          >
            <textarea
              id="ask-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); }
              }}
              rows={1}
              placeholder="Ask about these patients…"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} className="size-9 rounded-xl">
              <ArrowUp className="size-4" />
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-normal">
              {engine === "loading" && "loading query engine…"}
              {engine === "ready" && `${roleMeta[role].patients} patients · ${roleMeta[role].columns.length} columns visible`}
              {engine === "error" && "query engine unavailable"}
            </Badge>
            <span>
              A query builder, not a language model — there is no server to hold an
              API key. The SQL shown is the SQL that ran.
            </span>
          </div>
        </div>
      </div>
    </Page>
  );
}
