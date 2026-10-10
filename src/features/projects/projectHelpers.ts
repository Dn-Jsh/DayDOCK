/**
 * Pure display helpers for the projects feature (T-005).
 *
 * Everything here is side-effect free so it can be unit tested: progress
 * arithmetic (0% for a project with zero tasks — never `NaN`), count copy and
 * the created-date formatting shown on each project card.
 *
 * Name validation is deliberately NOT duplicated here: the data layer
 * (`validateProjectName` in `src/data/validation.ts`) owns the 1–60 character
 * rule and throws `ValidationError.fieldErrors`, which `ProjectDialog` renders
 * inline next to the field.
 */
import type { Instant, LocalDate, Task } from "../../data/contracts";
import { localDateOf } from "../../lib/date";

/** Completion figures for one project, as shown in the header. */
export interface ProjectProgressSummary {
  total: number;
  completed: number;
  /** Rounded 0–100; always a finite number, even for an empty project. */
  percent: number;
}

/**
 * Completion percentage for `completed` of `total` tasks: rounded to a whole
 * number and clamped to `[0, 100]`. A project with no tasks reports 0, so the
 * UI can never render `NaN%`.
 */
export function projectPercent(completed: number, total: number): number {
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  const clamped = Math.min(Math.max(completed, 0), total);
  return Math.round((clamped / total) * 100);
}

/**
 * Progress summary computed from the task rows actually rendered, so the
 * header figures and the list below them can never disagree.
 */
export function summarizeProjectTasks(
  tasks: Array<Pick<Task, "status">>,
): ProjectProgressSummary {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === "completed").length;
  return { total, completed, percent: projectPercent(completed, total) };
}

/** Card count copy: "8/12 tasks", "1/1 task", "0/0 tasks". */
export function formatTaskCount(completed: number, total: number): string {
  const noun = total === 1 ? "task" : "tasks";
  return `${completed}/${total} ${noun}`;
}

/** List count copy: "3 projects", "1 project", "0 projects". */
export function formatProjectCount(count: number): string {
  return `${count} ${count === 1 ? "project" : "projects"}`;
}

/** A project's creation date, ready to render and to put in `<time dateTime>`. */
export interface CreatedDateInfo {
  /** Local calendar date (`YYYY-MM-DD`), or `null` when the instant is invalid. */
  iso: LocalDate | null;
  /** Human label, e.g. "Oct 10, 2026" (locale pinned for a stable rendering). */
  label: string;
}

const CREATED_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** Formats a stored `createdAt` instant for the project card. Never throws. */
export function describeCreatedAt(instant: Instant): CreatedDateInfo {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) {
    return { iso: null, label: "unknown" };
  }
  return { iso: localDateOf(instant), label: CREATED_DATE_FORMAT.format(date) };
}
