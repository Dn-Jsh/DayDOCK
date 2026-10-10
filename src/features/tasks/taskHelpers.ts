/**
 * Pure task-display helpers for the tasks feature (T-004).
 *
 * Everything here is side-effect free so it can be unit tested: due-date
 * wording (including overdue detection), result-count copy and the small
 * type-safe coercions that turn `<select>` strings back into `TaskFilter`
 * values. Filtering itself lives in `src/data/repositories/tasks.ts` — these
 * helpers only shape what the UI shows and never re-filter a list.
 */
import type { Priority, TaskFilter, TaskStatus, LocalDate } from "../../data/contracts";
import { isPastLocalDate } from "../../lib/date";

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Every task filter at its neutral default (matches all tasks). */
export function defaultTaskFilter(): TaskFilter {
  return { status: "all", priority: "all", projectId: "all", query: "" };
}

/** True when `filter` would return every task (no narrowing at all). */
export function isDefaultFilter(filter: TaskFilter): boolean {
  const status = filter.status ?? "all";
  const priority = filter.priority ?? "all";
  const projectId = filter.projectId ?? "all";
  const query = filter.query?.trim() ?? "";
  return status === "all" && priority === "all" && projectId === "all" && query.length === 0;
}

/** Result-count copy: "12 of 40 tasks", "0 of 1 task", "5 tasks" would lie less. */
export function formatResultCount(shown: number, total: number): string {
  const noun = total === 1 ? "task" : "tasks";
  return `${shown} of ${total} ${noun}`;
}

/** Coerces a `<select>` value back to the status filter it represents. */
export function statusFilterFrom(value: string): TaskStatus | "all" {
  return value === "pending" || value === "completed" ? value : "all";
}

/** Coerces a `<select>` value back to the priority filter it represents. */
export function priorityFilterFrom(value: string): Priority | "all" {
  return value === "low" || value === "medium" || value === "high" ? value : "all";
}

/** Coerces a `<select>` value ("all" / "none" / numeric id) to its filter. */
export function projectFilterFrom(value: string): number | "none" | "all" {
  if (value === "none" || value === "all") {
    return value;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : "all";
}

/** `2026-10-08` + today `2026-10-10` → "Oct 8"; other years append ", 2025". */
export function formatShortDate(dueDate: LocalDate, today: LocalDate): string {
  const [, monthText, dayText] = dueDate.split("-");
  const monthIndex = Number(monthText) - 1;
  const month = SHORT_MONTHS[monthIndex] ?? "";
  const year = dueDate.slice(0, 4);
  const currentYear = today.slice(0, 4);
  return `${month} ${Number(dayText)}${year === currentYear ? "" : `, ${year}`}`;
}

export interface DueDateInfo {
  /** Full visible text, e.g. "Overdue (was due Oct 8)" or "Due today". */
  text: string;
  /** True only for an unfinished task whose due date is before today. */
  isOverdue: boolean;
}

/**
 * Describes a task's due date for display. Returns `null` when the task has
 * no due date. Completed tasks are never "overdue" — their date is reported
 * as a plain past date.
 */
export function describeDueDate(
  dueDate: LocalDate | null,
  status: TaskStatus,
  today: LocalDate,
): DueDateInfo | null {
  if (dueDate === null) {
    return null;
  }
  const short = formatShortDate(dueDate, today);
  if (isPastLocalDate(dueDate, today)) {
    return status === "completed"
      ? { text: `Due ${short}`, isOverdue: false }
      : { text: `Overdue (was due ${short})`, isOverdue: true };
  }
  if (dueDate === today) {
    return { text: "Due today", isOverdue: false };
  }
  const tomorrow = new Date(`${today}T00:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowText = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  if (dueDate === tomorrowText) {
    return { text: "Due tomorrow", isOverdue: false };
  }
  return { text: `Due ${short}`, isOverdue: false };
}
