/**
 * Repository integration tests (T-014, review finding: no repository test
 * covered SQL/param shape).
 *
 * Every repository runs against a MOCKED driver (`@tauri-apps/plugin-sql`), so
 * the real chain `repository → src/data/db.ts → driver` executes and each
 * statement is captured at the same boundary the app uses. Two guarantees:
 *
 * 1. **Automatic lockstep (afterEach):** every captured statement must bind
 *    exactly one parameter per `?` placeholder. A placeholder/param mismatch —
 *    the class of bug behind the T-014 Blocker (7 columns, 7 placeholders,
 *    6 params) — fails the very test that produced it, whichever operation
 *    was under test.
 * 2. **Per operation:** the SQL is parameterized (user values appear only in
 *    params, never interpolated into the statement), rows map to camelCase
 *    domain types, and driver failures surface as `DataError` with the fixed
 *    message that leaks neither SQL, parameters, nor driver text.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DataError,
  ValidationError,
  type FocusSessionInput,
  type FocusState,
  type ThemeMode,
} from "../contracts";
import { focusSessions, focusState } from "./focusSessions";
import { notes, type NoteRow } from "./notes";
import { projects, type ProjectProgressRow } from "./projects";
import { settings } from "./settings";
import { tasks, type TaskRow } from "./tasks";

/* ------------------------------------------------------------------ mock -- */

const driver = vi.hoisted(() => ({
  load: vi.fn(),
  select: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: driver.load },
}));

interface CapturedStatement {
  sql: string;
  params: unknown[];
}

/** Captured statements plus per-call result/failure queues.
 *
 * Result queues are read *inside* the mock implementations so the capture
 * runs for EVERY call — a `mockResolvedValueOnce` would otherwise replace the
 * capturing implementation and silently drop the statement from the record.
 */
const captured: CapturedStatement[] = [];
const selectResults: unknown[][] = [];
const selectFailures: Error[] = [];
const executeResults: Array<{ rowsAffected: number; lastInsertId: number | undefined }> = [];
const executeFailures: Error[] = [];

/** Counts `?` placeholders. No statement in this codebase has `?` in a literal. */
function placeholdersOf(sql: string): number {
  return (sql.match(/\?/g) ?? []).length;
}

/** The last captured statement, with a readable failure when nothing ran. */
function lastStatement(): CapturedStatement {
  const statement = captured[captured.length - 1];
  expect(statement, "expected at least one statement to be captured").toBeDefined();
  return statement;
}

/** Awaits a promise expected to reject and returns the rejection value. */
async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error("Expected the operation to reject, but it resolved.");
}

/** User-looking value that must never be interpolated into SQL text. */
const INJECTION_TITLE = "'; DROP TABLE tasks; --";

beforeEach(() => {
  captured.length = 0;
  selectResults.length = 0;
  selectFailures.length = 0;
  executeResults.length = 0;
  executeFailures.length = 0;
  driver.load.mockReset();
  driver.select.mockReset();
  driver.execute.mockReset();
  driver.load.mockResolvedValue({ select: driver.select, execute: driver.execute });
  driver.select.mockImplementation(async (sql: string, params: unknown[] = []) => {
    captured.push({ sql, params });
    const failure = selectFailures.shift();
    if (failure !== undefined) throw failure;
    return selectResults.shift() ?? [];
  });
  driver.execute.mockImplementation(async (sql: string, params: unknown[] = []) => {
    captured.push({ sql, params });
    const failure = executeFailures.shift();
    if (failure !== undefined) throw failure;
    return executeResults.shift() ?? { rowsAffected: 1, lastInsertId: 1 };
  });
});

/** Lockstep: one bound parameter per placeholder, for EVERY statement. */
afterEach(() => {
  for (const { sql, params } of captured) {
    const placeholders = placeholdersOf(sql);
    if (placeholders !== params.length) {
      throw new Error(
        `Placeholder/param mismatch: ${placeholders} "?" placeholder(s) but ` +
          `${params.length} bound param(s) in:\n${sql}`,
      );
    }
  }
});

/* -------------------------------------------------------------- fixtures -- */

