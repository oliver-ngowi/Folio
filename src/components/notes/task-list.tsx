"use client";

import * as React from "react";
import { Bell, Check, ChevronRight, ListTodo, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { KIND_META, noteTitle, type Note } from "@/lib/notes-store";
import { addDays, dueTimestamp, formatDay, formatTime, isOverdue, todayStr } from "@/lib/dates";
import { cn } from "@/lib/utils";

const TASK_COLOR = KIND_META.task.color;

/** Round tick box, shared by every place tasks appear. */
export function TaskCheck({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      style={{ borderColor: TASK_COLOR, backgroundColor: done ? TASK_COLOR : "transparent" }}
    >
      {done && <Check className="size-3 text-white" strokeWidth={3} />}
    </button>
  );
}

export function dueLabel(t: Pick<Note, "date" | "time">) {
  if (!t.date) return null;
  return formatDay(t.date) + (t.time ? `, ${formatTime(t.time)}` : "");
}

export function TaskRow({
  task,
  selected,
  onToggle,
  onOpen,
  showDate = true,
}: {
  task: Note;
  selected?: boolean;
  onToggle: () => void;
  onOpen: () => void;
  showDate?: boolean;
}) {
  const overdue = isOverdue(task);
  const label = dueLabel(task);
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:bg-muted/70",
        selected && "border-border bg-muted shadow-xs",
      )}
    >
      <TaskCheck done={task.done} onToggle={onToggle} label={`${task.done ? "Mark not done" : "Mark done"}: ${noteTitle(task)}`} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left">
        <span
          className={cn(
            "block truncate text-sm font-medium",
            task.done && "text-muted-foreground line-through",
            !task.title.trim() && "italic text-muted-foreground",
          )}
        >
          {noteTitle(task)}
        </span>
        {showDate && label && (
          <span
            className={cn(
              "mt-0.5 flex items-center gap-1 text-xs",
              overdue ? "font-medium text-red-500" : "text-muted-foreground",
            )}
          >
            {label}
            {task.remind !== null && !task.done && <Bell className="size-3" aria-label="Has a reminder" />}
          </span>
        )}
      </button>
    </div>
  );
}

type Props = {
  tasks: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onAdd: (title: string, date: string | null) => void;
};

export function TaskList({ tasks, selectedId, onSelect, onToggle, onAdd }: Props) {
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState<string | null>(null);
  const [showDone, setShowDone] = React.useState(false);

  const today = todayStr();
  const tomorrow = addDays(today, 1);

  const groups = React.useMemo(() => {
    const byDue = (a: Note, b: Note) =>
      (a.date ? dueTimestamp(a.date, a.time) : Infinity) - (b.date ? dueTimestamp(b.date, b.time) : Infinity) ||
      a.createdAt - b.createdAt;
    const open = tasks.filter((t) => !t.done).sort(byDue);
    const overdue = open.filter((t) => isOverdue(t));
    const rest = open.filter((t) => !isOverdue(t));
    return {
      overdue,
      today: rest.filter((t) => t.date === today),
      upcoming: rest.filter((t) => t.date && t.date > today),
      anytime: rest.filter((t) => !t.date),
      done: tasks.filter((t) => t.done).sort((a, b) => b.updatedAt - a.updatedAt),
      openCount: open.length,
    };
  }, [tasks, today]);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [hint, setHint] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      // The button always works: with nothing typed it points you to the box.
      setHint(true);
      inputRef.current?.focus();
      return;
    }
    onAdd(t, date);
    setTitle("");
    setDate(null);
    setHint(false);
  };

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs transition-colors",
      active ? "border-transparent text-white" : "text-muted-foreground hover:bg-muted",
    );

  const section = (name: string, list: Note[], tone?: "red") =>
    list.length > 0 && (
      <section key={name} aria-label={name}>
        <h2 className={cn("mb-1 px-3 text-xs font-medium uppercase tracking-wide", tone === "red" ? "text-red-500" : "text-muted-foreground")}>
          {name}
        </h2>
        <div className="flex flex-col gap-0.5">
          {list.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              selected={selectedId === t.id}
              onToggle={() => onToggle(t.id, !t.done)}
              onOpen={() => onSelect(t.id)}
              showDate={name !== "Today"}
            />
          ))}
        </div>
      </section>
    );

  const empty = tasks.length === 0;

  return (
    <section className="flex h-full min-h-0 w-full flex-col border-r bg-background md:w-80 lg:w-96 md:shrink-0">
      <header className="flex flex-col gap-3 p-4 pb-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">Tasks</h1>
          <span className="text-xs text-muted-foreground tabular-nums">{groups.openCount} to do</span>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHint(false);
              }}
              placeholder="Add a task…"
              aria-label="New task"
              aria-invalid={hint}
            />
            <Button type="submit">
              <Plus /> Add
            </Button>
          </div>
          {hint && (
            <p role="alert" className="text-xs text-red-500">
              Type what you need to do, then press Add.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Due date">
            <button
              type="button"
              className={chip(date === today)}
              style={date === today ? { backgroundColor: TASK_COLOR } : undefined}
              onClick={() => setDate(date === today ? null : today)}
            >
              Today
            </button>
            <button
              type="button"
              className={chip(date === tomorrow)}
              style={date === tomorrow ? { backgroundColor: TASK_COLOR } : undefined}
              onClick={() => setDate(date === tomorrow ? null : tomorrow)}
            >
              Tomorrow
            </button>
            <input
              type="date"
              value={date && date !== today && date !== tomorrow ? date : ""}
              onChange={(e) => setDate(e.target.value || null)}
              aria-label="Pick a date"
              className="h-7 rounded-full border bg-transparent px-2 text-xs text-muted-foreground"
            />
          </div>
        </form>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {empty ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <ListTodo className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">All clear</p>
              <p className="mt-1 text-sm text-muted-foreground">Add your first task above.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-3 pb-6">
            {section("Overdue", groups.overdue, "red")}
            {section("Today", groups.today)}
            {section("Upcoming", groups.upcoming)}
            {section("Anytime", groups.anytime)}
            {groups.openCount === 0 && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">Nothing left to do. Nice.</p>
            )}
            {groups.done.length > 0 && (
              <section aria-label="Done">
                <button
                  type="button"
                  onClick={() => setShowDone((v) => !v)}
                  aria-expanded={showDone}
                  className="mb-1 flex items-center gap-1 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className={cn("size-3.5 transition-transform", showDone && "rotate-90")} />
                  Done · {groups.done.length}
                </button>
                {showDone && (
                  <div className="flex flex-col gap-0.5">
                    {groups.done.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        selected={selectedId === t.id}
                        onToggle={() => onToggle(t.id, false)}
                        onOpen={() => onSelect(t.id)}
                        showDate={false}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </ScrollArea>
    </section>
  );
}
