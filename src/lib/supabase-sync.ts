"use client";

import type { Attachment, Folder, Note } from "./notes-store";
import { getSupabase, getUserId } from "./supabase";

export type SyncState = { folders: Folder[]; notes: Note[] };

type FolderRow = { id: string; name: string; color: string };
type NoteRow = {
  id: string;
  folder_id: string | null;
  title: string;
  content: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};
type AttachmentRow = {
  id: string;
  note_id: string;
  kind: "image" | "audio";
  name: string;
  size: number;
  duration: number | null;
  created_at: string;
};

const iso = (ms: number) => new Date(ms).toISOString();

const folderRow = (f: Folder): FolderRow => ({ id: f.id, name: f.name, color: f.color });
const noteRow = (n: Note): NoteRow => ({
  id: n.id,
  folder_id: n.folderId,
  title: n.title,
  content: n.content,
  pinned: n.pinned,
  created_at: iso(n.createdAt),
  updated_at: iso(n.updatedAt),
});
const attachmentRow = (noteId: string, a: Attachment): AttachmentRow => ({
  id: a.id,
  note_id: noteId,
  kind: a.kind,
  name: a.name,
  size: a.size,
  duration: a.duration ?? null,
  created_at: iso(a.createdAt),
});

function flatten(state: SyncState) {
  return {
    folders: new Map(state.folders.map((f) => [f.id, folderRow(f)])),
    notes: new Map(state.notes.map((n) => [n.id, noteRow(n)])),
    attachments: new Map(
      state.notes.flatMap((n) => n.attachments.map((a) => [a.id, attachmentRow(n.id, a)] as const)),
    ),
  };
}

/** Rows present in `next` that are new or changed vs `prev`, and ids removed from `next`. */
function diff<T>(prev: Map<string, T>, next: Map<string, T>) {
  const upserts: T[] = [];
  for (const [id, row] of next) {
    const old = prev.get(id);
    if (!old || JSON.stringify(old) !== JSON.stringify(row)) upserts.push(row);
  }
  const deletes = [...prev.keys()].filter((id) => !next.has(id));
  return { upserts, deletes };
}

/** Loads everything the signed-in user owns. Returns null if Supabase is off or the request fails. */
export async function fetchRemote(): Promise<SyncState | null> {
  const sb = getSupabase();
  if (!sb || !(await getUserId())) return null;

  const [folders, notes, attachments] = await Promise.all([
    sb.from("folders").select("id,name,color"),
    sb.from("notes").select("id,folder_id,title,content,pinned,created_at,updated_at"),
    sb.from("attachments").select("id,note_id,kind,name,size,duration,created_at"),
  ]);
  const error = folders.error ?? notes.error ?? attachments.error;
  if (error) {
    console.warn("[folio] Couldn't load from Supabase; using local data.", error.message);
    return null;
  }

  const byNote = new Map<string, Attachment[]>();
  for (const a of (attachments.data ?? []) as AttachmentRow[]) {
    const list = byNote.get(a.note_id) ?? [];
    list.push({
      id: a.id,
      kind: a.kind,
      name: a.name,
      size: Number(a.size),
      duration: a.duration ?? undefined,
      createdAt: Date.parse(a.created_at),
    });
    byNote.set(a.note_id, list);
  }

  return {
    folders: (folders.data ?? []) as FolderRow[],
    notes: ((notes.data ?? []) as NoteRow[])
      .map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        folderId: n.folder_id,
        pinned: n.pinned,
        createdAt: Date.parse(n.created_at),
        updatedAt: Date.parse(n.updated_at),
        attachments: (byNote.get(n.id) ?? []).sort((a, b) => a.createdAt - b.createdAt),
      }))
      .sort((a, b) => b.createdAt - a.createdAt),
  };
}

/** Writes the difference between two states. Throws on the first failed request. */
export async function pushChanges(prev: SyncState, next: SyncState): Promise<void> {
  const sb = getSupabase();
  if (!sb || !(await getUserId())) throw new Error("Supabase unavailable");

  const a = flatten(prev);
  const b = flatten(next);
  const folders = diff(a.folders, b.folders);
  const notes = diff(a.notes, b.notes);
  const attachments = diff(a.attachments, b.attachments);

  const check = (res: { error: { message: string } | null }) => {
    if (res.error) throw new Error(res.error.message);
  };

  // Parents before children on the way in, children before parents on the way out.
  if (folders.upserts.length) check(await sb.from("folders").upsert(folders.upserts));
  if (notes.upserts.length) check(await sb.from("notes").upsert(notes.upserts));
  if (attachments.upserts.length) check(await sb.from("attachments").upsert(attachments.upserts));
  if (attachments.deletes.length) check(await sb.from("attachments").delete().in("id", attachments.deletes));
  if (notes.deletes.length) check(await sb.from("notes").delete().in("id", notes.deletes));
  if (folders.deletes.length) check(await sb.from("folders").delete().in("id", folders.deletes));
}