const TASK_ROW: TaskRow = {
  id: 42,
  title: INJECTION_TITLE,
  description: "Quarterly numbers",
  status: "pending",
  priority: "high",
  due_date: "2026-10-10",
  project_id: 3,
  created_at: "2026-10-01T08:00:00.000Z",
  updated_at: "2026-10-02T09:30:00.000Z",
  completed_at: null,
};

/* ----------------------------------------------------------------- tasks -- */

describe("tasks repository", () => {
  it("list() runs a parameterized query and maps rows to camelCase", async () => {
    selectResults.push([TASK_ROW]);
    const result = await tasks.list();
    const { sql, params } = lastStatement();
    expect(sql).toContain("SELECT id, title");
    expect(sql).toContain("FROM tasks");
    expect(sql).not.toContain(INJECTION_TITLE);
    expect(params).toEqual([]);
    expect(result).toEqual([
      {
        id: 42,
        title: INJECTION_TITLE,
        description: "Quarterly numbers",
        status: "pending",
        priority: "high",
        dueDate: "2026-10-10",
        projectId: 3,
        createdAt: "2026-10-01T08:00:00.000Z",
        updatedAt: "2026-10-02T09:30:00.000Z",
        completedAt: null,
      },
    ]);
  });

  it("list() binds every filter value as a parameter, not into the SQL", async () => {
    await tasks.list({ status: "pending", priority: "high", projectId: 3, query: "Quarterly" });
    const { sql, params } = lastStatement();
    expect(sql).toContain("WHERE status = ?");
    expect(sql).toContain("priority = ?");
    expect(sql).toContain("project_id = ?");
    expect(sql).toContain("LIKE ?");
    expect(sql).not.toContain("Quarterly");
    expect(params).toEqual(["pending", "high", 3, "%quarterly%", "%quarterly%"]);
  });

  it("list() renders projectId \"none\" as IS NULL with no extra param", async () => {
    await tasks.list({ projectId: "none" });
    const { sql, params } = lastStatement();
    expect(sql).toContain("project_id IS NULL");
    expect(params).toEqual([]);
  });

  it("get() selects by id and returns null for an empty result", async () => {
    selectResults.push([]);
    await expect(tasks.get(9)).resolves.toBeNull();
    expect(lastStatement()).toEqual({ sql: expect.stringContaining("WHERE id = ?"), params: [9] });

    selectResults.push([TASK_ROW]);
    const found = await tasks.get(42);
    expect(found?.title).toBe(INJECTION_TITLE);
  });

  it("create() binds title/values as params and maps the insert result", async () => {
    executeResults.push({ rowsAffected: 1, lastInsertId: 7 });
    const created = await tasks.create({ title: INJECTION_TITLE, dueDate: "2026-10-10" });
    const { sql, params } = lastStatement();
    expect(sql).toContain("INSERT INTO tasks");
    expect(sql).not.toContain(INJECTION_TITLE);
    expect(params[0]).toBe(INJECTION_TITLE);
    expect(params).toEqual([
      INJECTION_TITLE,
      "", // description default
      "pending",
      "medium", // priority default
      "2026-10-10",
      null, // projectId default
      expect.any(String),
      expect.any(String),
    ]);
    expect(created).toMatchObject({
      id: 7,
      title: INJECTION_TITLE,
      status: "pending",
      priority: "medium",
      projectId: null,
      completedAt: null,
    });
    expect(Date.parse(created.createdAt)).not.toBeNaN();
  });

  it("create() surfaces a missing lastInsertId as DataError", async () => {
    executeResults.push({ rowsAffected: 1, lastInsertId: undefined });
    const error = await rejectionOf(tasks.create({ title: "Valid" }));
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Could not save the new task.");
  });

  it("update() validates against the existing row and binds the patch", async () => {
    selectResults.push([TASK_ROW]);
    executeResults.push({ rowsAffected: 1, lastInsertId: 0 });
    const updated = await tasks.update(42, { title: INJECTION_TITLE, priority: "low" });
    const { sql, params } = lastStatement();
    expect(sql).toContain("UPDATE tasks");
    expect(sql).toContain("WHERE id = ?");
    expect(sql).not.toContain(INJECTION_TITLE);
    expect(params).toEqual([
      INJECTION_TITLE,
      TASK_ROW.description,
      "low",
      TASK_ROW.due_date,
      TASK_ROW.project_id,
      expect.any(String),
      42,
    ]);
    expect(updated.title).toBe(INJECTION_TITLE);
    expect(updated.priority).toBe("low");
    expect(updated.id).toBe(42);
  });

  it("setStatus() completes with a timestamp and reopens by clearing it", async () => {
    selectResults.push([TASK_ROW]);
    await tasks.setStatus(42, "completed");
    const completed = lastStatement();
    expect(completed.sql).toContain("SET status = 'completed'");
    expect(completed.params[0]).toEqual(expect.any(String));
    expect(completed.params[2]).toBe(42);

    selectResults.push([{ ...TASK_ROW, status: "completed" }]);
    const reopened = await tasks.setStatus(42, "pending");
    expect(reopened.status).toBe("pending");
    expect(reopened.completedAt).toBeNull();
  });

  it("setStatus() rejects an unknown status with DataError before touching the driver", async () => {
    const error = await rejectionOf(
      tasks.setStatus(42, "archived" as unknown as "pending" | "completed"),
    );
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Status must be pending or completed.");
    expect(captured).toHaveLength(0);
  });

  it("remove() reports a missing task as DataError", async () => {
    executeResults.push({ rowsAffected: 0, lastInsertId: undefined });
    const error = await rejectionOf(tasks.remove(404));
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Task not found.");
  });

  it("driver read failures surface as DataError without leaking driver text", async () => {
    selectFailures.push(new Error("SQLITE_CORRUPT: table tasks"));
    const error = await rejectionOf(tasks.list());
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Could not read data from local storage.");
    expect(error.message).not.toContain("SQLITE_CORRUPT");
  });
});

