import { describe, expect, it } from "vitest";
import type { Task } from "../../data/contracts";
import {
  formatLongDate,
  pluralizeCount,
  selectCompletedToday,
  selectDueToday,
  selectOverdue,
  selectPriorityTasks,
} from "./dashboardModel";

/** 2026-10-10 is a Saturday in the fixtures' local calendar. */
const TODAY = "2026-10-10";

let nextId = 1;

/** Fully-populated task with only the interesting fields overridden. */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: nextId++,
    title: "Fixture task",
    description: "",
    status: "pending",
    priority: "medium",
    dueDate: null,
    projectId: null,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

/** ISO instant for a local calendar day (round-trips through `localDateOf`). */
function instantOn(month: number, day: number, hour = 12): string {
  return new Date(2026, month - 1, day, hour, 0, 0, 0).toISOString();
}

describe("selectDueToday", () => {
  it("returns only tasks due today, regardless of status", () => {
    const dueTodayPending = makeTask({ dueDate: TODAY });
    const dueTodayCompleted = makeTask({
      dueDate: TODAY,
      status: "completed",
      completedAt: instantOn(10, 10),
    });
    const dueTomorrow = makeTask({ dueDate: "2026-10-11" });
    const overdue = makeTask({ dueDate: "2026-10-09" });

    expect(selectDueToday([dueTodayPending, dueTodayCompleted, dueTomorrow, overdue], TODAY)).toEqual([
      dueTodayPending,
      dueTodayCompleted,
    ]);
  });

  it("excludes tasks with a null due date", () => {
    const noDueDate = makeTask({ dueDate: null });
    expect(selectDueToday([noDueDate], TODAY)).toEqual([]);
  });

  it("returns an empty array for an empty task list", () => {
    expect(selectDueToday([], TODAY)).toEqual([]);
  });
});

describe("selectOverdue", () => {
  it("returns pending tasks due before today, including one day past", () => {
    const overdueByOneDay = makeTask({ dueDate: "2026-10-09" });
    const overdueByAWeek = makeTask({ dueDate: "2026-10-03" });

    expect(selectOverdue([overdueByOneDay, overdueByAWeek], TODAY)).toEqual([
      overdueByOneDay,
      overdueByAWeek,
    ]);
  });

  it("excludes completed, due-today, future and undated tasks", () => {
    const completedOverdue = makeTask({
      dueDate: "2026-10-01",
      status: "completed",
      completedAt: instantOn(10, 2),
    });
    const dueToday = makeTask({ dueDate: TODAY });
    const dueTomorrow = makeTask({ dueDate: "2026-10-11" });
    const noDueDate = makeTask({ dueDate: null });

    expect(
      selectOverdue([completedOverdue, dueToday, dueTomorrow, noDueDate], TODAY),
    ).toEqual([]);
  });

  it("returns an empty array for an empty task list", () => {
    expect(selectOverdue([], TODAY)).toEqual([]);
  });
});

describe("selectCompletedToday", () => {
  it("includes tasks completed today and excludes ones completed yesterday", () => {
    const completedToday = makeTask({
      status: "completed",
      completedAt: instantOn(10, 10, 9),
    });
    const completedYesterday = makeTask({
      status: "completed",
      completedAt: instantOn(10, 9, 23),
    });

    expect(selectCompletedToday([completedToday, completedYesterday], TODAY)).toEqual([
      completedToday,
    ]);
  });

  it("excludes pending tasks, reopened tasks and unparseable timestamps", () => {
    const pending = makeTask({ completedAt: null });
    const reopened = makeTask({ status: "pending", completedAt: null });
    const broken = makeTask({ completedAt: "not-an-instant" });

    expect(selectCompletedToday([pending, reopened, broken], TODAY)).toEqual([]);
  });

  it("returns an empty array for an empty task list", () => {
    expect(selectCompletedToday([], TODAY)).toEqual([]);
  });
});

describe("selectPriorityTasks", () => {
  it("returns high-priority pending tasks only", () => {
    const highPending = makeTask({ priority: "high" });
    const highPendingOverdue = makeTask({ priority: "high", dueDate: "2026-10-09" });
    const mediumPending = makeTask({ priority: "medium" });
    const lowPending = makeTask({ priority: "low" });

    expect(
      selectPriorityTasks([highPending, highPendingOverdue, mediumPending, lowPending]),
    ).toEqual([highPending, highPendingOverdue]);
  });

  it("excludes a high-priority task that is already completed", () => {
    const highCompleted = makeTask({
      priority: "high",
      status: "completed",
      completedAt: instantOn(10, 10),
    });
    expect(selectPriorityTasks([highCompleted])).toEqual([]);
  });

  it("returns an empty array for an empty task list", () => {
    expect(selectPriorityTasks([])).toEqual([]);
  });
});

describe("formatLongDate", () => {
  it("renders the long English date for a YYYY-MM-DD value", () => {
    expect(formatLongDate("2026-10-10")).toBe("Saturday, October 10, 2026");
  });

  it("handles single-digit months and days", () => {
    expect(formatLongDate("2026-01-05")).toBe("Monday, January 5, 2026");
  });

  it("returns unparseable input unchanged", () => {
    expect(formatLongDate("not-a-date")).toBe("not-a-date");
    expect(formatLongDate("")).toBe("");
  });
});

describe("pluralizeCount", () => {
  it("pluralises the noun from the count", () => {
    expect(pluralizeCount(0, "task")).toBe("0 tasks");
    expect(pluralizeCount(1, "task")).toBe("1 task");
    expect(pluralizeCount(12, "task")).toBe("12 tasks");
  });
});

describe("selectors over one shared fixture list", () => {
  const fixtures: Task[] = [
    makeTask({ title: "Due today", dueDate: TODAY }),
    makeTask({ title: "Due tomorrow", dueDate: "2026-10-11" }),
    makeTask({ title: "Overdue", dueDate: "2026-10-09" }),
    makeTask({ title: "Done yesterday", status: "completed", completedAt: instantOn(10, 9) }),
    makeTask({ title: "Done today", status: "completed", completedAt: instantOn(10, 10) }),
    makeTask({ title: "High and done", priority: "high", status: "completed", completedAt: instantOn(10, 10) }),
    makeTask({ title: "High pending", priority: "high", dueDate: null }),
    makeTask({ title: "No due date", dueDate: null }),
  ];

  it("partitions the fixture list per dashboard rule", () => {
    expect(selectDueToday(fixtures, TODAY).map((t) => t.title)).toEqual(["Due today"]);
    expect(selectOverdue(fixtures, TODAY).map((t) => t.title)).toEqual(["Overdue"]);
    expect(selectCompletedToday(fixtures, TODAY).map((t) => t.title)).toEqual([
      "Done today",
      "High and done",
    ]);
    expect(selectPriorityTasks(fixtures).map((t) => t.title)).toEqual(["High pending"]);
  });

  it("returns empty arrays for an empty list from every selector", () => {
    expect(selectDueToday([], TODAY)).toEqual([]);
    expect(selectOverdue([], TODAY)).toEqual([]);
    expect(selectCompletedToday([], TODAY)).toEqual([]);
    expect(selectPriorityTasks([])).toEqual([]);
  });
});
