import { describe, it, expect } from "vitest";
import { ValidationError, type TaskInput } from "./contracts";
import {
  LIMITS,
  parseLocalDate,
  validateFocusDurationMinutes,
  validateFocusSessionInput,
  validateFocusState,
  validateNoteInput,
  validateProjectName,
  validateTaskInput,
} from "./validation";

function fieldErrorsOf(run: () => unknown): Record<string, string> {
  try {
    run();
  } catch (error) {
    if (error instanceof ValidationError) {
      return error.fieldErrors;
    }
    throw error;
  }
  throw new Error("Expected a ValidationError to be thrown");
}

describe("validateTaskInput", () => {
  it("accepts a minimal valid input and applies defaults", () => {
    const result = validateTaskInput({ title: "Write report" });
    expect(result).toEqual({
      title: "Write report",
      description: "",
      priority: "medium",
      dueDate: null,
      projectId: null,
    });
  });

  it("trims the title and preserves the description verbatim", () => {
    const result = validateTaskInput({
      title: "  Trimmed title  ",
      description: "  keep   spacing  ",
    });
    expect(result.title).toBe("Trimmed title");
    expect(result.description).toBe("  keep   spacing  ");
  });

  it("accepts a title of exactly 200 characters", () => {
    const result = validateTaskInput({ title: "a".repeat(LIMITS.taskTitle) });
    expect(result.title).toHaveLength(200);
  });

  it("rejects an empty or whitespace-only title", () => {
    expect(fieldErrorsOf(() => validateTaskInput({ title: "" }))).toEqual({
      title: "Title is required",
    });
    expect(fieldErrorsOf(() => validateTaskInput({ title: "   " }))).toEqual({
      title: "Title is required",
    });
  });

  it("rejects a title over 200 characters", () => {
    const errors = fieldErrorsOf(() => validateTaskInput({ title: "a".repeat(201) }));
    expect(errors.title).toBe("Title must be 200 characters or fewer");
  });

  it("accepts a description of exactly 5000 characters and rejects 5001", () => {
    expect(() =>
      validateTaskInput({ title: "t", description: "d".repeat(LIMITS.taskDescription) }),
    ).not.toThrow();
    const errors = fieldErrorsOf(() =>
      validateTaskInput({ title: "t", description: "d".repeat(5001) }),
    );
    expect(errors.description).toBe("Description must be 5000 characters or fewer");
  });

  it("rejects an unknown priority and an invalid project id", () => {
    const errors = fieldErrorsOf(() =>
      validateTaskInput({
        title: "t",
        priority: "urgent" as TaskInput["priority"],
        projectId: -3,
      }),
    );
    expect(errors).toEqual({
      priority: "Priority must be low, medium or high",
      projectId: "Selected project is invalid",
    });
  });

  it("collects every field error in one exception", () => {
    const errors = fieldErrorsOf(() => validateTaskInput({ title: "", dueDate: "2026-02-30" }));
    expect(Object.keys(errors).sort()).toEqual(["dueDate", "title"]);
  });
});

describe("parseLocalDate", () => {
  it("accepts a real calendar date and returns it unchanged", () => {
    expect(parseLocalDate("2026-10-10")).toBe("2026-10-10");
  });

  it("accepts leap days in leap years", () => {
    expect(parseLocalDate("2024-02-29")).toBe("2024-02-29");
    expect(parseLocalDate("2000-02-29")).toBe("2000-02-29");
  });

  it("rejects leap days in non-leap years", () => {
    expect(fieldErrorsOf(() => parseLocalDate("2026-02-29"))).toEqual({
      dueDate: "Due date must be a valid date in YYYY-MM-DD format",
    });
    // 1900 was not a leap year (divisible by 100, not by 400).
    expect(() => parseLocalDate("1900-02-29")).toThrow(ValidationError);
  });

  it("rejects impossible months and days", () => {
    expect(() => parseLocalDate("2026-13-01")).toThrow(ValidationError);
    expect(() => parseLocalDate("2026-00-10")).toThrow(ValidationError);
    expect(() => parseLocalDate("2026-04-31")).toThrow(ValidationError);
    expect(() => parseLocalDate("2026-12-32")).toThrow(ValidationError);
  });

  it("rejects values that are not exactly YYYY-MM-DD", () => {
    expect(() => parseLocalDate("")).toThrow(ValidationError);
    expect(() => parseLocalDate("2026-1-1")).toThrow(ValidationError);
    expect(() => parseLocalDate("10-10-2026")).toThrow(ValidationError);
    expect(() => parseLocalDate("2026-10-10T00:00:00.000Z")).toThrow(ValidationError);
    expect(() => parseLocalDate(20261010 as unknown as string)).toThrow(ValidationError);
  });

  it("keys the error on the provided field name", () => {
    expect(fieldErrorsOf(() => parseLocalDate("nope", "due"))).toEqual({
      due: "Due date must be a valid date in YYYY-MM-DD format",
    });
  });
});

