/** Dates are stored as local "YYYY-MM-DD" strings and times as "HH:mm" (no time zones to get wrong). */

const pad = (n: number) => String(n).padStart(2, "0");

export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toDateStr(new Date());

export function parseDateStr(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number) {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** "Today", "Tomorrow", "Yesterday" or "Thu, 19 Nov". Pass absolute to always get the date. */
export function formatDay(s: string, opts: { absolute?: boolean; long?: boolean } = {}) {
  if (!opts.absolute) {
    const t = todayStr();
    if (s === t) return "Today";
    if (s === addDays(t, 1)) return "Tomorrow";
    if (s === addDays(t, -1)) return "Yesterday";
  }
  const d = parseDateStr(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString([], {
    weekday: opts.long ? "long" : "short",
    day: "numeric",
    month: opts.long ? "long" : "short",
    year: sameYear ? undefined : "numeric",
  });
}

export function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** When a task is due. Tasks without a time are due at 9:00 for reminder purposes. */
export function dueTimestamp(date: string, time: string | null) {
  const d = parseDateStr(date);
  if (time) {
    const [h, m] = time.split(":").map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d.getTime();
}

export function isOverdue(n: { date: string | null; time: string | null; done: boolean }) {
  if (!n.date || n.done) return false;
  return n.time ? dueTimestamp(n.date, n.time) < Date.now() : n.date < todayStr();
}
