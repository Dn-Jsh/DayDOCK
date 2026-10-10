import { describe, it, expect } from "vitest";
import {
  mapFocusSessionRow,
  mapFocusStateRow,
  type FocusSessionRow,
  type FocusStateRow,
} from "./focusSessions";
import { mapNoteRow, type NoteRow } from "./notes";
import { mapProjectRow, mapProjectWithProgressRow, type ProjectProgressRow, type ProjectRow } from "./projects";
import { mapSettingsRows, DEFAULT_SETTINGS } from "./settings";
import { mapTaskRow, type TaskRow } from "./tasks";

describe("mapTaskRow", () => {
  const fullRow: TaskRow = {
    id: 42,
    title: "Write report",
    description: "Quarterly numbers",
    status: "completed",
    priority: "high",
    due_date: "2026-10-10",
    project_id: 3,
    created_at: "2026-10-01T08:00:00.000Z",
    updated_at: "2026-10-02T09:30:00.000Z",
    completed_at: "2026-10-02T09:30:00.000Z",
  };

  it("maps a fully populated row to the camelCase Task", () => {
    expect(mapTaskRow(fullRow)).toEqual({
      id: 42,
      title: "Write report",
      description: "Quarterly numbers",
      status: "completed",
      priority: "high",
      dueDate: "2026-10-10",
      projectId: 3,
      createdAt: "2026-10-01T08:00:00.000Z",
      updatedAt: "2026-10-02T09:30:00.000Z",
      completedAt: "2026-10-02T09:30:00.000Z",
    });
  });

  it("maps every nullable column to null and defaults a missing description", () => {
    const task = mapTaskRow({
      ...fullRow,
      status: "pending",
      priority: "low",
      description: null,
      due_date: null,
      project_id: null,
      completed_at: null,
    });
    expect(task.description).toBe("");
    expect(task.dueDate).toBeNull();
    expect(task.projectId).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.status).toBe("pending");
    expect(task.priority).toBe("low");
  });

  it("keeps a zero id as-is", () => {
    expect(mapTaskRow({ ...fullRow, id: 0 }).id).toBe(0);
  });
});

describe("mapProjectRow", () => {
  const row: ProjectRow = {
    id: 1,
    name: "School",
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-05T11:00:00.000Z",
  };

  it("maps a row to the camelCase Project", () => {
    expect(mapProjectRow(row)).toEqual({
      id: 1,
      name: "School",
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-05T11:00:00.000Z",
    });
  });

  it("maps NULL aggregates of an empty project to zero progress", () => {
    const progressRow: ProjectProgressRow = { ...row, task_count: null, completed_count: null };
    const project = mapProjectWithProgressRow(progressRow);
    expect(project.taskCount).toBe(0);
    expect(project.completedCount).toBe(0);
  });

  it("maps populated aggregates as-is", () => {
    const progressRow: ProjectProgressRow = { ...row, task_count: 5, completed_count: 2 };
    const project = mapProjectWithProgressRow(progressRow);
    expect(project.taskCount).toBe(5);
    expect(project.completedCount).toBe(2);
    expect(project.name).toBe("School");
  });
});

describe("mapNoteRow", () => {
  it("maps a fully populated row", () => {
    const row: NoteRow = {
      id: 9,
      title: "Meeting ideas",
      content: "Ask about the deadline",
      created_at: "2026-10-01T10:00:00.000Z",
      updated_at: "2026-10-03T14:00:00.000Z",
    };
    expect(mapNoteRow(row)).toEqual({
      id: 9,
      title: "Meeting ideas",
      content: "Ask about the deadline",
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-03T14:00:00.000Z",
    });
  });

  it("defaults null content to an empty string", () => {
    const note = mapNoteRow({
      id: 0,
      title: "Empty note",
      content: null,
      created_at: "2026-10-01T10:00:00.000Z",
      updated_at: "2026-10-01T10:00:00.000Z",
    });
    expect(note.content).toBe("");
    expect(note.id).toBe(0);
  });
});

describe("mapFocusSessionRow", () => {
  const base: FocusSessionRow = {
    id: 4,
    started_at: "2026-10-10T09:00:00.000Z",
    ended_at: "2026-10-10T09:25:00.000Z",
    planned_duration_ms: 1_500_000,
    actual_duration_ms: 1_500_000,
    completed: 1,
    task_id: 12,
  };

  it("maps INTEGER 1 to completed = true", () => {
    expect(mapFocusSessionRow(base).completed).toBe(true);
  });

  it("maps INTEGER 0 with null end and task to an interrupted session", () => {
    const session = mapFocusSessionRow({
      ...base,
      completed: 0,
      ended_at: null,
      actual_duration_ms: 0,
      task_id: null,
    });
    expect(session.completed).toBe(false);
    expect(session.endedAt).toBeNull();
    expect(session.actualDurationMs).toBe(0);
    expect(session.taskId).toBeNull();
  });
});

describe("mapFocusStateRow", () => {
  it("maps a running state row", () => {
    const row: FocusStateRow = {
      id: 1,
      status: "running",
      started_at: "2026-10-10T09:30:00.000Z",
      elapsed_before_ms: 0,
      planned_duration_ms: 1_500_000,
      task_id: 5,
    };
    expect(mapFocusStateRow(row)).toEqual({
      status: "running",
      startedAt: "2026-10-10T09:30:00.000Z",
      elapsedBeforeMs: 0,
      plannedDurationMs: 1_500_000,
      taskId: 5,
    });
  });

  it("maps a paused state with no task", () => {
    const state = mapFocusStateRow({
      id: 1,
      status: "paused",
      started_at: "2026-10-10T09:05:00.000Z",
      elapsed_before_ms: 120_000,
      planned_duration_ms: 1_800_000,
      task_id: null,
    });
    expect(state.status).toBe("paused");
    expect(state.taskId).toBeNull();
  });
});

describe("mapSettingsRows", () => {
  it("reads stored values", () => {
    const settings = mapSettingsRows([
      { key: "theme", value: "light" },
      { key: "focusDurationMinutes", value: "50" },
    ]);
    expect(settings).toEqual({ theme: "light", focusDurationMinutes: 50 });
  });

  it("falls back to defaults for missing rows", () => {
    expect(mapSettingsRows([])).toEqual(DEFAULT_SETTINGS);
  });

  it("falls back to defaults for unreadable values", () => {
    const settings = mapSettingsRows([
      { key: "theme", value: "blue" },
      { key: "focusDurationMinutes", value: "abc" },
    ]);
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects out-of-range stored durations by falling back", () => {
    const settings = mapSettingsRows([{ key: "focusDurationMinutes", value: "999" }]);
    expect(settings.focusDurationMinutes).toBe(DEFAULT_SETTINGS.focusDurationMinutes);
    expect(settings.theme).toBe("dark");
  });
});
