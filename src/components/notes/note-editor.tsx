"use client";

import * as React from "react";
import { ArrowLeft, Check, FolderClosed, Inbox, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KIND_META, MOODS, type Attachment, type Folder, type Note } from "@/lib/notes-store";
import { formatDay, formatTime, todayStr } from "@/lib/dates";
import { formatDate } from "./note-list";
import { AttachmentList, MediaToolbar, useMediaIntake } from "./note-attachments";
import { TaskCheck } from "./task-list";
import { cn } from "@/lib/utils";

type Patch = Partial<Pick<Note, "title" | "content" | "folderId" | "pinned" | "date" | "time" | "done" | "remind" | "mood">>;

type Props = {
  note: Note | null;
  folders: Folder[];
  onChange: (patch: Patch) => void;
  onDelete: () => void;
  onBack: () => void;
  onNewNote: () => void;
  onAddAttachment: (a: Attachment) => void;
  onRemoveAttachment: (id: string) => void;
};

const REMINDERS: { value: number | null; label: string }[] = [
  { value: null, label: "No reminder" },
  { value: 0, label: "At due time" },
  { value: 10, label: "10 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];

const field =
  "h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

export function NoteEditor({
  note,
  folders,
  onChange,
  onDelete,
  onBack,
  onNewNote,
  onAddAttachment,
  onRemoveAttachment,
}: Props) {
  const titleRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const intake = useMediaIntake(onAddAttachment);
  const [dragging, setDragging] = React.useState(false);

  // Focus the right field when a brand-new (empty) entry is opened.
  const noteId = note?.id;
  const isBlank = note ? !note.title && !note.content : false;
  const kind = note?.kind;
  React.useEffect(() => {
    if (!noteId || !isBlank) return;
    (kind === "journal" ? bodyRef : titleRef).current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  if (!note) {
    return (
      <div className="hidden h-full flex-1 flex-col items-center justify-center gap-4 p-8 text-center md:flex">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <FolderClosed className="size-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-lg font-medium">Pick something to open</p>
          <p className="mt-1 text-sm text-muted-foreground">Or start a new one. It saves as you type.</p>
        </div>
        <Button onClick={onNewNote}>
          <Plus /> New
        </Button>
      </div>
    );
  }

  const meta = KIND_META[note.kind];
  const folder = folders.find((f) => f.id === note.folderId);
  const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const isTask = note.kind === "task";
  const isJournal = note.kind === "journal";

  const setReminder = (value: number | null) => {
    onChange({ remind: value });
    // Browsers only allow the permission prompt from a click, so ask here.
    if (value !== null && typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  };

  return (
    <article
      className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background"
      onPaste={(e) => {
        const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
        if (files.length) {
          e.preventDefault();
          void intake.addImages(files);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) {
          e.preventDefault();
          void intake.addImages(files);
        }
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/80 text-sm font-medium">
          Drop photos to add them
        </div>
      )}
      <header className="flex items-center gap-2 border-b px-3 py-2 sm:px-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Back">
          <ArrowLeft />
        </Button>

        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: `${meta.color}2e` }}
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
          {meta.label}
        </span>

        {note.kind === "note" && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
              {folder ? (
                <FolderClosed className="size-3.5" style={{ color: folder.color }} />
              ) : (
                <Inbox className="size-3.5" />
              )}
              <span className="max-w-32 truncate">{folder?.name ?? "No folder"}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              <DropdownMenuItem onClick={() => onChange({ folderId: null })}>
                <Inbox /> No folder
                {note.folderId === null && <Check className="ml-auto" />}
              </DropdownMenuItem>
              {folders.length > 0 && <DropdownMenuSeparator />}
              {folders.map((f) => (
                <DropdownMenuItem key={f.id} onClick={() => onChange({ folderId: f.id })}>
                  <FolderClosed style={{ color: f.color }} /> {f.name}
                  {note.folderId === f.id && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="ml-auto flex items-center gap-1">
          {note.kind === "note" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange({ pinned: !note.pinned })}
              aria-label={note.pinned ? "Unpin note" : "Pin note"}
              title={note.pinned ? "Unpin" : "Pin to top"}
            >
              {note.pinned ? <PinOff /> : <Pin />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${meta.label.toLowerCase()}`}
            title="Delete"
          >
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-5 py-6 sm:px-8">
          {isJournal && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {formatDay(note.date ?? todayStr(), { absolute: true, long: true })}
              </h2>
              <input
                type="date"
                value={note.date ?? ""}
                onChange={(e) => onChange({ date: e.target.value || todayStr() })}
                aria-label="Entry date"
                className="h-8 rounded-lg border bg-background px-2 text-xs text-muted-foreground"
              />
            </div>
          )}

          <div className="flex items-start gap-3">
            {isTask && (
              <div className="pt-2">
                <TaskCheck
                  done={note.done}
                  onToggle={() => onChange({ done: !note.done })}
                  label={note.done ? "Mark not done" : "Mark done"}
                />
              </div>
            )}
            <input
              ref={titleRef}
              value={note.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder={isTask ? "What needs doing?" : isJournal ? "Title (optional)" : "Untitled note"}
              aria-label="Title"
              className={cn(
                "w-full bg-transparent font-bold tracking-tight outline-none placeholder:text-muted-foreground/50",
                isTask ? "text-2xl" : "text-3xl",
                isTask && note.done && "text-muted-foreground line-through",
              )}
            />
          </div>

          {isJournal && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Mood">
              {MOODS.map((m) => {
                const on = note.mood === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange({ mood: on ? null : m.id })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                      on ? "border-transparent font-medium text-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                    style={on ? { backgroundColor: `${m.color}55` } : undefined}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: m.color }} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}

          {isTask && (
            <div className="grid gap-3 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-3">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Due date
                <input
                  type="date"
                  value={note.date ?? ""}
                  onChange={(e) =>
                    onChange(e.target.value ? { date: e.target.value } : { date: null, time: null, remind: null })
                  }
                  className={field}
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Time
                <input
                  type="time"
                  value={note.time ?? ""}
                  disabled={!note.date}
                  onChange={(e) => onChange({ time: e.target.value || null })}
                  className={field}
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Remind me
                <select
                  value={note.remind === null ? "" : String(note.remind)}
                  disabled={!note.date}
                  onChange={(e) => setReminder(e.target.value === "" ? null : Number(e.target.value))}
                  className={field}
                >
                  {REMINDERS.map((r) => (
                    <option key={r.label} value={r.value === null ? "" : String(r.value)}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-3">
                {!note.date
                  ? "Pick a due date to add a time or reminder."
                  : note.remind !== null
                    ? `${note.time ? "" : "No time set, so it’s due at 9:00 AM. "}Reminders show while Folio is open${
                        typeof Notification !== "undefined" && Notification.permission === "denied"
                          ? " (browser alerts are blocked)."
                          : "."
                      }`
                    : note.time
                      ? `Due ${formatDay(note.date)} at ${formatTime(note.time)}.`
                      : `Due ${formatDay(note.date)}.`}
              </p>
            </div>
          )}

          <MediaToolbar intake={intake} />
          <textarea
            ref={bodyRef}
            value={note.content}
            onChange={(e) => onChange({ content: e.target.value })}
            placeholder={isJournal ? "How was your day?" : isTask ? "Notes (optional)" : "Start writing…"}
            aria-label="Content"
            className={cn(
              "w-full flex-1 resize-none bg-transparent text-base leading-7 outline-none placeholder:text-muted-foreground/50",
              isTask ? "min-h-[15vh]" : isJournal ? "min-h-[40vh]" : "min-h-[30vh]",
            )}
          />
          <AttachmentList attachments={note.attachments} onRemove={onRemoveAttachment} />
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
        <span>{isTask ? "" : `${words} ${words === 1 ? "word" : "words"}`}</span>
        <span className="flex items-center gap-1">
          <Check className="size-3 text-emerald-500" /> Saved · edited {formatDate(note.updatedAt)}
        </span>
      </footer>
    </article>
  );
}
