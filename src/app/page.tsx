"use client";

import { AuthGate } from "@/components/auth-gate";
import { NotesApp } from "@/components/notes/notes-app";

export default function Home() {
  // `key` remounts the app (fresh store) whenever a different user signs in.
  return <AuthGate>{(userId) => <NotesApp key={userId ?? "local"} userId={userId} />}</AuthGate>;
}