/* -------------------------------------------------------------- projects -- */

describe("projects repository", () => {
  const PROGRESS_ROW: ProjectProgressRow = {
    id: 5,
    name: INJECTION_TITLE,
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-05T11:00:00.000Z",
    task_count: 4,
    completed_count: 2,
  };

  it("list() joins aggregates and maps NULL counts to zero", async () => {
    selectResults.push([PROGRESS_ROW, { ...PROGRESS_ROW, id: 6, name: "Empty", task_count: null, completed_count: null }]);
    const result = await projects.list();
    expect(lastStatement().params).toEqual([]);
    expect(result).toEqual([
      {
        id: 5,
        name: INJECTION_TITLE,
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-05T11:00:00.000Z",
        taskCount: 4,
        completedCount: 2,
      },
      {
        id: 6,
        name: "Empty",
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-05T11:00:00.000Z",
        taskCount: 0,
        completedCount: 0,
      },
    ]);
  });

  it("get() binds the id and returns null when absent", async () => {
    selectResults.push([]);
    await expect(projects.get(9)).resolves.toBeNull();
    expect(lastStatement().params).toEqual([9]);
  });

  it("create() binds the validated name as a param", async () => {
    executeResults.push({ rowsAffected: 1, lastInsertId: 11 });
    const created = await projects.create(`  ${INJECTION_TITLE}  `);
    const { sql, params } = lastStatement();
    expect(sql).toContain("INSERT INTO projects");
    expect(sql).not.toContain(INJECTION_TITLE);
    expect(params).toEqual([INJECTION_TITLE, expect.any(String), expect.any(String)]);
    expect(created).toMatchObject({ id: 11, name: INJECTION_TITLE });
    expect(created.createdAt).toBe(created.updatedAt);
  });

  it("create() rejects a blank name with ValidationError before any write", async () => {
    const error = await rejectionOf(projects.create("   "));
    expect(error).toBeInstanceOf(ValidationError);
    expect(captured).toHaveLength(0);
  });

  it("rename() loads the row first and reports a missing project as DataError", async () => {
    selectResults.push([]);
    const error = await rejectionOf(projects.rename(404, "New name"));
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Project not found.");
    expect(captured).toHaveLength(1); // only the lookup SELECT ran

    selectResults.push([PROGRESS_ROW]);
    executeResults.push({ rowsAffected: 1, lastInsertId: 0 });
    const renamed = await projects.rename(5, INJECTION_TITLE);
    expect(lastStatement().params).toEqual([INJECTION_TITLE, expect.any(String), 5]);
    expect(renamed.id).toBe(5);
    expect(renamed.createdAt).toBe(PROGRESS_ROW.created_at);
  });

  it("remove() unassigns tasks BEFORE deleting the project, in that order", async () => {
    selectResults.push([PROGRESS_ROW]);
    await projects.remove(5);
    expect(captured).toHaveLength(3);
    const [, unassign, remove] = captured;
    expect(unassign.sql).toContain("UPDATE tasks SET project_id = NULL WHERE project_id = ?");
    expect(unassign.params).toEqual([5]);
    expect(remove.sql).toContain("DELETE FROM projects WHERE id = ?");
    expect(remove.params).toEqual([5]);
  });

  it("remove() of a missing project performs no writes", async () => {
    selectResults.push([]);
    const error = await rejectionOf(projects.remove(404));
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Project not found.");
    expect(captured).toHaveLength(1);
  });

  it("driver write failures surface as DataError without leaking driver text", async () => {
    executeFailures.push(new Error("SQLITE_BUSY: database is locked"));
    const error = await rejectionOf(projects.create("Name"));
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Could not save data to local storage.");
    expect(error.message).not.toContain("SQLITE_BUSY");
  });
});

