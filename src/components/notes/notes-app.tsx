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
import { FOLDER_COLORS, NotesProvider, noteTitle, useNotes, type Folder, type View } from "@/lib/notes-store";
import { AppSidebar } from "./app-sidebar";
import { HomeScreen } from "./home-screen";
import { FolderDialog } from "./folder-dialog";
import { NoteEditor } from "./note-editor";
import { NoteList, type SortKey } from "./note-list";
import { cn } from "@/lib/utils";

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
    () => (rawView.type === "folder" && !activeFolder ? { type: "all" } : rawView),
    [rawView, activeFolder],
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = notes.filter((n) => {
      if (view.type === "pinned" && !n.pinned) return false;
      if (view.type === "unfiled" && n.folderId !== null) return false;
      if (view.type === "folder" && n.folderId !== view.id) return false;
      if (q && !(n.title + "\n" + n.content).toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === "title") return noteTitle(a).localeCompare(noteTitle(b));
      return sort === "created" ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt;
    });
  }, [notes, view, query, sort]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const heading =
    view.type === "all"
      ? "All notes"
      : view.type === "pinned"
        ? "Pinned"
        : view.type === "unfiled"
          ? "Unfiled"
          : (activeFolder?.name ?? "Folder");

  const newNote = () => {
    const folderId = view.type === "folder" ? view.id : null;
    setQuery("");
    if (view.type === "home") setView({ type: "all" });
    setSelectedId(store.createNote(folderId));
  };

  const changeView = (v: View) => {
    setView(v);
    setQuery("");
    // Leaving a note open when switching to Home would hide the Home screen.
    if (v.type === "home") setSelectedId(null);
  };

  const openFromHome = (id: string) => {
    setView({ type: "all" });
    setSelectedId(id);
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

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar
        folders={folders}
        notes={notes}
        view={view}
        onViewChange={changeView}
        onNewNote={newNote}
        onNewFolder={() => setFolderDialog({ open: true, folder: null })}
        onEditFolder={(f) => setFolderDialog({ open: true, folder: f })}
        onDeleteFolder={setFolderToDelete}
        onMoveNote={(id, folderId) => store.updateNote(id, { folderId })}
      />
      <SidebarInset className="min-h-0 min-w-0 flex-row overflow-hidden">
        {view.type === "home" ? (
          <HomeScreen notes={notes} folders={folders} onNewNote={newNote} onOpenNote={openFromHome}
            onDeleteNote={store.deleteNote}
          />
        ) : (
        <>
        {/* On phones show either the list or the editor, never both. */}
        <div className={cn("h-full min-h-0 w-full md:w-auto", selected && "hidden md:block")}>
          <NoteList
            heading={heading}
            notes={visible}
            folders={folders}
            selectedId={selectedId}
            query={query}
            onQuery={setQuery}
            sort={sort}
            onSort={setSort}
            onSelect={setSelectedId}
            onNewNote={newNote}
            showFolderTag={view.type !== "folder"}
          />
        </div>
        <div className={cn("h-full min-h-0 min-w-0 flex-1", !selected && "hidden md:flex")}>
          <NoteEditor
            key={selected?.id ?? "none"}
            note={selected}
            folders={folders}
            onChange={(patch) => selected && store.updateNote(selected.id, patch)}
            onDelete={() => selected && setNoteToDelete(selected.id)}
            onBack={() => setSelectedId(null)}
            onNewNote={newNote}
            onAddAttachment={(a) => selected && store.addAttachment(selected.id, a)}
            onRemoveAttachment={(id) => selected && store.removeAttachment(selected.id, id)}
          />
        </div>
        </>
        )}
      </SidebarInset>

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
              The folder will be removed. Its notes are kept and moved to Unfiled.
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
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the note and can’t be undone.</AlertDialogDescription>
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
              Delete note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

export function NotesApp() {
  return (
    <NotesProvider>
      <NotesWorkspace />
    </NotesProvider>
  );
}
