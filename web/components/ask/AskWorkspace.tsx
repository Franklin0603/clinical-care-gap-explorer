"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  ArrowUp, History, Loader2, MessageSquarePlus, MoreHorizontal, PanelLeftClose, PanelLeftOpen,
  Pencil, Pin, PinOff, Sparkles, Trash2,
} from "lucide-react";

import { gold, patients } from "@/lib/data";
import { answer, Ctx } from "@/lib/ask/engine";
import {
  AssistantBlock, Message, appendMessages, createConversation, deleteConversation,
  renameConversation, setPinned, titleFromQuestion,
} from "@/lib/ask/chats";
import { mutateChats, newId, useChats } from "@/lib/ask/chatStore";
import { loadPatientDetail } from "@/lib/patientDetail";
import { connect, guardSelectOnly, run } from "@/lib/sql";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { AnswerBlocks } from "./AnswerBlocks";
import { HistoryPanel } from "./HistoryPanel";

/**
 * Ask AI: saved conversations on the left, the active conversation on the
 * right. Questions go to the interpreter in lib/ask/engine.ts with the
 * conversation's context, so follow-ups narrow the last answer. The answer
 * is stored as blocks with the conversation, in this browser.
 *
 * A message that is itself a SELECT statement runs, read-only, on the
 * in-browser query engine the earlier Ask page used - kept for anyone who
 * wants to check an answer, never shown unless asked for.
 */

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const DATA = { rows: patients, asof: gold.asof };

const START = [
  "Which patients have never had an A1c?",
  "How many patients currently have an open A1c gap?",
  "Which age group has the highest gap rate?",
  "Show patients with an open gap who were seen in the last 6 months",
];
const FIRST_RUN = [
  "Which patients have an open A1c gap?",
  "Which age group has the highest gap rate?",
  "How has A1c testing changed over time?",
];

let sqlConn: Promise<Awaited<ReturnType<typeof connect>>> | null = null;

async function runSql(sql: string): Promise<AssistantBlock[]> {
  const guard = guardSelectOnly(sql);
  if (!guard.ok) return [{ kind: "limitation", text: guard.reason }];
  try {
    sqlConn ??= connect(BASE);
    const res = await run(await sqlConn, guard.sql);
    if (!res.ok) return [{ kind: "limitation", text: res.reason }];
    return [
      { kind: "text", text: `${res.rows.length} ${res.rows.length === 1 ? "row" : "rows"}, run read-only in this browser.` },
      { kind: "table", columns: res.columns, rows: res.rows },
    ];
  } catch {
    sqlConn = null;
    return [{ kind: "limitation", text: "The in-browser query engine could not start. Try again in a moment." }];
  }
}

async function respond(q: string, ctx: Ctx): Promise<{ blocks: AssistantBlock[]; ctx: Ctx; title?: string }> {
  // Only read queries reach the SQL engine; anything else that looks like a
  // statement is refused by the interpreter.
  if (/^\s*(select|with)\b/i.test(q)) return { blocks: await runSql(q), ctx };
  let res = answer(q, ctx, DATA);
  if ("needs" in res) {
    try {
      res = answer(q, ctx, { ...DATA, history: await loadPatientDetail() });
    } catch {
      return { blocks: [{ kind: "limitation", text: "We couldn't load the A1c testing history. Try again in a moment." }], ctx };
    }
  }
  if ("needs" in res) return { blocks: [], ctx };
  return res;
}

export function AskWorkspace() {
  const state = useChats();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false); // phone / tablet sheet
  const [collapsed, setCollapsed] = useState(false);     // desktop panel
  const active = activeId ? state.conversations[activeId] ?? null : null;
  const hasAny = Object.keys(state.conversations).length > 0;

  const open = (id: string) => { setActiveId(id); setHistoryOpen(false); };
  const startNew = () => { setActiveId(null); setHistoryOpen(false); };

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    const now = () => new Date().toISOString();
    const ctx = active?.ctx ?? {};
    const userMsg: Message = { id: newId(), role: "user", text: q, at: now() };
    let id = activeId;
    if (!id || !state.conversations[id]) {
      id = newId();
      const created = id;
      mutateChats((s) => createConversation(s, created, now(), titleFromQuestion(q)));
      setActiveId(id);
    }
    const convId = id;
    mutateChats((s) => appendMessages(s, convId, [userMsg], ctx, now()));
    const res = await respond(q, ctx);
    mutateChats((s) => {
      let next = appendMessages(s, convId, [{ id: newId(), role: "assistant", blocks: res.blocks, at: now() }], res.ctx, now());
      // The first answer that knows what it was about names the conversation,
      // unless the user has already renamed it.
      const c = next.conversations[convId];
      if (res.title && c && c.title === titleFromQuestion(c.messages.find((m) => m.role === "user")?.text ?? "") &&
          c.messages.filter((m) => m.role === "user").length === 1) {
        next = renameConversation(next, convId, res.title);
      }
      return next;
    });
    setBusy(false);
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0">
      <h1 className="sr-only">Ask AI</h1>

      {/* Desktop: a persistent, collapsible panel. */}
      <aside
        aria-label="Chat history"
        className={cn("hidden w-72 shrink-0 border-r bg-sidebar/40 lg:block", collapsed && "lg:hidden")}
      >
        <HistoryPanel state={state} activeId={activeId} onOpen={open} onNew={startNew} />
      </aside>

      {/* Phone and tablet: the same panel in a sheet. */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-80 p-0 data-[side=left]:w-80">
          <SheetTitle className="sr-only">Chat history</SheetTitle>
          <SheetDescription className="sr-only">Saved Ask AI conversations</SheetDescription>
          <HistoryPanel state={state} activeId={activeId} onOpen={open} onNew={startNew} />
        </SheetContent>
      </Sheet>

      <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Show chat history" onClick={() => setHistoryOpen(true)}>
            <History aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden lg:inline-flex"
            aria-label={collapsed ? "Show chat history" : "Hide chat history"}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{active ? active.title : "New chat"}</h2>
          {active ? (
            <ConversationMenu id={active.id} title={active.title} pinned={active.pinned} onDeleted={startNew} />
          ) : null}
          <Button variant="ghost" size="icon-sm" aria-label="New chat" onClick={startNew} className={cn(!active && "hidden")}>
            <MessageSquarePlus aria-hidden />
          </Button>
        </header>

        <Messages messages={active?.messages ?? []} busy={busy} onAsk={ask} empty={hasAny ? "new" : "first"} />

        <Composer busy={busy} onSend={ask} />
      </section>
    </div>
  );
}

