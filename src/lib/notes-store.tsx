"use client";

import * as React from "react";
import { deleteBlob } from "./media-store";
import { supabaseEnabled } from "./supabase";
import { fetchRemote, pushChanges } from "./supabase-sync";

export type Folder = { id: string; name: string; color: string };
export type Attachment = {
  id: string;
  kind: "image" | "audio";
  name: string;
  size: number;
  /** Seconds, for voice notes. */
  duration?: number;
  createdAt: number;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  attachments: Attachment[];
  folderId: string | null;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

type State = { folders: Folder[]; notes: Note[] };

type NotePatch = Partial<Pick<Note, "title" | "content" | "folderId" | "pinned">>;

type Action =
  | { type: "hydrate"; state: State }
  | { type: "addNote"; note: Note }
  | { type: "updateNote"; id: string; patch: NotePatch }
  | { type: "deleteNote"; id: string }
  | { type: "addAttachment"; noteId: string; attachment: Attachment }
  | { type: "removeAttachment"; noteId: string; attachmentId: string }
  | { type: "addFolder"; folder: Folder }
  | { type: "updateFolder"; id: string; patch: Partial<Omit<Folder, "id">> }
  | { type: "deleteFolder"; id: string };

export const FOLDER_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#0ea5e9",
  "#ef4444",
  "#8b5cf6",
  "#64748b",
];

const STORAGE_KEY = "folio-notes-v1";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

function seed(): State {
  const raw = seedRaw();
  return { ...raw, notes: raw.notes.map((n) => ({ ...n, attachments: [] })) };
}

function seedRaw(): { folders: Folder[]; notes: Omit<Note, "attachments">[] } {
  const now = Date.now();
  const work = { id: uid(), name: "Work", color: FOLDER_COLORS[0] };
  const personal = { id: uid(), name: "Personal", color: FOLDER_COLORS[3] };
  const ideas = { id: uid(), name: "Ideas", color: FOLDER_COLORS[2] };
  return {
    folders: [work, personal, ideas],
    notes: [
      {
        id: uid(),
        title: "Welcome to Folio",
        content:
          "Folio keeps your notes organised in folders.\n\n• Create a folder from the + next to “Folders” in the sidebar.\n• Press “New note” to start writing — everything saves automatically.\n• Drag a note from the list onto a folder to move it.\n• Pin the notes you need most so they stay at the top.\n\nAll data is stored privately in this browser.",
        folderId: null,
        pinned: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        title: "Weekly planning",
        content: "Monday: roadmap review\nWednesday: design sync\nFriday: ship release notes",
        folderId: work.id,
        pinned: false,
        createdAt: now - 3_600_000,
        updatedAt: now - 3_600_000,
      },
      {
        id: uid(),
        title: "Grocery list",
        content: "Oats\nBlueberries\nOlive oil\nCoffee beans",
        folderId: personal.id,
        pinned: false,
        createdAt: now - 86_400_000,
        updatedAt: now - 86_400_000,
      },
      {
        id: uid(),
        title: "App idea: reading tracker",
        content: "Track books, highlights and weekly reading goals. Export highlights to notes.",
        folderId: ideas.id,
        pinned: false,
        createdAt: now - 172_800_000,
        updatedAt: now - 172_800_000,
      },
    ],
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "addNote":
      return { ...state, notes: [action.note, ...state.notes] };
    case "updateNote":
      return {
        ...state,
        notes: state.notes.map((n) => {
          if (n.id !== action.id) return n;
          const edited = "title" in action.patch || "content" in action.patch;
          return { ...n, ...action.patch, updatedAt: edited ? Date.now() : n.updatedAt };
        }),
      };
    case "deleteNote":
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
    case "addAttachment":
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.noteId
            ? { ...n, attachments: [...n.attachments, action.attachment], updatedAt: Date.now() }
            : n,
        ),
      };
    case "removeAttachment":
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.noteId
            ? {
                ...n,
                attachments: n.attachments.filter((a) => a.id !== action.attachmentId),
                updatedAt: Date.now(),
              }
            : n,
        ),
      };
    case "addFolder":
      return { ...state, folders: [...state.folders, action.folder] };
    case "updateFolder":
      return {
        ...state,
        folders: state.folders.map((f) => (f.id === action.id ? { ...f, ...action.patch } : f)),
      };
    case "deleteFolder":
      // Notes are never lost: they move to "Unfiled".
      return {
        folders: state.folders.filter((f) => f.id !== action.id),
        notes: state.notes.map((n) => (n.folderId === action.id ? { ...n, folderId: null } : n)),
      };
  }
}

type Wrapped = State & { hydrated: boolean };
const EMPTY: Wrapped = { folders: [], notes: [], hydrated: false };

function wrappedReducer(s: Wrapped, action: Action): Wrapped {
  if (action.type === "hydrate") return { ...action.state, hydrated: true };
  return { ...reducer({ folders: s.folders, notes: s.notes }, action), hydrated: s.hydrated };
}

