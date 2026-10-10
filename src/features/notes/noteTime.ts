/**
 * Pure timestamp formatting for the notes feature (T-007).
 *
 * Instants are ISO-8601 UTC strings (see `src/data/contracts.ts`); these helpers
 * render them in the user's local time zone. `now` is injectable so the tests
 * are deterministic. No I/O, no side effects.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseInstant(instant: string): Date | null {
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Short label for the note list: "just now", "8 min ago", "35 min ago",
 * "2 h ago" (same calendar day), "Yesterday, 14:05", "Mon, 09:12" (within the
 * last 7 days) or "2026-09-30" beyond that. Calendar days are checked before
 * the rolling-hour window so a late-night note reads "Yesterday, 23:41" rather
 * than "13 h ago". Unparseable instants render as "—".
 */
export function formatShortUpdated(instant: string, now: Date = new Date()): string {
  const date = parseInstant(instant);
  if (date === null) return "—";

  const daysApart = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (daysApart > 1 && daysApart < 7) {
    const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
    return `${weekday}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  if (daysApart >= 7) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }
  if (daysApart === 1) {
    return `Yesterday, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  /* Same day (or a clock slightly ahead): use the rolling relative labels. */
  const deltaMs = now.getTime() - date.getTime();
  if (deltaMs < MINUTE_MS) return "just now";
  if (deltaMs < HOUR_MS) return `${Math.floor(deltaMs / MINUTE_MS)} min ago`;
  return `${Math.floor(deltaMs / HOUR_MS)} h ago`;
}

/**
 * Unambiguous label for the selected note's "last updated" line, e.g.
 * "10 Oct 2026, 14:32:05" in local time. Unparseable instants render as "—".
 */
export function formatFullUpdated(instant: string): string {
  const date = parseInstant(instant);
  if (date === null) return "—";
  const day = `${pad2(date.getDate())} ${date.toLocaleDateString(undefined, { month: "short" })} ${date.getFullYear()}`;
  return `${day}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}