function ConversationMenu({ id, title, pinned, onDeleted }: { id: string; title: string; pinned: boolean; onDeleted: () => void }) {
  const [mode, setMode] = useState<"menu" | "rename" | "confirm">("menu");
  const [name, setName] = useState(title);
  if (mode === "rename") {
    return (
      <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); mutateChats((s) => renameConversation(s, id, name)); setMode("menu"); }}>
        <input autoFocus aria-label="Conversation name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setMode("menu"); }}
          className="h-7 w-48 rounded-md border px-2 text-sm" />
        <Button size="xs" type="submit">Save</Button>
      </form>
    );
  }
  if (mode === "confirm") {
    return (
      <span className="flex items-center gap-1.5 text-sm">
        Delete this conversation?
        <Button size="xs" variant="destructive" onClick={() => { mutateChats((s) => deleteConversation(s, id)); onDeleted(); }}>Delete</Button>
        <Button size="xs" variant="ghost" onClick={() => setMode("menu")}>Cancel</Button>
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Conversation actions" />}>
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => { setName(title); setMode("rename"); }}><Pencil aria-hidden /> Rename</DropdownMenuItem>
        <DropdownMenuItem onClick={() => mutateChats((s) => setPinned(s, id, !pinned))}>
          {pinned ? <><PinOff aria-hidden /> Unpin</> : <><Pin aria-hidden /> Pin</>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => setMode("confirm")}><Trash2 aria-hidden /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Messages({ messages, busy, onAsk, empty }: {
  messages: Message[]; busy: boolean; onAsk: (q: string) => void; empty: "new" | "first";
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length, busy]);

  if (messages.length === 0 && !busy) {
    const prompts = empty === "first" ? FIRST_RUN : START;
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10">
        <div className="flex w-full max-w-xl flex-col items-center gap-5 text-center">
          <span className="flex size-10 items-center justify-center rounded-xl border bg-card">
            <Sparkles className="size-5 text-primary" aria-hidden />
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="text-xl font-semibold tracking-tight">{empty === "first" ? "Ask AI" : "Ask about the diabetes cohort"}</p>
            <p className="text-sm text-muted-foreground">
              {empty === "first"
                ? "Ask questions about the diabetes cohort using natural language."
                : "Explore A1c monitoring, care gaps, patients, testing patterns, and the available synthetic clinical data."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            {empty === "first" && <span className="text-xs font-medium text-muted-foreground">Suggested questions</span>}
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onAsk(p)}
                className="rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
      <ol className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
        {messages.map((m) => (
          <li key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "user" ? (
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                <span className="sr-only">You asked: </span>{m.text}
              </p>
            ) : (
              <div className="flex w-full gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-card" aria-hidden>
                  <Sparkles className="size-3.5 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="sr-only">Answer: </span>
                  <AnswerBlocks blocks={m.blocks} onAsk={onAsk} />
                </div>
              </div>
            )}
          </li>
        ))}
        {busy && (
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Working out the answer…
          </li>
        )}
      </ol>
      <div ref={end} />
    </div>
  );
}

function Composer({ busy, onSend }: { busy: boolean; onSend: (q: string) => void }) {
  const [text, setText] = useState("");
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    onSend(text);
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };
  return (
    <div className="shrink-0 border-t bg-background px-3 pb-3 pt-2 sm:px-4">
      <form onSubmit={submit} className="mx-auto flex w-full max-w-3xl flex-col gap-1.5">
        <div className="flex items-end gap-2 rounded-xl border bg-card p-1.5 focus-within:ring-2 focus-within:ring-ring/40">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Ask about the diabetes cohort..."
            aria-label="Ask about the diabetes cohort"
            className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="icon" aria-label="Send question" disabled={!text.trim() || busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowUp aria-hidden />}
          </Button>
        </div>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Answers are computed in this browser from the synthetic cohort, using the app&apos;s own definitions.
          Ask AI interprets questions with rules, not a language model, and gives no clinical advice.
          Conversations are saved in this browser only.
        </p>
      </form>
    </div>
  );
}
