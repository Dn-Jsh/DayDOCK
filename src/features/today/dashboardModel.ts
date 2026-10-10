/**
 * Pure selectors and formatting helpers for the Today dashboard (T-006).
 *
 * Every figure shown on the page is derived here from stored rows plus an
 * explicit `today` local date (`YYYY-MM-DD` from `todayLocalDate()`), so the
 * rules are unit-testable and no date/business logic lives in JSX. Components
 * only call these functions — never inline comparisons.
 *
 * No I/O, no clock reads: `today` is always passed in by the caller.
 */
import type { Task } from "../../data/contracts";
import { isPastLocalDate, localDateOf } from "../../lib/date";

/**
 * Tasks due on `today` — `due_date = today`, both statuses (an unfinished
 * task and one finished today both belong in "Due today").
 * A `null` due date never matches.
 */
export function selectDueToday(tasks: readonly Task[], today: string): Task[] {
  return tasks.filter((task) => task.dueDate === today);
}

/**
 * Overdue — due before `today` and still pending. Completed tasks with a past
 * due date are *not* overdue, and tasks without a due date never are.
 */
export function selectOverdue(tasks: readonly Task[], today: string): Task[] {
  return tasks.filter(
    (task) =>
      task.status === "pending" &&
      task.dueDate !== null &&
      isPastLocalDate(task.dueDate, today),
  );
}

/** Local calendar date of an instant, or `null` when unset/unparseable. */
function completedLocalDateOf(task: Task): string | null {
  if (task.completedAt === null) return null;
  try {
    return localDateOf(task.completedAt);
  } catch {
    return null;
  }
}

/**
 * Tasks completed on `today` — `completedAt` falls on this local calendar
 * day. Tasks completed on an earlier (or later) day are excluded, and a
 * reopened task (`completedAt = null`) never counts.
 */
export function selectCompletedToday(tasks: readonly Task[], today: string): Task[] {
  return tasks.filter((task) => completedLocalDateOf(task) === today);
}

/** High-priority tasks that are still pending. */
export function selectPriorityTasks(tasks: readonly Task[]): Task[] {
  return tasks.filter(
    (task) => task.status === "pending" && task.priority === "high",
  );
}

/**
 * Formats a `YYYY-MM-DD` local date as a long English date, e.g.
 * "Saturday, October 10, 2026". The parts are used only to build a local-time
 * `Date` for formatting — classification logic always compares the raw
 * `YYYY-MM-DD` strings. An unparseable value is returned unchanged.
 */
export function formatLongDate(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return localDate;
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return localDate;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** `pluralizeCount(1, "task")` → "1 task"; `pluralizeCount(0, …)` → "0 tasks". */
export function pluralizeCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
