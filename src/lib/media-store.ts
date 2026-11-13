"use client";

import * as React from "react";

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

export const putBlob = (id: string, blob: Blob) => run("readwrite", (s) => s.put(blob, id));
export const getBlob = (id: string) => run<Blob | undefined>("readonly", (s) => s.get(id));
export const deleteBlob = (id: string) => run("readwrite", (s) => s.delete(id)).catch(() => undefined);

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

/** Shrinks large photos so they stay quick to load and cheap to store. */
export async function prepareImage(file: File): Promise<Blob> {
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
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
    return file;
  }
}
