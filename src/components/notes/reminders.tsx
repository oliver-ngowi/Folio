"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { noteTitle, type Note } from "@/lib/notes-store";
import { dueTimestamp, formatDay, formatTime } from "@/lib/dates";

const FIRED_KEY = "folio-reminded";
const STALE_MS = 6 * 3600_000; // don't pop up reminders that were missed hours ago

type Alert = { key: string; id: string; title: string; when: string };

function loadFired(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Shows a system notification; uses the service worker when available (needed on Android). */
async function notify(title: string, body: string, tag: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag });
      return;
    }
  } catch {
    /* fall back to the plain Notification below */
  }
  try {
    new Notification(title, { body, tag });
  } catch {
    /* some mobile browsers only allow the service worker route */
  }
}

/**
 * Checks tasks every few seconds while Folio is open and shows a small card
 * (plus a browser notification if allowed) when a reminder is due.
 */
export function ReminderWatcher({ notes, onOpen }: { notes: Note[]; onOpen: (id: string) => void }) {
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const fired = React.useRef<Set<string> | null>(null);

  // Register the tiny service worker once (it only handles notification clicks).
  React.useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  React.useEffect(() => {
    const tick = () => {
      fired.current ??= loadFired();
      const seen = fired.current;
      const now = Date.now();
      const fresh: Alert[] = [];
      for (const t of notes) {
        if (t.kind !== "task" || t.done || !t.date || t.remind === null) continue;
        const due = dueTimestamp(t.date, t.time);
        const trigger = due - t.remind * 60_000;
        if (now < trigger) continue;
        const key = `${t.id}:${trigger}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (now - trigger > STALE_MS) continue;
        const when = `${formatDay(t.date)}${t.time ? `, ${formatTime(t.time)}` : ""}`;
        fresh.push({ key, id: t.id, title: noteTitle(t), when });
      }
      if (fresh.length === 0) return;
      try {
        localStorage.setItem(FIRED_KEY, JSON.stringify([...seen].slice(-200)));
      } catch {
        /* storage unavailable */
      }
      setAlerts((a) => [...a, ...fresh]);
      for (const f of fresh) void notify(f.title, `Due ${f.when}`, f.key);
    };
    const first = setTimeout(tick, 500);
    const timer = setInterval(tick, 15_000);
    // Background tabs throttle timers, so also check the moment you come back.
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [notes]);

  if (alerts.length === 0) return null;
  const dismiss = (key: string) => setAlerts((a) => a.filter((x) => x.key !== key));

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {alerts.map((a) => (
        <div
          key={a.key}
          role="alert"
          className="pointer-events-auto flex flex-col gap-2 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-lg"
        >
          <div>
            <p className="text-xs font-medium text-muted-foreground">Reminder</p>
            <p className="mt-0.5 font-medium">{a.title}</p>
            <p className="text-sm text-muted-foreground">Due {a.when}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => dismiss(a.key)}>
              Dismiss
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onOpen(a.id);
                dismiss(a.key);
              }}
            >
              Open
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