/* ------------------------------------------------------------------ notes -- */

describe("notes repository", () => {
  const NOTE_ROW: NoteRow = {
    id: 9,
    title: INJECTION_TITLE,
    content: "Ask about the deadline",
    created_at: "2026-10-01T08:00:00.000Z",
    updated_at: "2026-10-03T14:00:00.000Z",
  };

  it("list() without a query orders by recency and maps rows", async () => {
    selectResults.push([NOTE_ROW]);
    const result = await notes.list();
    const { sql, params } = lastStatement();
    expect(sql).toContain("FROM notes");
    expect(sql).toContain("ORDER BY updated_at DESC");
    expect(params).toEqual([]);
    expect(result[0]).toEqual({
      id: 9,
      title: INJECTION_TITLE,
      content: "Ask about the deadline",
      createdAt: "2026-10-01T08:00:00.000Z",
      updatedAt: "2026-10-03T14:00:00.000Z",
    });
  });

  it("list() with a query binds escaped LIKE patterns, not the raw text", async () => {
    await notes.list("  Deadline% ");
    const { sql, params } = lastStatement();
    expect(sql).toContain("LIKE ? ESCAPE");
    expect(sql).not.toContain("Deadline");
    expect(params).toEqual(["%deadline\\%%", "%deadline\\%%"]);
  });

  it("create() keeps title and content out of the SQL text (content is private)", async () => {
    executeResults.push({ rowsAffected: 1, lastInsertId: 3 });
    const created = await notes.create({ title: INJECTION_TITLE, content: "Secret note body" });
    const { sql, params } = lastStatement();
    expect(sql).toContain("INSERT INTO notes");
    expect(sql).not.toContain(INJECTION_TITLE);
    expect(sql).not.toContain("Secret note body");
    expect(params).toEqual([INJECTION_TITLE, "Secret note body", expect.any(String), expect.any(String)]);
    expect(created).toMatchObject({ id: 3, title: INJECTION_TITLE, content: "Secret note body" });
  });

  it("update() reports a vanished note as DataError after the lookup", async () => {
    selectResults.push([]);
    const error = await rejectionOf(notes.update(404, { title: "New" }));
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Note not found.");
    expect(captured).toHaveLength(1);
  });

  it("remove() reports a missing note as DataError", async () => {
    executeResults.push({ rowsAffected: 0, lastInsertId: undefined });
    const error = await rejectionOf(notes.remove(404));
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Note not found.");
  });

  it("driver write failures surface as DataError with the fixed message", async () => {
    executeFailures.push(new Error("disk full: notes table"));
    const error = await rejectionOf(notes.create({ title: "Valid" }));
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Could not save data to local storage.");
    expect(error.message).not.toContain("disk full");
  });
});

