import { describe, expect, it } from "vitest";
import type { Task } from "../../data/contracts";
import {
  describeCreatedAt,
  formatProjectCount,
  formatTaskCount,
  projectPercent,
  summarizeProjectTasks,
} from "./projectHelpers";

describe("projectPercent", () => {
  it("reports 0% for a project with no tasks (never NaN)", () => {
    expect(projectPercent(0, 0)).toBe(0);
  });

  it("rounds the completion ratio to a whole percent", () => {
    expect(projectPercent(8, 12)).toBe(67);
    expect(projectPercent(1, 3)).toBe(33);
    expect(projectPercent(0, 5)).toBe(0);
    expect(projectPercent(5, 5)).toBe(100);
  });

  it("clamps out-of-range and non-finite counts into 0–100", () => {
    expect(projectPercent(15, 12)).toBe(100);
    expect(projectPercent(-2, 12)).toBe(0);
    expect(projectPercent(Number.NaN, 12)).toBe(0);
    expect(projectPercent(3, Number.NaN)).toBe(0);
    expect(projectPercent(3, -4)).toBe(0);
  });
});

describe("summarizeProjectTasks", () => {
  it("counts the task rows actually rendered", () => {
    const tasks: Array<Pick<Task, "status">> = [
      { status: "completed" },
      { status: "pending" },
      { status: "completed" },
      { status: "pending" },
    ];
    expect(summarizeProjectTasks(tasks)).toEqual({ total: 4, completed: 2, percent: 50 });
  });

  it("summarises an empty project as 0 tasks and 0%", () => {
    expect(summarizeProjectTasks([])).toEqual({ total: 0, completed: 0, percent: 0 });
  });

  it("agrees with projectPercent for an uneven split", () => {
    const tasks: Array<Pick<Task, "status">> = [{ status: "completed" }, { status: "pending" }, { status: "pending" }];
    const summary = summarizeProjectTasks(tasks);
    expect(summary.percent).toBe(projectPercent(summary.completed, summary.total));
    expect(summary.percent).toBe(33);
  });
});

describe("formatTaskCount", () => {
  it("pluralises the noun from the total", () => {
    expect(formatTaskCount(8, 12)).toBe("8/12 tasks");
    expect(formatTaskCount(1, 1)).toBe("1/1 task");
    expect(formatTaskCount(0, 0)).toBe("0/0 tasks");
    expect(formatTaskCount(0, 1)).toBe("0/1 task");
  });
});

describe("formatProjectCount", () => {
  it("pluralises the noun from the count", () => {
    expect(formatProjectCount(0)).toBe("0 projects");
    expect(formatProjectCount(1)).toBe("1 project");
    expect(formatProjectCount(12)).toBe("12 projects");
  });
});

describe("describeCreatedAt", () => {
  it("formats a stored instant as a display label plus a machine-readable date", () => {
    const created = describeCreatedAt("2026-10-10T09:30:00.000Z");
    expect(created.label).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    expect(created.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("falls back safely when the instant cannot be parsed", () => {
    expect(describeCreatedAt("not-a-date")).toEqual({ iso: null, label: "unknown" });
  });
});
