"use client";

import * as React from "react";
import { ArrowUpDown, Pin, Plus, Search, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { noteTitle, type Folder, type Note } from "@/lib/notes-store";
import { NOTE_DRAG_TYPE } from "./app-sidebar";
import { AttachmentBadges } from "./note-attachments";
import { cn } from "@/lib/utils";

export type SortKey = "updated" | "created" | "title";
const SORT_LABELS: Record<SortKey, string> = {
  updated: "Last edited",
  created: "Date created",
  title: "Title (A–Z)",
};

export function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startToday) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (ts >= startToday - 86_400_000) return "Yesterday";
  if (ts >= startToday - 6 * 86_400_000) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

type Props = {
  heading: string;
  notes: Note[];
  folders: Folder[];
  selectedId: string | null;
  query: string;
  onQuery: (q: string) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  onSelect: (id: string) => void;
  onNewNote: () => void;
  showFolderTag: boolean;
};

export function NoteList({
  heading,
  notes,
  folders,
  selectedId,
  query,
  onQuery,
  sort,
  onSort,
  onSelect,
  onNewNote,
  showFolderTag,
}: Props) {
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const folderMap = React.useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  return (
    <section className="flex h-full min-h-0 w-full flex-col border-r bg-background md:w-80 lg:w-96 md:shrink-0">
      <header className="flex flex-col gap-3 p-4 pb-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{heading}</h1>
          <span className="text-xs text-muted-foreground tabular-nums">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search notes  ( / )"
              className="pr-8 pl-8"
              onKeyDown={(e) => e.key === "Escape" && (onQuery(""), e.currentTarget.blur())}
            />
            {query && (
              <button
                aria-label="Clear search"
                onClick={() => onQuery("")}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon" aria-label="Sort notes" title="Sort notes" />}
            >
              <ArrowUpDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <DropdownMenuItem key={k} onClick={() => onSort(k)}>
                  <span className={cn(sort === k && "font-semibold")}>{SORT_LABELS[k]}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <StickyNote className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{query ? "No matching notes" : "Nothing here yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {query ? "Try a different search term." : "Create a note to get started."}
              </p>
            </div>
            {!query && (
              <Button onClick={onNewNote} size="sm">
                <Plus /> New note
              </Button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5 px-3 pb-4">
            {notes.map((n) => {
              const folder = n.folderId ? folderMap.get(n.folderId) : undefined;
              const preview = n.content.replace(/\s+/g, " ").trim();
              return (
                <li key={n.id}>
                  <button
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(NOTE_DRAG_TYPE, n.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onSelect(n.id)}
                    className={cn(
                      "group w-full cursor-pointer rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted/70",
                      selectedId === n.id && "border-border bg-muted shadow-xs",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm font-medium",
                          !n.title.trim() && "text-muted-foreground italic",
                        )}
                      >
                        {noteTitle(n)}
                      </p>
                      {n.pinned && <Pin className="size-3.5 shrink-0 fill-current text-primary" />}
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(n.updatedAt)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {preview || "No additional text"}
                    </p>
                    {n.attachments.length > 0 && (
                      <div className="mt-1.5">
                        <AttachmentBadges attachments={n.attachments} />
                      </div>
                    )}
                    {showFolderTag && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: folder?.color ?? "var(--muted-foreground)" }}
                        />
                        {folder?.name ?? "Unfiled"}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </section>
  );
}
