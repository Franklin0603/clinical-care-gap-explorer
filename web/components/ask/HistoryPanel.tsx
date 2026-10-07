"use client";

import { ReactNode, useState } from "react";
import {
  Folder, FolderPlus, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, Trash2,
} from "lucide-react";

import {
  ChatState, Conversation, Group, createGroup, deleteConversation, deleteGroup, groupSize,
  moveToGroup, renameConversation, renameGroup, sections, setPinned,
} from "@/lib/ask/chats";
import { mutateChats, newId } from "@/lib/ask/chatStore";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

/**
 * Saved conversations: Pinned, Recent, then Groups. Each conversation is
 * listed exactly once. Actions live behind a "…" menu per row, so the list
 * stays quiet; renaming happens in place.
 */
export function HistoryPanel({
  state, activeId, onOpen, onNew,
}: {
  state: ChatState;
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const [newGroup, setNewGroup] = useState<string | null>(null);
  const v = sections(state, query);
  const total = Object.keys(state.conversations).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 border-b p-3">
        <Button onClick={onNew} className="w-full justify-start">
          <Plus aria-hidden /> New chat
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-8 pl-8"
          />
        </div>
      </div>

      <nav aria-label="Conversations" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
        {total === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">No conversations yet. Ask a question to start one.</p>
        ) : v.matches === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">No conversation matches &ldquo;{query.trim()}&rdquo;.</p>
        ) : null}

        {v.pinned.length > 0 && (
          <Section label="Pinned">
            {v.pinned.map((c) => <Item key={c.id} c={c} state={state} active={c.id === activeId} onOpen={onOpen} />)}
          </Section>
        )}
        {v.recent.length > 0 && (
          <Section label="Recent">
            {v.recent.map((c) => <Item key={c.id} c={c} state={state} active={c.id === activeId} onOpen={onOpen} />)}
          </Section>
        )}

        <Section
          label="Groups"
          action={
            <Button variant="ghost" size="icon-xs" aria-label="New group" onClick={() => setNewGroup("")}>
              <FolderPlus aria-hidden />
            </Button>
          }
        >
          {newGroup !== null && (
            <InlineName
              initial=""
              label="New group name"
              onDone={(name) => {
                if (name) mutateChats((s) => createGroup(s, newId(), name, new Date().toISOString()));
                setNewGroup(null);
              }}
            />
          )}
          {v.groups.length === 0 && newGroup === null && (
            <p className="px-2 text-xs text-muted-foreground">Groups organise conversations. They don&apos;t change answers.</p>
          )}
          {v.groups.map(({ group, conversations }) => (
            <GroupBlock key={group.id} group={group} state={state}>
              {conversations.map((c) => <Item key={c.id} c={c} state={state} active={c.id === activeId} onOpen={onOpen} />)}
            </GroupBlock>
          ))}
        </Section>
      </nav>
    </div>
  );
}

function Section({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex h-6 items-center justify-between px-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {action}
      </div>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

function GroupBlock({ group, state, children }: { group: Group; state: ChatState; children: ReactNode }) {
  const [renaming, setRenaming] = useState(false);
  const size = groupSize(state, group.id);
  return (
    <li className="flex flex-col gap-0.5">
      {renaming ? (
        <InlineName
          initial={group.name}
          label="Group name"
          onDone={(name) => { if (name) mutateChats((s) => renameGroup(s, group.id, name)); setRenaming(false); }}
        />
      ) : (
        <div className="group/g flex items-center gap-1.5 rounded-md px-2 py-1 text-sm">
          <Folder className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{group.name}</span>
          <span className="num text-xs text-muted-foreground">{size}</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-xs" aria-label={`Actions for group ${group.name}`} className="opacity-60 group-hover/g:opacity-100 focus-visible:opacity-100" />}
            >
              <MoreHorizontal aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setRenaming(true)}><Pencil aria-hidden /> Rename group</DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={size > 0}
                onClick={() => mutateChats((s) => deleteGroup(s, group.id))}
              >
                <Trash2 aria-hidden /> {size > 0 ? "Delete (empty it first)" : "Delete group"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {size === 0 ? null : <ul className="ml-3 flex flex-col gap-0.5 border-l pl-1">{children}</ul>}
    </li>
  );
}

function Item({ c, state, active, onOpen }: { c: Conversation; state: ChatState; active: boolean; onOpen: (id: string) => void }) {
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const groups = Object.values(state.groups).sort((a, b) => a.name.localeCompare(b.name));

  if (renaming) {
    return (
      <li>
        <InlineName
          initial={c.title}
          label="Conversation name"
          onDone={(t) => { if (t) mutateChats((s) => renameConversation(s, c.id, t)); setRenaming(false); }}
        />
      </li>
    );
  }
  if (confirm) {
    return (
      <li className="flex flex-col gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm">
        <span>Delete &ldquo;{c.title}&rdquo;?</span>
        <span className="flex gap-1.5">
          <Button size="xs" variant="destructive" onClick={() => mutateChats((s) => deleteConversation(s, c.id))}>Delete</Button>
          <Button size="xs" variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
        </span>
      </li>
    );
  }
  return (
    <li className={cn("group/i flex items-center rounded-md", active ? "bg-muted" : "hover:bg-muted/60")}>
      <button
        type="button"
        onClick={() => onOpen(c.id)}
        aria-current={active ? "page" : undefined}
        className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring"
      >
        {c.pinned && <Pin className="mr-1.5 inline size-3 text-muted-foreground" aria-label="Pinned" />}
        {c.title}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Actions for ${c.title}`}
              className={cn("mr-1 opacity-0 focus-visible:opacity-100 group-hover/i:opacity-100 data-[popup-open]:opacity-100", active && "opacity-60")}
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setRenaming(true)}><Pencil aria-hidden /> Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={() => mutateChats((s) => setPinned(s, c.id, !c.pinned))}>
            {c.pinned ? <><PinOff aria-hidden /> Unpin</> : <><Pin aria-hidden /> Pin</>}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Folder aria-hidden /> Move to group</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              {groups.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No groups yet. Create one with the folder button beside Groups.</p>
              ) : (
                <DropdownMenuRadioGroup
                  value={c.groupId ?? "none"}
                  onValueChange={(v) => mutateChats((s) => moveToGroup(s, c.id, v === "none" ? null : String(v)))}
                >
                  <DropdownMenuRadioItem value="none" closeOnClick>No group</DropdownMenuRadioItem>
                  {groups.map((g) => <DropdownMenuRadioItem key={g.id} value={g.id} closeOnClick>{g.name}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirm(true)}><Trash2 aria-hidden /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/** A name field that saves on Enter or blur and cancels on Escape. */
function InlineName({ initial, label, onDone }: { initial: string; label: string; onDone: (v: string | null) => void }) {
  const [v, setV] = useState(initial);
  return (
    <form className="px-1" onSubmit={(e) => { e.preventDefault(); onDone(v.trim() || null); }}>
      <Input
        autoFocus
        value={v}
        aria-label={label}
        maxLength={80}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onDone(v.trim() || null)}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onDone(null); } }}
        className="h-7 text-sm"
      />
    </form>
  );
}
