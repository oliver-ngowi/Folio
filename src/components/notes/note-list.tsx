"use client";

import * as React from "react";
import {
  ArrowUpDown,
  Check,
  FolderClosed,
  FolderInput,
  Inbox,
  ListChecks,
  Pin,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MOODS, noteTitle, type Folder, type Kind, type Note } from "@/lib/notes-store";
import { formatDay } from "@/lib/dates";
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
  kind: Kind;
  showSort: boolean;
  canMove: boolean;
  onBulkDelete: (ids: string[]) => void;
  onBulkMove: (ids: string[], folderId: string | null) => void;
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
  kind,
  showSort,
  canMove,
  onBulkDelete,
  onBulkMove,
  showFolderTag,
}: Props) {
  const isJournal = kind === "journal";
  const noun = isJournal ? (["entry", "entries"] as const) : (["note", "notes"] as const);
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

  // Multi-select: ids that no longer appear (deleted, moved out, filtered) are ignored.
  const [selecting, setSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const selectedIds = React.useMemo(() => notes.filter((n) => selected.has(n.id)).map((n) => n.id), [notes, selected]);
  const allSelected = notes.length > 0 && selectedIds.length === notes.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAll = () => setSelected(new Set(notes.map((n) => n.id)));
  const exitSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    setConfirmDelete(false);
  };
  const moveSelected = (folderId: string | null) => {
    onBulkMove(selectedIds, folderId);
    exitSelecting();
  };

  React.useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement)?.closest("[role=dialog],[role=menu]")) {
        setSelecting(false);
        setSelected(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting]);

  return (
    <section className="flex h-full min-h-0 w-full flex-col border-r bg-background md:w-80 lg:w-96 md:shrink-0">
      <header className="flex flex-col gap-3 p-4 pb-3">
        {selecting ? (
          <div className="flex items-center gap-2">
            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight" aria-live="polite">
              {selectedIds.length === 0 ? "Select notes" : `${selectedIds.length} selected`}
            </h1>
            <Button variant="ghost" size="sm" onClick={allSelected ? () => setSelected(new Set()) : selectAll}>
              {allSelected ? "Deselect all" : "Select all"}
            </Button>
            <Button variant="outline" size="sm" onClick={exitSelecting}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1 md:hidden" />
            <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">{heading}</h1>
            <span className="flex-1 text-xs text-muted-foreground tabular-nums">
              {notes.length} {notes.length === 1 ? noun[0] : noun[1]}
            </span>
            {notes.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelecting(true)}>
                <ListChecks /> Select
              </Button>
            )}
            <Button size="sm" onClick={onNewNote}>
              <Plus /> New
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={`Search ${noun[1]}  ( / )`}
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
          {showSort && (
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
          )}
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
                <Plus /> {isJournal ? "New entry" : "New note"}
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
                    draggable={!selecting && kind === "note"}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(NOTE_DRAG_TYPE, n.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => (selecting ? toggle(n.id) : onSelect(n.id))}
                    aria-pressed={selecting ? selected.has(n.id) : undefined}
                    className={cn(
                      "group flex w-full cursor-pointer items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted/70",
                      !selecting && selectedId === n.id && "border-border bg-muted shadow-xs",
                      selecting && selected.has(n.id) && "border-primary/40 bg-primary/5",
                    )}
                  >
                    {selecting && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border",
                          selected.has(n.id)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40 bg-background",
                        )}
                      >
                        {selected.has(n.id) && <Check className="size-3.5" />}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm font-medium",
                          !isJournal && !n.title.trim() && "text-muted-foreground italic",
                        )}
                      >
                        {isJournal && n.date ? formatDay(n.date, { absolute: true }) : noteTitle(n)}
                      </p>
                      {n.pinned && <Pin className="size-3.5 shrink-0 fill-current text-primary" />}
                      {isJournal ? (
                        n.mood && (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: MOODS.find((m) => m.id === n.mood)?.color }}
                            />
                            {MOODS.find((m) => m.id === n.mood)?.label}
                          </span>
                        )
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDate(n.updatedAt)}</span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {isJournal && n.title.trim() ? <b className="font-medium text-foreground/80">{n.title.trim()} · </b> : null}
                      {preview || (isJournal ? "Nothing written yet" : "No additional text")}
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
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      {selecting && (
        <div className="flex items-center gap-2 border-t bg-background p-3" role="toolbar" aria-label="Bulk actions">
          {canMove && (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={selectedIds.length === 0}
              render={<Button variant="outline" className="flex-1" />}
            >
              <FolderInput /> Move to folder
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="min-w-52">
              <DropdownMenuItem onClick={() => moveSelected(null)}>
                <Inbox /> Unfiled
              </DropdownMenuItem>
              {folders.length > 0 && <DropdownMenuSeparator />}
              {folders.map((f) => (
                <DropdownMenuItem key={f.id} onClick={() => moveSelected(f.id)}>
                  <FolderClosed style={{ color: f.color }} /> {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
          <Button
            variant="destructive"
            className="flex-1"
            disabled={selectedIds.length === 0}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.length} {selectedIds.length === 1 ? noun[0] : noun[1]}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.length === 1 ? "This note" : "These notes"} and any photos or voice notes attached will be
              permanently removed. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep {selectedIds.length === 1 ? noun[0] : noun[1]}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onBulkDelete(selectedIds);
                exitSelecting();
              }}
            >
              Delete {selectedIds.length === 1 ? noun[0] : noun[1]}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
