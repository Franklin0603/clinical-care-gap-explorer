"use client";

import { useSyncExternalStore } from "react";

import { ChatState, EMPTY_CHATS, parseChats } from "./chats";

/**
 * Where Ask AI conversations live: this browser's localStorage, the same
 * approach as follow-up tasks (lib/taskStore.ts) and for the same reason - a
 * static site has nowhere else. Separate key, separate data: conversations
 * are application data, never mixed with clinical source data or tasks.
 */

const KEY = "care-gap-explorer.ask.v1";

let cache: { raw: string | null; state: ChatState } | null = null;
const listeners = new Set<() => void>();

function read(): ChatState {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (cache && cache.raw === raw) return cache.state;
  cache = { raw, state: parseChats(raw) };
  return cache.state;
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; l(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

export function useChats(): ChatState {
  return useSyncExternalStore(subscribe, read, () => EMPTY_CHATS);
}

/** Apply a pure change (from lib/ask/chats.ts) and save the result. */
export function mutateChats(fn: (s: ChatState) => ChatState) {
  const before = read();
  const after = fn(before);
  if (after === before) return;
  const raw = JSON.stringify(after);
  try { window.localStorage.setItem(KEY, raw); } catch { /* keep in memory */ }
  cache = { raw, state: after };
  listeners.forEach((l) => l());
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
