import { describe, expect, it } from "vitest";
import { formatSessionStart, sessionDayLabel } from "./sessionTime";

/* Local-time constructions keep the assertions independent of the machine's
   time zone: the helper converts instants to local calendar days. */
const NOW = new Date(2026, 9, 10, 20, 0, 0).getTime(); /* 2026-10-10 20:00 local */
const THIS_EVENING = new Date(2026, 9, 10, 14, 5, 0).toISOString();
const YESTERDAY_LATE = new Date(2026, 9, 9, 23, 30, 0).toISOString();
const EARLIER_THIS_YEAR = new Date(2026, 9, 7, 10, 0, 0).toISOString();
const LAST_YEAR = new Date(2025, 11, 31, 10, 0, 0).toISOString();

describe("sessionDayLabel", () => {
  it("labels an instant from the same calendar day as Today", () => {
    expect(sessionDayLabel(THIS_EVENING, NOW)).toBe("Today");
  });

  it("labels the previous calendar day as Yesterday, even across midnight", () => {
    expect(sessionDayLabel(YESTERDAY_LATE, NOW)).toBe("Yesterday");
  });

  it("falls back to an absolute date for older sessions in the current year", () => {
    expect(sessionDayLabel(EARLIER_THIS_YEAR, NOW)).toBe("Oct 7");
  });

  it("includes the year when the session is from a previous year", () => {
    expect(sessionDayLabel(LAST_YEAR, NOW)).toBe("Dec 31, 2025");
  });
});

describe("formatSessionStart", () => {
  it("combines the day label with a 12-hour local time", () => {
    expect(formatSessionStart(THIS_EVENING, NOW)).toBe("Today, 02:05 PM");
  });

  it("renders older sessions as an absolute date with the time", () => {
    expect(formatSessionStart(EARLIER_THIS_YEAR, NOW)).toBe("Oct 7, 10:00 AM");
  });
});
