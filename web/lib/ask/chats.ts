/**
 * Ask AI conversations and groups: application data, kept in the browser.
 *
 * Organisation only. A group, a pin or a title changes where a conversation
 * is listed and nothing else - not what the assistant can see or how it
 * answers. Pure functions over a plain state object, so they can be tested;
 * lib/ask/chatStore.ts saves the result.
 */

import type { Block, Ctx } from "./engine.ts";

export type Message =
  | { id: string; role: "user"; text: string; at: string }
  | { id: string; role: "assistant"; blocks: AssistantBlock[]; at: string };

/** Engine blocks, plus a result table for a SELECT typed directly. */
export type AssistantBlock = Block | { kind: "table"; columns: string[]; rows: unknown[][] };

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  groupId: string | null;
  messages: Message[];
  /** What the assistant is "talking about", for follow-up questions. */
  ctx: Ctx;
};

export type Group = { id: string; name: string; createdAt: string };

export type ChatState = { conversations: Record<string, Conversation>; groups: Record<string, Group> };

export const EMPTY_CHATS: ChatState = { conversations: {}, groups: {} };

/** A fallback title from the question itself, when the interpreter gives none. */
export function titleFromQuestion(q: string): string {
  const words = q.replace(/[?.!]+$/, "").trim().split(/\s+/);
  const t = words.slice(0, 6).join(" ");
  return (words.length > 6 ? `${t}…` : t).replace(/^./, (c) => c.toUpperCase()) || "New conversation";
}

export function createConversation(s: ChatState, id: string, now: string, title: string): ChatState {
  return {
    ...s,
    conversations: {
      ...s.conversations,
      [id]: { id, title, createdAt: now, updatedAt: now, pinned: false, groupId: null, messages: [], ctx: {} },
    },
  };
}

export function appendMessages(s: ChatState, id: string, msgs: Message[], ctx: Ctx, now: string): ChatState {
  const c = s.conversations[id];
  if (!c) return s;
  return { ...s, conversations: { ...s.conversations, [id]: { ...c, messages: [...c.messages, ...msgs], ctx, updatedAt: now } } };
}

function patch(s: ChatState, id: string, p: Partial<Conversation>): ChatState {
  const c = s.conversations[id];
  return c ? { ...s, conversations: { ...s.conversations, [id]: { ...c, ...p } } } : s;
}

export const renameConversation = (s: ChatState, id: string, title: string) =>
  title.trim() ? patch(s, id, { title: title.trim().slice(0, 80) }) : s;
export const setPinned = (s: ChatState, id: string, pinned: boolean) => patch(s, id, { pinned });
export const moveToGroup = (s: ChatState, id: string, groupId: string | null) =>
  groupId === null || s.groups[groupId] ? patch(s, id, { groupId }) : s;

export function deleteConversation(s: ChatState, id: string): ChatState {
  const rest = { ...s.conversations };
  delete rest[id];
  return { ...s, conversations: rest };
}

export function createGroup(s: ChatState, id: string, name: string, now: string): ChatState {
  const n = name.trim().slice(0, 40);
  return n ? { ...s, groups: { ...s.groups, [id]: { id, name: n, createdAt: now } } } : s;
}

export function renameGroup(s: ChatState, id: string, name: string): ChatState {
  const g = s.groups[id];
  return g && name.trim() ? { ...s, groups: { ...s.groups, [id]: { ...g, name: name.trim().slice(0, 40) } } } : s;
}

export const groupSize = (s: ChatState, id: string) =>
  Object.values(s.conversations).filter((c) => c.groupId === id).length;

/** Only an empty group can be deleted, so no conversation is ever lost or
 *  silently moved by deleting its group. */
export function deleteGroup(s: ChatState, id: string): ChatState {
  if (groupSize(s, id) > 0) return s;
  const rest = { ...s.groups };
  delete rest[id];
  return { ...s, groups: rest };
}

/** Text a conversation can be found by: its title and every message. */
function searchable(c: Conversation): string {
  const parts = [c.title];
  for (const m of c.messages) {
    if (m.role === "user") parts.push(m.text);
    else for (const b of m.blocks) {
      if (b.kind === "text" || b.kind === "limitation") parts.push(b.text);
      if (b.kind === "metric") parts.push(`${b.value} ${b.label}`);
    }
  }
  return parts.join(" ").toLowerCase();
}

/**
 * The history panel's sections. Each conversation appears exactly once:
 * pinned ones under Pinned (whatever group they are in), the rest under their
 * group, or under Recent. Newest first throughout.
 */
export function sections(s: ChatState, query = "") {
  const q = query.trim().toLowerCase();
  const all = Object.values(s.conversations)
    .filter((c) => !q || searchable(c).includes(q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const groups = Object.values(s.groups)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => ({ group: g, conversations: all.filter((c) => !c.pinned && c.groupId === g.id) }));
  return {
    pinned: all.filter((c) => c.pinned),
    recent: all.filter((c) => !c.pinned && (c.groupId === null || !s.groups[c.groupId])),
    groups: q ? groups.filter((g) => g.conversations.length) : groups,
    matches: all.length,
  };
}

/** Accept only well-formed state from storage. */
export function parseChats(raw: string | null): ChatState {
  if (!raw) return EMPTY_CHATS;
  try {
    const d = JSON.parse(raw) as ChatState;
    if (!d || typeof d !== "object" || typeof d.conversations !== "object" || typeof d.groups !== "object") return EMPTY_CHATS;
    const conversations: ChatState["conversations"] = {};
    for (const [id, c] of Object.entries(d.conversations ?? {})) {
      if (c && typeof c.title === "string" && Array.isArray(c.messages)) {
        conversations[id] = {
          id, title: c.title, createdAt: String(c.createdAt), updatedAt: String(c.updatedAt),
          pinned: Boolean(c.pinned), groupId: typeof c.groupId === "string" ? c.groupId : null,
          messages: c.messages, ctx: c.ctx && typeof c.ctx === "object" ? c.ctx : {},
        };
      }
    }
    const groups: ChatState["groups"] = {};
    for (const [id, g] of Object.entries(d.groups ?? {})) {
      if (g && typeof g.name === "string") groups[id] = { id, name: g.name, createdAt: String(g.createdAt) };
    }
    return { conversations, groups };
  } catch {
    return EMPTY_CHATS;
  }
}
