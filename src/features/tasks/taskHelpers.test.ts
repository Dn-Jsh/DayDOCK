import { describe, expect, it } from "vitest";
import {
  defaultTaskFilter,
  describeDueDate,
  formatResultCount,
  formatShortDate,
  isDefaultFilter,
  priorityFilterFrom,
  projectFilterFrom,
  statusFilterFrom,
} from "./taskHelpers";

describe("defaultTaskFilter", () => {
  it("returns a fresh neutral filter each call", () => {
    const first = defaultTaskFilter();
    const second = defaultTaskFilter();
    expect(first).toEqual({ status: "all", priority: "all", projectId: "all", query: "" });
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });
});

describe("isDefaultFilter", () => {
  it("treats the neutral filter, undefined fields and blank queries as default", () => {
    expect(isDefaultFilter(defaultTaskFilter())).toBe(true);
    expect(isDefaultFilter({})).toBe(true);
    expect(isDefaultFilter({ query: "   " })).toBe(true);
  });

  it("detects every narrowing dimension", () => {
    expect(isDefaultFilter({ status: "pending" })).toBe(false);
    expect(isDefaultFilter({ priority: "high" })).toBe(false);
    expect(isDefaultFilter({ projectId: "none" })).toBe(false);
    expect(isDefaultFilter({ projectId: 7 })).toBe(false);
    expect(isDefaultFilter({ query: "report" })).toBe(false);
  });
});

describe("formatResultCount", () => {
  it("pluralises the noun from the total", () => {
    expect(formatResultCount(12, 40)).toBe("12 of 40 tasks");
    expect(formatResultCount(1, 1)).toBe("1 of 1 task");
    expect(formatResultCount(0, 1)).toBe("0 of 1 task");
    expect(formatResultCount(0, 0)).toBe("0 of 0 tasks");
  });
});

describe("select value coercion", () => {
  it("narrows status values and falls back to all", () => {
    expect(statusFilterFrom("pending")).toBe("pending");
    expect(statusFilterFrom("completed")).toBe("completed");
    expect(statusFilterFrom("all")).toBe("all");
    expect(statusFilterFrom("nonsense")).toBe("all");
  });

  it("narrows priority values and falls back to all", () => {
    expect(priorityFilterFrom("low")).toBe("low");
    expect(priorityFilterFrom("high")).toBe("high");
    expect(priorityFilterFrom("")).toBe("all");
  });

  it("keeps 'none'/'all' literals and only valid numeric ids", () => {
    expect(projectFilterFrom("none")).toBe("none");
    expect(projectFilterFrom("all")).toBe("all");
    expect(projectFilterFrom("12")).toBe(12);
    expect(projectFilterFrom("0")).toBe("all");
    expect(projectFilterFrom("-3")).toBe("all");
    expect(projectFilterFrom("abc")).toBe("all");
  });
});

describe("formatShortDate", () => {
  it("omits the year when it matches today's year", () => {
    expect(formatShortDate("2026-10-08", "2026-10-10")).toBe("Oct 8");
    expect(formatShortDate("2026-01-01", "2026-12-31")).toBe("Jan 1");
  });

  it("appends the year when the date is in another year", () => {
    expect(formatShortDate("2025-12-31", "2026-01-02")).toBe("Dec 31, 2025");
    expect(formatShortDate("2027-02-14", "2026-10-10")).toBe("Feb 14, 2027");
  });
});

describe("describeDueDate", () => {
  it("returns null when there is no due date", () => {
    expect(describeDueDate(null, "pending", "2026-10-10")).toBeNull();
    expect(describeDueDate(null, "completed", "2026-10-10")).toBeNull();
  });

  it("marks a past date on a pending task as overdue", () => {
    const info = describeDueDate("2026-10-08", "pending", "2026-10-10");
    expect(info).toEqual({ text: "Overdue (was due Oct 8)", isOverdue: true });
  });

  it("never marks a completed task as overdue", () => {
    const info = describeDueDate("2026-10-08", "completed", "2026-10-10");
    expect(info).toEqual({ text: "Due Oct 8", isOverdue: false });
  });

  it("describes today and tomorrow", () => {
    expect(describeDueDate("2026-10-10", "pending", "2026-10-10")).toEqual({
      text: "Due today",
      isOverdue: false,
    });
    expect(describeDueDate("2026-10-11", "pending", "2026-10-10")).toEqual({
      text: "Due tomorrow",
      isOverdue: false,
    });
  });

  it("describes a future date with its short form", () => {
    expect(describeDueDate("2026-10-15", "pending", "2026-10-10")).toEqual({
      text: "Due Oct 15",
      isOverdue: false,
    });
  });

  it("handles month/year boundaries for tomorrow", () => {
    expect(describeDueDate("2026-01-01", "pending", "2025-12-31")).toEqual({
      text: "Due tomorrow",
      isOverdue: false,
    });
  });
});