/* --------------------------------------------------------- focus sessions -- */

describe("focusSessions repository", () => {
  const SESSION_ROW = {
    id: 4,
    started_at: "2026-10-10T09:00:00.000Z",
    ended_at: "2026-10-10T09:25:00.000Z",
    planned_duration_ms: 1_500_000,
    actual_duration_ms: 1_500_000,
    completed: 1,
    task_id: 12,
  };

  it("list() selects all columns newest-first and maps booleans", async () => {
    selectResults.push([SESSION_ROW]);
    const result = await focusSessions.list();
    const { sql, params } = lastStatement();
    expect(sql).toContain("FROM focus_sessions");
    expect(sql).toContain("ORDER BY started_at DESC, id DESC");
    expect(params).toEqual([]);
    expect(result[0]).toEqual({
      id: 4,
      startedAt: "2026-10-10T09:00:00.000Z",
      endedAt: "2026-10-10T09:25:00.000Z",
      plannedDurationMs: 1_500_000,
      actualDurationMs: 1_500_000,
      completed: true,
      taskId: 12,
    });
  });

  it("list(limit) binds the limit and rejects a non-positive one before the driver", async () => {
    await focusSessions.list(5);
    expect(lastStatement().params).toEqual([5]);

    const error = await rejectionOf(focusSessions.list(0));
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("History limit must be a positive whole number.");
  });

  /**
   * REGRESSION (T-014 Blocker): the INSERT used to list 7 columns including
   * `id` but bind only 6 params, so every completed session failed to persist.
   * Columns, placeholders and params must stay in lockstep and `id` must be
   * excluded (migration v1: `id INTEGER PRIMARY KEY AUTOINCREMENT`).
   */
  it("create() binds exactly one param per insertable column, with id excluded", async () => {
    executeResults.push({ rowsAffected: 1, lastInsertId: 77 });
    const input: FocusSessionInput = {
      startedAt: "2026-10-10T09:00:00.000Z",
      endedAt: "2026-10-10T09:25:00.000Z",
      plannedDurationMs: 1_500_000,
      actualDurationMs: 1_500_000,
      completed: true,
      taskId: null,
    };
    const created = await focusSessions.create(input);
    const { sql, params } = lastStatement();

    const insert = /INSERT INTO focus_sessions \(([^)]+)\)/.exec(sql);
    expect(insert, `statement was not an INSERT: ${sql}`).not.toBeNull();
    const columns = insert![1].split(",").map((column) => column.trim());
    expect(columns).toEqual([
      "started_at",
      "ended_at",
      "planned_duration_ms",
      "actual_duration_ms",
      "completed",
      "task_id",
    ]);
    expect(columns).not.toContain("id");

    const placeholders = placeholdersOf(sql);
    expect(placeholders).toBe(columns.length);
    expect(params.length).toBe(columns.length);

    /* Values live only in params, never in the statement text. */
    expect(sql).not.toContain(input.startedAt);
    expect(sql).not.toContain(input.endedAt);
    expect(params).toEqual([
      input.startedAt,
      input.endedAt,
      1_500_000,
      1_500_000,
      1,
      null,
    ]);
    expect(created).toEqual({ id: 77, ...input, taskId: null });
  });

  it("create() surfaces a missing lastInsertId as DataError", async () => {
    executeResults.push({ rowsAffected: 1, lastInsertId: undefined });
    const error = await rejectionOf(
      focusSessions.create({
        startedAt: "2026-10-10T09:00:00.000Z",
        endedAt: null,
        plannedDurationMs: 60_000,
        actualDurationMs: 60_000,
        completed: false,
      }),
    );
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Could not save the focus session.");
  });
});

/* ----------------------------------------------------------- focus state -- */

