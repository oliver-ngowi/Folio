"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, NotebookPen, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { enabled, loading, session, signIn, signUp } = useAuth();
  const router = useRouter();

  const [mode, setMode] = React.useState<Mode>("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "error" | "info"; text: string } | null>(null);

  // Already signed in (or auth is off): nothing to do here.
  React.useEffect(() => {
    if (!loading && (session || !enabled)) router.replace("/");
  }, [loading, session, enabled, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setMessage(null);
    if (mode === "signup" && password.length < 6) {
      setMessage({ type: "error", text: "Use a password of at least 6 characters." });
      return;
    }
    setBusy(true);
    const res = mode === "signin" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(false);
    if (res.error) setMessage({ type: "error", text: res.error });
    else if (res.needsConfirmation)
      setMessage({ type: "info", text: "Check your email for a confirmation link, then sign in." });
    // On success the session change redirects to "/".
  };

  const isSignIn = mode === "signin";

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <NotebookPen className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{isSignIn ? "Welcome back" : "Create your account"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignIn ? "Sign in to open your notes." : "Your notes will sync across your devices."}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              required
              autoComplete={isSignIn ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10"
            />
          </div>

          <div aria-live="polite" role="status">
            {message && (
              <p
                className={
                  message.type === "error"
                    ? "flex items-start gap-1.5 text-sm text-destructive"
                    : "flex items-start gap-1.5 text-sm text-emerald-600 dark:text-emerald-400"
                }
              >
                {message.type === "error" ? (
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <Check className="mt-0.5 size-4 shrink-0" />
                )}
                {message.text}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" disabled={busy || !enabled}>
            {busy ? "Please wait…" : isSignIn ? "Sign in" : "Create account"}
          </Button>
          {!enabled && !loading && (
            <p className="text-center text-xs text-muted-foreground">
              Supabase isn’t configured. Set the keys in .env.local and restart the dev server.
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignIn ? "New to Folio?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setMode(isSignIn ? "signup" : "signin");
              setMessage(null);
            }}
          >
            {isSignIn ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}
