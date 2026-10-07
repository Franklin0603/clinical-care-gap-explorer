import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_CHATS, appendMessages, createConversation, createGroup, deleteConversation, deleteGroup,
  moveToGroup, parseChats, renameConversation, renameGroup, sections, setPinned, titleFromQuestion,
} from "./chats.ts";

const T = (n: number) => `2026-10-05T0${n}:00:00.000Z`;

function seed() {
  let s = EMPTY_CHATS;
  s = createConversation(s, "a", T(1), "Open A1C gaps");
  s = createConversation(s, "b", T(2), "Never-tested patients");
  s = createConversation(s, "c", T(3), "Gap rate by age band");
  s = createGroup(s, "g1", "Care Gap Analysis", T(4));
  return s;
}

test("each conversation appears exactly once: pinned, grouped or recent", () => {
  let s = seed();
  s = setPinned(s, "b", true);
  s = moveToGroup(s, "c", "g1");
  s = moveToGroup(s, "b", "g1"); // pinned and grouped: listed under Pinned only
  const v = sections(s);
  assert.deepEqual(v.pinned.map((c) => c.id), ["b"]);
  assert.deepEqual(v.recent.map((c) => c.id), ["a"]);
  assert.deepEqual(v.groups[0].conversations.map((c) => c.id), ["c"]);
  const listed = [...v.pinned, ...v.recent, ...v.groups.flatMap((g) => g.conversations)].map((c) => c.id).sort();
  assert.deepEqual(listed, ["a", "b", "c"]);
});

test("recent is newest first, and a new message moves a conversation up", () => {
  let s = seed();
  assert.deepEqual(sections(s).recent.map((c) => c.id), ["c", "b", "a"]);
  s = appendMessages(s, "a", [{ id: "m", role: "user", text: "Show them", at: T(5) }], {}, T(5));
  assert.equal(sections(s).recent[0].id, "a");
});

test("rename, delete, groups", () => {
  let s = seed();
  s = renameConversation(s, "a", "  Gaps overview  ");
  assert.equal(s.conversations.a.title, "Gaps overview");
  assert.equal(renameConversation(s, "a", "   "), s, "blank names are ignored");
  s = renameGroup(s, "g1", "Population Analysis");
  assert.equal(s.groups.g1.name, "Population Analysis");
  s = moveToGroup(s, "a", "g1");
  assert.equal(deleteGroup(s, "g1"), s, "a group with conversations cannot be deleted");
  s = moveToGroup(s, "a", null);
  s = deleteGroup(s, "g1");
  assert.equal(s.groups.g1, undefined);
  assert.equal(moveToGroup(s, "a", "nope"), s, "cannot move into a group that does not exist");
  s = deleteConversation(s, "b");
  assert.equal(s.conversations.b, undefined);
});

test("search covers titles and message text", () => {
  let s = seed();
  s = appendMessages(s, "a", [
    { id: "1", role: "user", text: "How many were seen in the last 6 months?", at: T(5) },
    { id: "2", role: "assistant", blocks: [{ kind: "metric", value: "24", label: "patients with an open A1C gap" }], at: T(5) },
  ], {}, T(5));
  assert.deepEqual(sections(s, "never").recent.map((c) => c.id), ["b"]);
  assert.deepEqual(sections(s, "6 months").recent.map((c) => c.id), ["a"]);
  assert.equal(sections(s, "zzz").matches, 0);
});

test("titles from questions, and storage parsing", () => {
  assert.equal(titleFromQuestion("which patients were seen at the clinic last spring and not since?"), "Which patients were seen at the…");
  assert.equal(titleFromQuestion("Gap rates?"), "Gap rates");
  assert.deepEqual(parseChats("nope"), EMPTY_CHATS);
  const s = setPinned(seed(), "a", true);
  assert.deepEqual(parseChats(JSON.stringify(s)), s);
});
