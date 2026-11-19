"use client";

import * as React from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  FOLDER_COLORS,
  NotesProvider,
  noteTitle,
  useNotes,
  type Folder,
  type Kind,
  type View,
} from "@/lib/notes-store";
import { AppSidebar } from "./app-sidebar";
import { CalendarView } from "./calendar-view";
import { HomeScreen } from "./home-screen";
import { FolderDialog } from "./folder-dialog";
import { NoteEditor } from "./note-editor";
import { NoteList, type SortKey } from "./note-list";
import { ReminderWatcher } from "./reminders";
import { TaskList } from "./task-list";
import { cn } from "@/lib/utils";

const NOUN: Record<Kind, string> = { note: "note", journal: "entry", task: "task" };

function NotesWorkspace() {
  const store = useNotes();
  const { folders, notes, hydrated } = store;

  const [rawView, setView] = React.useState<View>({ type: "home" });
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("updated");
  const [folderDialog, setFolderDialog] = React.useState<{ open: boolean; folder: Folder | null }>({
    open: false,
    folder: null,
  });
  const [folderToDelete, setFolderToDelete] = React.useState<Folder | null>(null);
  const [noteToDelete, setNoteToDelete] = React.useState<string | null>(null);

  // If the open folder was deleted, fall back to all notes.
  const activeFolder =
    rawView.type === "folder" ? folders.find((f) => f.id === rawView.id) : undefined;
  const view = React.useMemo<View>(
    () => (rawView.type === "folder" && !activeFolder ? { type: "notes" } : rawView),
    [rawView, activeFolder],
  );

  // Which kind of entry the current list shows.
  const listKind: Kind = view.type === "journal" ? "journal" : view.type === "tasks" ? "task" : "note";

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = notes.filter((n) => {
      if (n.kind !== listKind) return false;
      if (view.type === "folder" && n.folderId !== view.id) return false;
      if (q && !(n.title + "\n" + n.content).toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => {
      // The journal reads like a diary: newest day first.
      if (listKind === "journal") return (b.date ?? "").localeCompare(a.date ?? "") || b.createdAt - a.createdAt;
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === "title") return noteTitle(a).localeCompare(noteTitle(b));
      return sort === "created" ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt;
    });
  }, [notes, view, listKind, query, sort]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const deleting = notes.find((n) => n.id === noteToDelete);

  const heading =
    view.type === "journal" ? "Journal" : view.type === "folder" ? (activeFolder?.name ?? "Folder") : "Notes";

  const viewForKind = (kind: Kind): View =>
    kind === "journal" ? { type: "journal" } : kind === "task" ? { type: "tasks" } : view.type === "folder" ? view : { type: "notes" };

  const newEntry = (kind: Kind, init?: { title?: string; date?: string | null }) => {
    setQuery("");
    const folderId = view.type === "folder" ? view.id : null;
    setView(viewForKind(kind));
    setSelectedId(store.createNote(folderId, kind, init));
  };

  const changeView = (v: View) => {
    setView(v);
    setQuery("");
    setSelectedId(null);
  };

  const openEntry = (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    setView(
      n.kind === "note" && view.type === "folder" && n.folderId === view.id ? view : viewForKind(n.kind),
    );
    setSelectedId(id);
  };

  const addTask = (title: string, date: string | null) => {
    store.createNote(null, "task", { title, date });
  };

  const toggleTask = (id: string, done: boolean) => store.updateNote(id, { done });

  const writeJournal = (date: string) => {
    setView({ type: "journal" });
    setSelectedId(store.createNote(null, "journal", { date }));
  };

  if (!hydrated) {
    return (
      <div className="flex h-svh gap-4 p-4">
        <Skeleton className="hidden h-full w-64 md:block" />
        <Skeleton className="h-full w-full md:w-96" />
        <Skeleton className="hidden h-full flex-1 md:block" />
      </div>
    );
  }

  const editor = (
    <div className={cn("h-full min-h-0 min-w-0 flex-1", !selected && "hidden md:flex")}>
      <NoteEditor
        key={selected?.id ?? "none"}
        note={selected}
        folders={folders}
        onChange={(patch) => selected && store.updateNote(selected.id, patch)}
        onDelete={() => selected && setNoteToDelete(selected.id)}
        onBack={() => setSelectedId(null)}
        onNewNote={() => newEntry(listKind)}
        onAddAttachment={(a) => selected && store.addAttachment(selected.id, a)}
        onRemoveAttachment={(id) => selected && store.removeAttachment(selected.id, id)}
      />
    </div>
  );

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar
        folders={folders}
        notes={notes}
        view={view}
        onViewChange={changeView}
        onNewEntry={(k) => newEntry(k)}
        onNewFolder={() => setFolderDialog({ open: true, folder: null })}
        onEditFolder={(f) => setFolderDialog({ open: true, folder: f })}
        onDeleteFolder={setFolderToDelete}
        onMoveNote={(id, folderId) => store.updateNote(id, { folderId })}
      />
      <SidebarInset className="min-h-0 min-w-0 flex-row overflow-hidden">
        {view.type === "home" ? (
          <HomeScreen
            notes={notes}
            folders={folders}
            onNewEntry={(k) => newEntry(k)}
            onOpenNote={openEntry}
            onDeleteNote={store.deleteNote}
            onToggleTask={toggleTask}
          />
        ) : view.type === "calendar" ? (
          <CalendarView
            notes={notes}
            onOpen={openEntry}
            onToggleTask={toggleTask}
            onAddTask={(title, date) => addTask(title, date)}
            onWriteJournal={writeJournal}
          />
        ) : view.type === "tasks" ? (
          <>
            {/* On phones show either the list or the editor, never both. */}
            <div className={cn("h-full min-h-0 w-full md:w-auto", selected && "hidden md:block")}>
              <TaskList
                tasks={notes.filter((n) => n.kind === "task")}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onToggle={toggleTask}
                onAdd={addTask}
              />
            </div>
            {editor}
          </>
        ) : (
          <>
            <div className={cn("h-full min-h-0 w-full md:w-auto", selected && "hidden md:block")}>
              <NoteList
                key={view.type === "folder" ? `folder-${view.id}` : view.type}
                heading={heading}
                notes={visible}
                folders={folders}
                selectedId={selectedId}
                query={query}
                onQuery={setQuery}
                sort={sort}
                onSort={setSort}
                onSelect={setSelectedId}
                onNewNote={() => newEntry(listKind)}
                kind={listKind}
                showSort={listKind === "note"}
                canMove={listKind === "note"}
                onBulkDelete={(ids) => {
                  ids.forEach((id) => store.deleteNote(id));
                  if (selectedId && ids.includes(selectedId)) setSelectedId(null);
                }}
                onBulkMove={(ids, folderId) => ids.forEach((id) => store.updateNote(id, { folderId }))}
                showFolderTag={view.type !== "folder" && listKind === "note"}
              />
            </div>
            {editor}
          </>
        )}
      </SidebarInset>

      <ReminderWatcher notes={notes} onOpen={openEntry} />

      <FolderDialog
        open={folderDialog.open}
        folder={folderDialog.folder}
        defaultColor={FOLDER_COLORS[folders.length % FOLDER_COLORS.length]}
        onOpenChange={(open) => setFolderDialog((s) => ({ ...s, open }))}
        onSubmit={(name, color) => {
          if (folderDialog.folder) {
            store.updateFolder(folderDialog.folder.id, { name, color });
          } else {
            const id = store.createFolder(name, color);
            changeView({ type: "folder", id });
          }
        }}
      />

      <AlertDialog open={!!folderToDelete} onOpenChange={(o) => !o && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{folderToDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The folder will be removed. Its notes are kept and moved out of the folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => folderToDelete && store.deleteFolder(folderToDelete.id)}
            >
              Delete folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!noteToDelete} onOpenChange={(o) => !o && setNoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {NOUN[deleting?.kind ?? "note"]}?</AlertDialogTitle>
            <AlertDialogDescription>This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (noteToDelete) {
                  store.deleteNote(noteToDelete);
                  setSelectedId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

export function NotesApp({ userId }: { userId: string | null }) {
  return (
    <NotesProvider userId={userId}>
      <NotesWorkspace />
    </NotesProvider>
  );
}
