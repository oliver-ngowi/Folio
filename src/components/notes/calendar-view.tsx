"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { KIND_META, MOODS, type Note } from "@/lib/notes-store";
import { formatDay, isOverdue, parseDateStr, toDateStr, todayStr } from "@/lib/dates";
import { TaskRow } from "./task-list";
import { cn } from "@/lib/utils";

type Props = {
  notes: Note[];
  onOpen: (id: string) => void;
  onToggleTask: (id: string, done: boolean) => void;
  onAddTask: (title: string, date: string) => void;
  onWriteJournal: (date: string) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ notes, onOpen, onToggleTask, onAddTask, onWriteJournal }: Props) {
  const today = todayStr();
  const [selected, setSelected] = React.useState(today);
  const [month, setMonth] = React.useState(() => {
    const d = parseDateStr(today);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [title, setTitle] = React.useState("");

  // Everything that has a date, grouped by day.
  const byDay = React.useMemo(() => {
    const map = new Map<string, { tasks: Note[]; journal?: Note }>();
    for (const n of notes) {
      if (!n.date || n.kind === "note") continue;
      const day = map.get(n.date) ?? { tasks: [] };
      if (n.kind === "task") day.tasks.push(n);
      else day.journal = n;
      map.set(n.date, day);
    }
    return map;
  }, [notes]);

  const cells = React.useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const total = Math.ceil((first.getDay() + days) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(month.getFullYear(), month.getMonth(), i - first.getDay() + 1);
      return { date: toDateStr(d), day: d.getDate(), inMonth: d.getMonth() === month.getMonth() };
    });
  }, [month]);

  const goMonth = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const goToday = () => {
    const d = parseDateStr(today);
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelected(today);
  };

  const pick = (date: string) => {
    setSelected(date);
    const d = parseDateStr(date);
    if (d.getMonth() !== month.getMonth()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const day = byDay.get(selected);
  const tasks = (day?.tasks ?? []).slice().sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  const journal = day?.journal;
  const mood = MOODS.find((m) => m.id === journal?.mood);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [hint, setHint] = React.useState(false);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      // The button always works: with nothing typed it points you to the box.
      setHint(true);
      inputRef.current?.focus();
      return;
    }
    onAddTask(t, selected);
    setTitle("");
    setHint(false);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-background lg:flex-row lg:overflow-hidden">
      <section className="flex flex-col gap-4 p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <header className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
            {month.toLocaleDateString([], { month: "long", year: "numeric" })}
          </h1>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => goMonth(-1)}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => goMonth(1)}>
            <ChevronRight />
          </Button>
        </header>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Calendar">
          {cells.map((c) => {
            const info = byDay.get(c.date);
            const openTasks = info?.tasks.filter((t) => !t.done) ?? [];
            const hasTasks = (info?.tasks.length ?? 0) > 0;
            const late = info?.tasks.some((t) => isOverdue(t));
            const isToday = c.date === today;
            const isSel = c.date === selected;
            const summary = [
              info?.tasks.length ? `${info.tasks.length} task${info.tasks.length > 1 ? "s" : ""}` : "",
              info?.journal ? "journal entry" : "",
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <button
                key={c.date}
                type="button"
                role="gridcell"
                aria-selected={isSel}
                aria-label={`${formatDay(c.date, { absolute: true, long: true })}${summary ? `, ${summary}` : ""}`}
                onClick={() => pick(c.date)}
                className={cn(
                  "flex min-h-14 flex-col items-center gap-1 rounded-xl border border-transparent p-1.5 text-sm transition-colors hover:bg-muted sm:min-h-20",
                  !c.inMonth && "text-muted-foreground/50",
                  isSel && "border-foreground/30 bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full tabular-nums",
                    isToday && "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {c.day}
                </span>
                <span className="flex h-2 items-center gap-1">
                  {hasTasks && (
                    <span
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor: late ? "#ef4444" : KIND_META.task.color,
                        opacity: openTasks.length === 0 ? 0.35 : 1,
                      }}
                    />
                  )}
                  {info?.journal && (
                    <span className="size-2 rounded-full" style={{ backgroundColor: KIND_META.journal.color }} />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <p className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: KIND_META.task.color }} /> Tasks
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: KIND_META.journal.color }} /> Journal
          </span>
        </p>
      </section>

      <aside className="flex flex-col gap-5 border-t p-4 sm:p-6 lg:min-h-0 lg:w-96 lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l">
        <h2 className="text-base font-semibold tracking-tight">
          {formatDay(selected, { absolute: true, long: true })}
          {selected === today && <span className="ml-2 text-sm font-normal text-muted-foreground">Today</span>}
        </h2>

        <section aria-label="Journal" className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Journal</h3>
          {journal ? (
            <button
              type="button"
              onClick={() => onOpen(journal.id)}
              className="rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/70"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="min-w-0 flex-1 truncate">{journal.title.trim() || "Journal entry"}</span>
                {mood && (
                  <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ backgroundColor: mood.color }} />
                    {mood.label}
                  </span>
                )}
              </span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                {journal.content.replace(/\s+/g, " ").trim() || "Nothing written yet"}
              </span>
            </button>
          ) : (
            <Button variant="outline" className="justify-start" onClick={() => onWriteJournal(selected)}>
              Write about this day
            </Button>
          )}
        </section>

        <section aria-label="Tasks" className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tasks</h3>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing planned.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  showDate={false}
                  onToggle={() => onToggleTask(t.id, !t.done)}
                  onOpen={() => onOpen(t.id)}
                />
              ))}
            </div>
          )}
          <form onSubmit={addTask} className="flex gap-2">
            <Input
              ref={inputRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHint(false);
              }}
              placeholder="Add a task for this day…"
              aria-label="New task for this day"
              aria-invalid={hint}
            />
            <Button type="submit">
              <Plus /> Add
            </Button>
          </form>
          {hint && (
            <p role="alert" className="text-xs text-red-500">
              Type what you need to do, then press Add.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
