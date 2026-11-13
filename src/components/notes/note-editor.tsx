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
import type { Attachment, Folder, Note } from "@/lib/notes-store";
import { formatDate } from "./note-list";
import { AttachmentList, MediaToolbar, useMediaIntake } from "./note-attachments";

type Props = {
  note: Note | null;
  folders: Folder[];
  onChange: (patch: Partial<Pick<Note, "title" | "content" | "folderId" | "pinned">>) => void;
  onDelete: () => void;
  onBack: () => void;
  onNewNote: () => void;
  onAddAttachment: (a: Attachment) => void;
  onRemoveAttachment: (id: string) => void;
};

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
  const intake = useMediaIntake(onAddAttachment);
  const [dragging, setDragging] = React.useState(false);

  // Focus the title when a brand-new (empty) note is opened.
  const noteId = note?.id;
  const isBlank = note ? !note.title && !note.content : false;
  React.useEffect(() => {
    if (noteId && isBlank) titleRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  if (!note) {
    return (
      <div className="hidden h-full flex-1 flex-col items-center justify-center gap-4 p-8 text-center md:flex">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <FolderClosed className="size-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-lg font-medium">Select a note to read or edit</p>
          <p className="mt-1 text-sm text-muted-foreground">Or start a fresh one — it saves as you type.</p>
        </div>
        <Button onClick={onNewNote}>
          <Plus /> New note
        </Button>
      </div>
    );
  }

  const folder = folders.find((f) => f.id === note.folderId);
  const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;

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
          Drop photos to add them to this note
        </div>
      )}
      <header className="flex items-center gap-1 border-b px-3 py-2 sm:px-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Back to notes">
          <ArrowLeft />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
            {folder ? (
              <FolderClosed className="size-3.5" style={{ color: folder.color }} />
            ) : (
              <Inbox className="size-3.5" />
            )}
            <span className="max-w-32 truncate">{folder?.name ?? "Unfiled"}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuItem onClick={() => onChange({ folderId: null })}>
              <Inbox /> Unfiled
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

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange({ pinned: !note.pinned })}
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            title={note.pinned ? "Unpin note" : "Pin note"}
          >
            {note.pinned ? <PinOff /> : <Pin />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete note"
            title="Delete note"
          >
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-5 py-6 sm:px-8">
          <input
            ref={titleRef}
            value={note.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Untitled note"
            aria-label="Note title"
            className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50"
          />
          <MediaToolbar intake={intake} />
          <textarea
            value={note.content}
            onChange={(e) => onChange({ content: e.target.value })}
            placeholder="Start writing…"
            aria-label="Note content"
            className="min-h-[30vh] w-full flex-1 resize-none bg-transparent text-base leading-7 outline-none placeholder:text-muted-foreground/50"
          />
          <AttachmentList attachments={note.attachments} onRemove={onRemoveAttachment} />
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
        <span>
          {words} {words === 1 ? "word" : "words"} · {note.content.length} characters
        </span>
        <span className="flex items-center gap-1">
          <Check className="size-3 text-emerald-500" /> Saved · edited {formatDate(note.updatedAt)}
        </span>
      </footer>
    </article>
  );
}
