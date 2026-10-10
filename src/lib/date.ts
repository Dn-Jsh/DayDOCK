/**
 * Pure date/time helpers shared by the data layer and UI.
 *
 * Two kinds of values exist in DayDock (see `src/data/contracts.ts`):
 * - Instants: ISO-8601 UTC strings, e.g. `2026-10-10T09:30:00.000Z`.
 * - Local dates: `YYYY-MM-DD` in the user's time zone (due dates, "today").
 *
 * No I/O, no side effects — every function here is unit-testable.
 */

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatLocalDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/** Today's date in the local time zone, as `YYYY-MM-DD`. */
export function todayLocalDate(): string {
  const now = new Date();
  return formatLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Converts an ISO-8601 UTC instant to the local calendar date it falls on,
 * as `YYYY-MM-DD`. Throws for values that are not parseable instants.
 */
export function localDateOf(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO-8601 instant: ${instant}`);
  }
  return formatLocalDate(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Formats a millisecond duration as a clock string: `mm:ss`, or `h:mm:ss`
 * once it reaches an hour. Negative and non-finite values clamp to zero.
 */
export function formatClock(milliseconds: number): string {
  const safeMilliseconds = Number.isFinite(milliseconds)
    ? Math.max(0, Math.floor(milliseconds))
    : 0;
  const totalSeconds = Math.floor(safeMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${pad2(minutes)}:${pad2(seconds)}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
}

/**
 * True when `date` (a `YYYY-MM-DD` local date) is strictly before `today`.
 * Both values must use the same `YYYY-MM-DD` format, for which plain string
 * comparison is chronological. Used to classify overdue tasks.
 */
export function isPastLocalDate(date: string, today: string): boolean {
  return date < today;
}
