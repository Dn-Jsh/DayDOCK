import { describe, expect, it } from "vitest";
import { formatFullUpdated, formatShortUpdated } from "./noteTime";

/** Local-time helper: builds an instant for a local wall-clock moment. */
function localInstant(
  year: number,
  monthIndex: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
): string {
  return new Date(year, monthIndex, day, hours, minutes, seconds, 0).toISOString();
}

/* Anchored to a fixed local "now" so the relative labels are deterministic. */
const NOW = new Date(2026, 9, 10, 12, 0, 0); /* 10 Oct 2026, 12:00 local */

describe("formatShortUpdated", () => {
  it("says 'just now' within the same minute", () => {
    expect(formatShortUpdated(localInstant(2026, 9, 10, 11, 59, 30), NOW)).toBe("just now");
  });

  it("says minutes ago below one hour", () => {
    expect(formatShortUpdated(localInstant(2026, 9, 10, 11, 52), NOW)).toBe("8 min ago");
    expect(formatShortUpdated(localInstant(2026, 9, 10, 11, 1), NOW)).toBe("59 min ago");
  });

  it("says hours ago below one day", () => {
    expect(formatShortUpdated(localInstant(2026, 9, 10, 9, 30), NOW)).toBe("2 h ago");
  });

  it("says yesterday with the clock time", () => {
    expect(formatShortUpdated(localInstant(2026, 9, 9, 14, 5), NOW)).toBe("Yesterday, 14:05");
  });

  it("says weekday within the last seven days", () => {
    const instant = localInstant(2026, 9, 8, 9, 12); /* Tuesday */
    const weekday = new Date(2026, 9, 8).toLocaleDateString(undefined, { weekday: "short" });
    expect(formatShortUpdated(instant, NOW)).toBe(`${weekday}, 09:12`);
  });

  it("falls back to the ISO date beyond a week", () => {
    expect(formatShortUpdated(localInstant(2026, 8, 30, 8, 0), NOW)).toBe("2026-09-30");
  });

  it("renders an em dash for an unparseable instant", () => {
    expect(formatShortUpdated("not-a-date", NOW)).toBe("—");
  });
});

describe("formatFullUpdated", () => {
  it("renders an unambiguous local timestamp with seconds", () => {
    expect(formatFullUpdated(localInstant(2026, 9, 10, 14, 32, 5))).toContain("2026");
    expect(formatFullUpdated(localInstant(2026, 9, 10, 14, 32, 5))).toContain("14:32:05");
    expect(formatFullUpdated(localInstant(2026, 9, 10, 14, 32, 5))).toContain("10");
  });

  it("renders an em dash for an unparseable instant", () => {
    expect(formatFullUpdated("nope")).toBe("—");
  });
});
