"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, supabaseEnabled } from "./supabase";

type AuthResult = { error: string | null; needsConfirmation?: boolean };

type Auth = {
  /** False when Supabase isn't configured: the app runs local-only with no login. */
  enabled: boolean;
  /** True until the stored session has been checked. */
  loading: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

/**
 * Where confirmation emails should send people. Prefer the configured public URL so
 * a sign-up made from localhost still links to the live site.
 */
function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  return configured || window.location.origin;
}

const AuthContext = React.createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(supabaseEnabled);

  React.useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = React.useMemo<Auth>(() => {
    const sb = getSupabase();
    const unavailable: AuthResult = { error: "Supabase isn’t configured." };
    return {
      enabled: supabaseEnabled,
      loading,
      session,
      signIn: async (email, password) => {
        if (!sb) return unavailable;
        const { error } = await sb.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signUp: async (email, password) => {
        if (!sb) return unavailable;
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${siteUrl()}/login` },
        });
        if (error) return { error: error.message };
        // With email confirmation on, no session is returned until the link is clicked.
        return { error: null, needsConfirmation: !data.session };
      },
      signOut: async () => {
        await sb?.auth.signOut();
      },
    };
  }, [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
