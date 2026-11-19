"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Pin, Plus, Search, Trash2, X } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { KIND_META, noteTitle, type Folder, type Kind, type Note } from "@/lib/notes-store";
import { isOverdue, todayStr } from "@/lib/dates";
import { formatDate } from "./note-list";
import { AttachmentBadges } from "./note-attachments";
import { TaskRow } from "./task-list";

type Props = {
  notes: Note[];
  folders: Folder[];
  onNewEntry: (kind: Kind) => void;
  onOpenNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onToggleTask: (id: string, done: boolean) => void;
};

export function HomeScreen({ notes, folders, onNewEntry, onOpenNote, onDeleteNote, onToggleTask }: Props) {
  const [query, setQuery] = React.useState("");

  const today = todayStr();
  const dueNow = React.useMemo(
    () =>
      notes
        .filter((n) => n.kind === "task" && !n.done && n.date && (n.date === today || isOverdue(n)))
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.time ?? "").localeCompare(b.time ?? ""))
        .slice(0, 5),
    [notes, today],
  );
  const journaledToday = notes.some((n) => n.kind === "journal" && n.date === today);
  const [toDelete, setToDelete] = React.useState<Note | null>(null);
  const q = query.trim().toLowerCase();
  const folderMap = React.useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  const results = React.useMemo(() => {
    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted.slice(0, 6);
    return sorted.filter((n) => (n.title + "\n" + n.content).toLowerCase().includes(q));
  }, [notes, q]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background">
      <div className="p-3 md:hidden">
        <SidebarTrigger />
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10 md:py-20">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
          <p className="mt-2 text-muted-foreground">What’s on your mind?</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
                if (e.key === "Enter" && results.length > 0 && q) onOpenNote(results[0].id);
              }}
              placeholder="Search everything…"
              aria-label="Search"
              className="h-12 rounded-full pr-11 pl-12 text-base shadow-xs md:text-base"
            />
            {query && (
              <button
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Create something new"
              title="Create something new"
              render={<Button className="h-12 shrink-0 gap-2 rounded-full px-5 text-base shadow-md" />}
            >
              <Plus className="size-5" />
              New
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {(["note", "journal", "task"] as Kind[]).map((k) => (
                <DropdownMenuItem key={k} onClick={() => onNewEntry(k)}>
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: KIND_META[k].color }} />
                  {k === "journal" ? "Journal entry" : KIND_META[k].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {!q && (dueNow.length > 0 || !journaledToday) && (
          <section aria-label="Today" className="flex flex-col gap-2">
            <h2 className="px-1 text-sm font-medium text-muted-foreground">Today</h2>
            {dueNow.length > 0 && (
              <div className="rounded-2xl border p-1.5">
                {dueNow.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onToggle={() => onToggleTask(t.id, true)}
                    onOpen={() => onOpenNote(t.id)}
                  />
                ))}
              </div>
            )}
            {!journaledToday && (
              <button
                type="button"
                onClick={() => onNewEntry("journal")}
                className="flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: KIND_META.journal.color }} />
                Write today’s journal
              </button>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
            {q ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "Recent"}
          </h2>
          {results.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {q ? "Nothing found." : "Nothing yet. Tap New to start."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {results.map((n) => {
                const folder = n.folderId ? folderMap.get(n.folderId) : undefined;
                const preview = n.content.replace(/\s+/g, " ").trim();
                return (
                  <li key={n.id} className="relative">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Options for ${noteTitle(n)}`}
                            title="More options"
                            className="absolute top-2 right-2 z-10 text-muted-foreground"
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem onClick={() => onOpenNote(n.id)}>
                          <Pencil /> Edit note
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setToDelete(n)}>
                          <Trash2 /> Delete note
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                      onClick={() => onOpenNote(n.id)}
                      className="w-full rounded-xl border py-3 pr-12 pl-4 text-left transition-colors hover:bg-muted/70"
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{noteTitle(n)}</span>
                        {n.pinned && <Pin className="size-3.5 fill-current text-primary" />}
                        <span className="text-xs text-muted-foreground">{formatDate(n.updatedAt)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {preview || "No additional text"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: KIND_META[n.kind].color }}
                          />
                          {n.kind === "note" ? (folder?.name ?? "Note") : KIND_META[n.kind].label}
                        </p>
                        <AttachmentBadges attachments={n.attachments} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete ? noteTitle(toDelete) : ""}”?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the note and can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep note</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => toDelete && onDeleteNote(toDelete.id)}
            >
              Delete note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
