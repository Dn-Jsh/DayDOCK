import { describe, it, expect, vi, afterEach } from "vitest";
import { formatClock, isPastLocalDate, localDateOf, todayLocalDate } from "./date";

afterEach(() => {
  vi.useRealTimers();
});

describe("todayLocalDate", () => {
  it("returns today's local date as YYYY-MM-DD (frozen clock)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10, 13, 45, 30));
    expect(todayLocalDate()).toBe("2026-10-10");
  });

  it("uses local midnight, not UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 1));
    expect(todayLocalDate()).toBe("2026-01-01");
  });

  it("always matches the YYYY-MM-DD shape", () => {
    expect(todayLocalDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("localDateOf", () => {
  it("converts an instant near UTC noon to the same local date (Singapore UTC+8)", () => {
    expect(localDateOf("2026-06-15T12:00:00.000Z")).toBe("2026-06-15");
  });

  it("agrees with the local calendar date of the parsed instant", () => {
    const instant = "2026-03-15T23:30:00.000Z";
    const parsed = new Date(instant);
    const expected = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    expect(localDateOf(instant)).toBe(expected);
  });

  it("round-trips with todayLocalDate for a midday instant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0));
    expect(localDateOf(new Date().toISOString())).toBe("2026-10-10");
  });

  it("throws for values that are not parseable instants", () => {
    expect(() => localDateOf("not-a-date")).toThrow("Invalid ISO-8601 instant");
    expect(() => localDateOf("")).toThrow("Invalid ISO-8601 instant");
  });
});

describe("formatClock", () => {
  it("formats zero as 00:00", () => {
    expect(formatClock(0)).toBe("00:00");
  });

  it("formats just under a minute as 00:59", () => {
    expect(formatClock(59_999)).toBe("00:59");
  });

  it("formats exactly one minute as 01:00", () => {
    expect(formatClock(60_000)).toBe("01:00");
  });

  it("formats exactly one hour as 1:00:00", () => {
    expect(formatClock(3_600_000)).toBe("1:00:00");
  });

  it("formats one hour one minute one second as 1:01:01", () => {
    expect(formatClock(3_661_000)).toBe("1:01:01");
  });

  it("formats 59:59 just below the hour", () => {
    expect(formatClock(3_599_999)).toBe("59:59");
  });

  it("clamps negative durations to 00:00", () => {
    expect(formatClock(-1)).toBe("00:00");
    expect(formatClock(-3_600_000)).toBe("00:00");
  });

  it("clamps non-finite values to 00:00", () => {
    expect(formatClock(Number.NaN)).toBe("00:00");
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe("00:00");
  });
});

describe("isPastLocalDate", () => {
  it("is true strictly before today (overdue)", () => {
    expect(isPastLocalDate("2026-10-09", "2026-10-10")).toBe(true);
    expect(isPastLocalDate("2020-01-01", "2026-10-10")).toBe(true);
  });

  it("is false for today itself", () => {
    expect(isPastLocalDate("2026-10-10", "2026-10-10")).toBe(false);
  });

  it("is false for future dates", () => {
    expect(isPastLocalDate("2026-10-11", "2026-10-10")).toBe(false);
    expect(isPastLocalDate("2027-12-31", "2026-10-10")).toBe(false);
  });

  it("compares chronologically across year boundaries", () => {
    expect(isPastLocalDate("2025-12-31", "2026-01-01")).toBe(true);
    expect(isPastLocalDate("2026-01-01", "2025-12-31")).toBe(false);
  });
});