describe("focusState repository", () => {
  const STATE: FocusState = {
    status: "running",
    startedAt: "2026-10-10T09:00:00.000Z",
    elapsedBeforeMs: 120_000,
    plannedDurationMs: 1_500_000,
    taskId: 7,
  };

  it("get() reads row 1 and maps it, or null when the row is absent", async () => {
    selectResults.push([
      {
        id: 1,
        status: "running",
        started_at: STATE.startedAt,
        elapsed_before_ms: 120_000,
        planned_duration_ms: 1_500_000,
        task_id: 7,
      },
    ]);
    await expect(focusState.get()).resolves.toEqual(STATE);
    expect(lastStatement().params).toEqual([1]);

    selectResults.push([]);
    await expect(focusState.get()).resolves.toBeNull();
  });

  it("save() upserts row 1 with id bound as the conflict key", async () => {
    await focusState.save(STATE);
    const { sql, params } = lastStatement();
    expect(sql).toContain("INSERT INTO focus_state");
    expect(sql).toContain("ON CONFLICT(id) DO UPDATE");
    expect(sql).not.toContain(STATE.startedAt);
    expect(params).toEqual([1, "running", STATE.startedAt, 120_000, 1_500_000, 7]);
  });

  it("clear() deletes row 1 by bound id and is idempotent", async () => {
    await focusState.clear();
    expect(lastStatement()).toEqual({
      sql: "DELETE FROM focus_state WHERE id = ?",
      params: [1],
    });
    await focusState.clear();
    expect(captured).toHaveLength(2);
  });

  it("driver write failures surface as DataError (clear failure path)", async () => {
    executeFailures.push(new Error("SQLITE_IOERR: write failed"));
    const error = await rejectionOf(focusState.clear());
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Could not save data to local storage.");
    expect(error.message).not.toContain("SQLITE_IOERR");
  });
});

/* --------------------------------------------------------------- settings -- */

describe("settings repository", () => {
  const ROWS = [
    { key: "theme", value: "light" },
    { key: "focusDurationMinutes", value: "50" },
  ];

  it("get() binds both keys and maps rows to AppSettings", async () => {
    selectResults.push(ROWS);
    await expect(settings.get()).resolves.toEqual({ theme: "light", focusDurationMinutes: 50 });
    expect(lastStatement()).toEqual({
      sql: expect.stringContaining("WHERE key IN (?, ?)"),
      params: ["theme", "focusDurationMinutes"],
    });
  });

  it("update({ theme }) upserts the key/value pair as params", async () => {
    executeResults.push({ rowsAffected: 1, lastInsertId: 1 });
    selectResults.push(ROWS);
    const updated = await settings.update({ theme: "light" });
    /* update() upserts first, then re-reads via get() — assert the upsert,
       which sits just before the trailing SELECT in the capture. */
    const upsert = captured.find((s) => s.sql.includes("ON CONFLICT(key) DO UPDATE"));
    expect(upsert, "expected an upsert statement to be captured").toBeDefined();
    expect(upsert!.sql).not.toContain("light");
    expect(upsert!.params).toEqual(["theme", "light"]);
    expect(updated).toEqual({ theme: "light", focusDurationMinutes: 50 });
  });

  it("update({ focusDurationMinutes }) stores the value as text", async () => {
    executeResults.push({ rowsAffected: 1, lastInsertId: 1 });
    selectResults.push(ROWS);
    await settings.update({ focusDurationMinutes: 50 });
    const upsert = captured.find((s) => s.sql.includes("ON CONFLICT(key) DO UPDATE"));
    expect(upsert, "expected an upsert statement to be captured").toBeDefined();
    expect(upsert!.params).toEqual(["focusDurationMinutes", "50"]);
  });

  it("update() rejects an out-of-range duration with ValidationError before any write", async () => {
    const error = await rejectionOf(settings.update({ focusDurationMinutes: 0 }));
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fieldErrors.focusDurationMinutes).toContain(
      "between 1 and 180",
    );
    expect(captured).toHaveLength(0);
  });

  it("update() rejects an unknown theme before any write", async () => {
    const error = await rejectionOf(settings.update({ theme: "blue" as unknown as ThemeMode }));
    expect(error).toBeInstanceOf(ValidationError);
    expect(captured).toHaveLength(0);
  });

  it("driver read failures surface as DataError with the fixed message", async () => {
    selectFailures.push(new Error("SQLITE_AUTH: settings locked"));
    const error = await rejectionOf(settings.get());
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Could not read data from local storage.");
    expect(error.message).not.toContain("SQLITE_AUTH");
  });
});
