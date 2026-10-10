/**
 * Presentation helpers for focus history rows (T-008).
 *
 * Pure: the "now" reading is always injected, so day labels never depend on
 * the wall clock inside the function. `en-US` is pinned for deterministic,
 * locale-stable output in tests and UI.
 */
import type { Instant } from "../../data/contracts";
import { localDateOf } from "../../lib/date";

const LOCALE = "en-US";
const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Day index for a `YYYY-MM-DD` local date. The format compares
 * lexicographically in chronological order; parsing the parts through
 * `Date.UTC` keeps the arithmetic free of time-zone offsets.
 */
function calendarDayIndex(localDate: string): number {
  const [year, month, day] = localDate.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY);
}

/**
 * Human day label for a history row: `"Today"`, `"Yesterday"`, or an absolute
 * date (`"Oct 9"` within the current year, `"Dec 31, 2025"` otherwise).
 */
export function sessionDayLabel(instant: Instant, nowMs: number): string {
  const startDay = localDateOf(instant);
  const today = localDateOf(new Date(nowMs).toISOString());
  const dayDifference = calendarDayIndex(today) - calendarDayIndex(startDay);
  if (dayDifference === 0) return "Today";
  if (dayDifference === 1) return "Yesterday";

  const start = new Date(instant);
  const now = new Date(nowMs);
  const sameYear = start.getFullYear() === now.getFullYear();
  return start.toLocaleDateString(
    LOCALE,
    sameYear
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" },
  );
}

/** `"Today, 02:05 PM"` — the "Started" column of the session history. */
export function formatSessionStart(instant: Instant, nowMs: number): string {
  const time = new Date(instant).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${sessionDayLabel(instant, nowMs)}, ${time}`;
}
