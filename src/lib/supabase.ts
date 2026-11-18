"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_ vars must be referenced literally so Next.js can inline them.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && key);

export const MEDIA_BUCKET = "attachments";

let client: SupabaseClient | null = null;

/** Returns the shared browser client, or null when Supabase isn't configured. */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  client ??= createClient(url!, key!, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

/** The signed-in user's id, or null when signed out / Supabase is off. */
export async function getUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}
