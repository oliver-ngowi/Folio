"use client";

import * as React from "react";
import { MEDIA_BUCKET, getSupabase, getUserId } from "./supabase";

/**
 * Photos and voice recordings are stored as Blobs in IndexedDB (localStorage is
 * far too small for them). Notes only keep lightweight metadata + an id.
 */
const DB_NAME = "folio-media";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/* IndexedDB is the fast local cache; Supabase Storage (when configured) is the durable copy. */

async function remotePath(id: string) {
  const userId = await getUserId();
  return userId ? `${userId}/${id}` : null;
}

async function uploadRemote(id: string, blob: Blob) {
  const sb = getSupabase();
  const path = await remotePath(id);
  if (!sb || !path) return;
  const { error } = await sb.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: blob.type || undefined, upsert: true });
  if (error) console.warn("[folio] Couldn't upload attachment to Supabase.", error.message);
}

async function downloadRemote(id: string): Promise<Blob | undefined> {
  const sb = getSupabase();
  const path = await remotePath(id);
  if (!sb || !path) return undefined;
  const { data, error } = await sb.storage.from(MEDIA_BUCKET).download(path);
  return error ? undefined : data;
}

async function deleteRemote(id: string) {
  const sb = getSupabase();
  const path = await remotePath(id);
  if (!sb || !path) return;
  await sb.storage.from(MEDIA_BUCKET).remove([path]);
}

export async function putBlob(id: string, blob: Blob) {
  await run("readwrite", (s) => s.put(blob, id));
  void uploadRemote(id, blob).catch(() => undefined);
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  const local = await run<Blob | undefined>("readonly", (s) => s.get(id)).catch(() => undefined);
  if (local) return local;
  // Not cached on this device (e.g. a new browser): fetch from Supabase and cache it.
  const remote = await downloadRemote(id).catch(() => undefined);
  if (remote) await run("readwrite", (s) => s.put(remote, id)).catch(() => undefined);
  return remote;
}

export const deleteBlob = (id: string) =>
  Promise.all([
    run("readwrite", (s) => s.delete(id)).catch(() => undefined),
    deleteRemote(id).catch(() => undefined),
  ]).then(() => undefined);

/** Loads a stored blob as an object URL and revokes it on unmount. */
export function useMediaUrl(id: string) {
  const [state, setState] = React.useState<{ url: string | null; failed: boolean }>({
    url: null,
    failed: false,
  });

  React.useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    getBlob(id)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) return setState({ url: null, failed: true });
        created = URL.createObjectURL(blob);
        setState({ url: created, failed: false });
      })
      .catch(() => !cancelled && setState({ url: null, failed: true }));
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [id]);

  return state;
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const MAX_DIMENSION = 1600;

export class UnsupportedImageError extends Error {
  constructor(public detected: string) {
    super(`Unsupported image (${detected})`);
  }
}

/** Identifies the real format from the file's first bytes (extensions and MIME types can lie). */
async function sniffFormat(file: Blob): Promise<string> {
  try {
    const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "JPEG";
    if (ascii(1, 4) === "PNG") return "PNG";
    if (ascii(0, 3) === "GIF") return "GIF";
    if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "WebP";
    if (ascii(4, 8) === "ftyp") {
      const brand = ascii(8, 12);
      return /^(avif|avis)$/.test(brand) ? "AVIF" : /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand) ? "HEIC" : `ftyp ${brand}`;
    }
    if (b.length === 0) return "empty file";
    return "unknown format";
  } catch {
    return "unreadable file";
  }
}

/** Resolves only if the browser can actually render the blob as an image. */
function canRender(blob: Blob) {
  const url = URL.createObjectURL(blob);
  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

/**
 * Shrinks large photos so they stay quick to load and cheap to store.
 * Throws UnsupportedImageError for files the browser can't display (e.g. HEIC,
 * corrupt files) so they never end up as broken pictures.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    if (!(await canRender(file))) throw new UnsupportedImageError(await sniffFormat(file));
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    // createImageBitmap can fail on formats <img> still handles (e.g. HEIC in Safari).
    if (await canRender(file)) return file;
    throw new UnsupportedImageError(await sniffFormat(file));
  }
}
