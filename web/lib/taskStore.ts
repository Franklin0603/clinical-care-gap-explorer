"use client";

import { useSyncExternalStore } from "react";

import { Change, Task, TaskStore, applyChange, initialTask, parseStore } from "./tasks";

/**
 * Where task workflow data lives: this browser's localStorage.
 *
 * The site is a static export on GitHub Pages - there is no server to save
 * to, and adding one for a demo workflow would be the "large backend" the
 * brief rules out. So tasks are saved per browser: they persist across
 * reloads and are shared between tabs, but another person or device sees
 * their own. The UI says so wherever workflow data appears.
 *
 * Read through useSyncExternalStore, so every component sees the same store
 * and a change in one tab reaches the others. The server snapshot is an empty
 * store: the static HTML shows every task in its initial state, and saved
 * work appears as the page hydrates.
 */

const KEY = "care-gap-explorer.tasks.v1";
const EMPTY: TaskStore = {};

let cache: { raw: string | null; store: TaskStore } | null = null;
const listeners = new Set<() => void>();

function read(): TaskStore {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { /* storage blocked: work in memory */ }
  // Same string, same object: useSyncExternalStore needs a stable snapshot.
  if (cache && cache.raw === raw) return cache.store;
  cache = { raw, store: parseStore(raw) };
  return cache.store;
}

function write(store: TaskStore) {
  const raw = JSON.stringify(store);
  try { window.localStorage.setItem(KEY, raw); } catch { /* fall through to memory */ }
  cache = { raw, store };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; l(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

export function useTaskStore(): TaskStore {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Apply a user change to one patient's task and save it. */
export function updateTask(patientId: string, change: Change) {
  const store = read();
  const before: Task = store[patientId] ?? initialTask(patientId);
  const after = applyChange(before, change, new Date().toISOString());
  if (after === before) return;
  write({ ...store, [patientId]: after });
}

/** Forget every saved task in this browser: back to the initial state. */
export function resetTasks() {
  write({});
}