type Store = {
  folders: Folder[];
  notes: Note[];
  hydrated: boolean;
  createNote: (folderId: string | null) => string;
  updateNote: (id: string, patch: NotePatch) => void;
  deleteNote: (id: string) => void;
  addAttachment: (noteId: string, attachment: Attachment) => void;
  removeAttachment: (noteId: string, attachmentId: string) => void;
  createFolder: (name: string, color: string) => string;
  updateFolder: (id: string, patch: Partial<Omit<Folder, "id">>) => void;
  deleteFolder: (id: string) => void;
};

const NotesContext = React.createContext<Store | null>(null);

export function NotesProvider({ children, userId }: { children: React.ReactNode; userId: string | null }) {
  // Cache per user so one account never sees (or uploads) another's notes on a shared browser.
  const storageKey = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
  const [wrapped, dispatch] = React.useReducer(wrappedReducer, EMPTY);
  const { hydrated, ...state } = wrapped;

  // Last state known to match Supabase; null until the first remote load finishes.
  const synced = React.useRef<State | null>(null);
  const pushing = React.useRef<Promise<void>>(Promise.resolve());
  const [remoteReady, setRemoteReady] = React.useState(false);

  React.useEffect(() => {
    let loaded: State | null = null;
    try {
      let raw = localStorage.getItem(storageKey);
      if (!raw && userId) {
        // One-time adoption of notes written before accounts existed.
        raw = localStorage.getItem(STORAGE_KEY);
        if (raw) localStorage.removeItem(STORAGE_KEY);
      }
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        if (Array.isArray(parsed.folders) && Array.isArray(parsed.notes)) {
          // Notes saved before attachments existed get an empty list.
          loaded = { ...parsed, notes: parsed.notes.map((n) => ({ ...n, attachments: n.attachments ?? [] })) };
        }
      }
    } catch {
      /* ignore corrupt or unavailable storage */
    }
    const local = loaded ?? seed();
    dispatch({ type: "hydrate", state: local });

    // Then reconcile with Supabase (if configured). Remote data wins when it exists;
    // otherwise the local notes are uploaded by the sync effect below.
    if (!supabaseEnabled) return;
    let cancelled = false;
    fetchRemote().then((remote) => {
      if (cancelled || !remote) return;
      if (remote.folders.length || remote.notes.length) {
        synced.current = remote;
        dispatch({ type: "hydrate", state: remote });
      } else {
        synced.current = { folders: [], notes: [] };
      }
      setRemoteReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mounted user
  }, []);

  React.useEffect(() => {
    if (!hydrated || !remoteReady) return;
    const t = setTimeout(() => {
      const next = { folders: state.folders, notes: state.notes };
      pushing.current = pushing.current.then(async () => {
        const prev = synced.current;
        if (!prev) return;
        try {
          await pushChanges(prev, next);
          synced.current = next;
        } catch (e) {
          // Keep `synced` as-is so the next change retries the whole difference.
          console.warn("[folio] Supabase sync failed; will retry on next change.", e);
        }
      });
    }, 800);
    return () => clearTimeout(t);
  }, [state, hydrated, remoteReady]);

  React.useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        /* storage full or blocked */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [state, hydrated, storageKey]);

  const store = React.useMemo<Store>(
    () => ({
      folders: state.folders,
      notes: state.notes,
      hydrated,
      createNote: (folderId) => {
        const now = Date.now();
        const note: Note = {
          id: uid(),
          title: "",
          content: "",
          attachments: [],
          folderId,
          pinned: false,
          createdAt: now,
          updatedAt: now,
        };
        dispatch({ type: "addNote", note });
        return note.id;
      },
      updateNote: (id, patch) => dispatch({ type: "updateNote", id, patch }),
      deleteNote: (id) => {
        // Free the stored photos/recordings along with the note.
        state.notes.find((n) => n.id === id)?.attachments.forEach((a) => deleteBlob(a.id));
        dispatch({ type: "deleteNote", id });
      },
      addAttachment: (noteId, attachment) => dispatch({ type: "addAttachment", noteId, attachment }),
      removeAttachment: (noteId, attachmentId) => {
        deleteBlob(attachmentId);
        dispatch({ type: "removeAttachment", noteId, attachmentId });
      },
      createFolder: (name, color) => {
        const folder = { id: uid(), name, color };
        dispatch({ type: "addFolder", folder });
        return folder.id;
      },
      updateFolder: (id, patch) => dispatch({ type: "updateFolder", id, patch }),
      deleteFolder: (id) => dispatch({ type: "deleteFolder", id }),
    }),
    [state, hydrated],
  );

  return <NotesContext.Provider value={store}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = React.useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}

export type View =
  | { type: "home" }
  | { type: "all" }
  | { type: "pinned" }
  | { type: "unfiled" }
  | { type: "folder"; id: string };

export function noteTitle(n: Pick<Note, "title">) {
  return n.title.trim() || "Untitled note";
}