describe("validateProjectName", () => {
  it("accepts and trims a valid name", () => {
    expect(validateProjectName("  School  ")).toBe("School");
  });

  it("accepts a name of exactly 60 characters and rejects 61", () => {
    expect(validateProjectName("p".repeat(60))).toHaveLength(60);
    const errors = fieldErrorsOf(() => validateProjectName("p".repeat(61)));
    expect(errors.name).toBe("Project name must be 60 characters or fewer");
  });

  it("rejects an empty, whitespace or non-string name", () => {
    expect(fieldErrorsOf(() => validateProjectName(""))).toEqual({
      name: "Project name is required",
    });
    expect(fieldErrorsOf(() => validateProjectName("   "))).toEqual({
      name: "Project name is required",
    });
    expect(fieldErrorsOf(() => validateProjectName(null))).toEqual({
      name: "Project name is required",
    });
  });
});

describe("validateNoteInput", () => {
  it("accepts a valid note and defaults content to empty", () => {
    expect(validateNoteInput({ title: " Ideas " })).toEqual({ title: "Ideas", content: "" });
  });

  it("accepts a title of exactly 200 characters and rejects 201", () => {
    expect(validateNoteInput({ title: "n".repeat(200) }).title).toHaveLength(200);
    expect(fieldErrorsOf(() => validateNoteInput({ title: "n".repeat(201) }))).toEqual({
      title: "Note title must be 200 characters or fewer",
    });
  });

  it("rejects an empty note title", () => {
    expect(fieldErrorsOf(() => validateNoteInput({ title: "  " }))).toEqual({
      title: "Note title is required",
    });
  });

  it("accepts content of exactly 100000 characters and rejects 100001", () => {
    expect(validateNoteInput({ title: "t", content: "c".repeat(100_000) }).content).toHaveLength(
      100_000,
    );
    const errors = fieldErrorsOf(() =>
      validateNoteInput({ title: "t", content: "c".repeat(100_001) }),
    );
    expect(errors.content).toBe("Note content must be 100000 characters or fewer");
  });
});

describe("validateFocusDurationMinutes", () => {
  it("accepts the boundary values 1 and 180 and a typical value", () => {
    expect(validateFocusDurationMinutes(1)).toBe(1);
    expect(validateFocusDurationMinutes(25)).toBe(25);
    expect(validateFocusDurationMinutes(180)).toBe(180);
  });

  it("rejects out-of-range and non-integer values", () => {
    for (const value of [0, -1, 181, 25.5, Number.NaN, Infinity, "25", null]) {
      const errors = fieldErrorsOf(() => validateFocusDurationMinutes(value));
      expect(errors.focusDurationMinutes).toBe(
        "Focus duration must be a whole number of minutes between 1 and 180",
      );
    }
  });
});

describe("validateFocusSessionInput", () => {
  const valid = {
    startedAt: "2026-10-10T09:30:00.000Z",
    endedAt: "2026-10-10T10:00:00.000Z",
    plannedDurationMs: 1_800_000,
    actualDurationMs: 1_500_000,
    completed: false,
    taskId: 7,
  };

  it("accepts a valid session and defaults taskId to null", () => {
    const result = validateFocusSessionInput({ ...valid, taskId: undefined });
    expect(result.taskId).toBeNull();
    expect(result.endedAt).toBe("2026-10-10T10:00:00.000Z");
  });

  it("accepts a zero actual duration and null end", () => {
    const result = validateFocusSessionInput({
      ...valid,
      endedAt: null,
      actualDurationMs: 0,
    });
    expect(result.actualDurationMs).toBe(0);
    expect(result.endedAt).toBeNull();
  });

  it("rejects invalid instants, durations and task ids", () => {
    const errors = fieldErrorsOf(() =>
      validateFocusSessionInput({
        ...valid,
        startedAt: "not-a-date",
        endedAt: "2026-13-99",
        plannedDurationMs: 0,
        actualDurationMs: -1,
        taskId: 0,
      }),
    );
    expect(Object.keys(errors).sort()).toEqual([
      "actualDurationMs",
      "endedAt",
      "plannedDurationMs",
      "startedAt",
      "taskId",
    ]);
  });
});

describe("validateFocusState", () => {
  const valid = {
    status: "paused" as const,
    startedAt: "2026-10-10T09:30:00.000Z",
    elapsedBeforeMs: 60_000,
    plannedDurationMs: 1_500_000,
    taskId: null,
  };

  it("accepts a valid state", () => {
    expect(validateFocusState(valid)).toEqual(valid);
  });

  it("rejects an invalid status and negative elapsed time", () => {
    const errors = fieldErrorsOf(() =>
      validateFocusState({
        ...valid,
        status: "stopped" as unknown as "running",
        elapsedBeforeMs: -5,
      }),
    );
    expect(errors.status).toBe("Focus timer status must be running or paused");
    expect(errors.elapsedBeforeMs).toBe("Elapsed time is invalid");
  });

  it("rejects a planned duration outside 1–180 minutes", () => {
    const errors = fieldErrorsOf(() =>
      validateFocusState({ ...valid, plannedDurationMs: 30_000 }),
    );
    expect(errors.plannedDurationMs).toBe(
      "Planned duration must be between 1 and 180 minutes",
    );
  });
});
