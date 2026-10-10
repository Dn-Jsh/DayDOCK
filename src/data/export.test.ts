/**
 * Unit tests for the JSON backup export (T-009).
 *
 * The Tauri dialog and command modules are mocked, so these tests run in
 * plain jsdom without a native runtime; only the coordinator's native run
 * (T-012) exercises the real save dialog and file write.
 */
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
// @ts-expect-error type error without 'node' types in the app tsconfig (same workaround as vite.config.ts)
import { readFileSync } from "node:fs";
// @ts-expect-error type error without 'node' types in the app tsconfig (same workaround as vite.config.ts)
import process from "node:process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppSettings,
  DayDockData,
  FocusSession,
  Note,
  ProjectWithProgress,
  Task,
} from "./contracts";
import { APP_VERSION, BACKUP_SCHEMA, buildBackup, exportBackupToFile, serializeBackup } from "./export";

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockedSave = vi.mocked(save);
const mockedInvoke = vi.mocked(invoke);

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const T0 = Date.UTC(2026, 9, 10, 9, 0, 0);
const FIXED_NOW = new Date(Date.UTC(2026, 9, 12, 14, 30, 0));

function iso(offsetMs = 0): string {
  return new Date(T0 + offsetMs).toISOString();
}

/* Includes the view-derived progress counters, which must NOT reach the payload. */
const PROJECTS: ProjectWithProgress[] = [
  { id: 1, name: "School", createdAt: iso(), updatedAt: iso(), taskCount: 2, completedCount: 1 },
  { id: 2, name: "Programming", createdAt: iso(), updatedAt: iso(), taskCount: 2, completedCount: 0 },
  { id: 3, name: "Personal", createdAt: iso(), updatedAt: iso(), taskCount: 1, completedCount: 1 },
];

const TASKS: Task[] = [
  {
    id: 1, title: "Write essay", description: "", status: "pending", priority: "high",
    dueDate: "2026-10-10", projectId: 1, createdAt: iso(), updatedAt: iso(), completedAt: null,
  },
  {
    id: 2, title: "Read chapter", description: "Chapter 4", status: "completed", priority: "medium",
    dueDate: null, projectId: 1, createdAt: iso(), updatedAt: iso(60_000), completedAt: iso(60_000),
  },
  {
    id: 3, title: "Fix login bug", description: "", status: "pending", priority: "high",
    dueDate: "2026-10-11", projectId: 2, createdAt: iso(), updatedAt: iso(), completedAt: null,
  },
  {
    id: 4, title: "Refactor export", description: "", status: "pending", priority: "low",
    dueDate: null, projectId: 2, createdAt: iso(), updatedAt: iso(), completedAt: null,
  },
  {
    id: 5, title: "Buy groceries", description: "", status: "completed", priority: "medium",
    dueDate: "2026-10-09", projectId: null, createdAt: iso(), updatedAt: iso(), completedAt: iso(),
  },
];

const NOTES: Note[] = [
  { id: 1, title: "Ideas", content: "Ship the export", createdAt: iso(), updatedAt: iso() },
  { id: 2, title: "Todo", content: "Review T-010", createdAt: iso(), updatedAt: iso(120_000) },
];

const SESSIONS: FocusSession[] = [
  { id: 1, startedAt: iso(), endedAt: iso(25 * 60_000), plannedDurationMs: 25 * 60_000, actualDurationMs: 25 * 60_000, completed: true, taskId: 1 },
  { id: 2, startedAt: iso(), endedAt: iso(10 * 60_000), plannedDurationMs: 25 * 60_000, actualDurationMs: 10 * 60_000, completed: false, taskId: null },
  { id: 3, startedAt: iso(), endedAt: iso(50 * 60_000), plannedDurationMs: 50 * 60_000, actualDurationMs: 50 * 60_000, completed: true, taskId: 3 },
  { id: 4, startedAt: iso(), endedAt: iso(45 * 60_000), plannedDurationMs: 45 * 60_000, actualDurationMs: 45 * 60_000, completed: true, taskId: null },
];

const SETTINGS: AppSettings = { theme: "dark", focusDurationMinutes: 25 };

function unused(): never {
  throw new Error("This repository method is not exercised by the export tests.");
}

/** Minimal `DayDockData` whose read methods serve the fixtures above. */
function fakeData(): DayDockData {
  return {
    projects: {
      list: vi.fn(async () => PROJECTS),
      get: unused, create: unused, rename: unused, remove: unused,
    },
    tasks: {
      list: vi.fn(async () => TASKS),
      get: unused, create: unused, update: unused, setStatus: unused, remove: unused,
    },
    notes: {
      list: vi.fn(async () => NOTES),
      get: unused, create: unused, update: unused, remove: unused,
    },
    focusSessions: { list: vi.fn(async () => SESSIONS), create: unused },
    focusState: { get: unused, save: unused, clear: unused },
    settings: { get: vi.fn(async () => SETTINGS), update: unused },
  };
}

/* -------------------------------------------------------------------------- */
/* Shape assertion                                                            */
/* -------------------------------------------------------------------------- */

const BACKUP_KEYS = ["app", "exportedAt", "projects", "tasks", "notes", "focusSessions", "settings"];
const APP_KEYS = ["name", "version", "schema"];
const PROJECT_KEYS = ["id", "name", "createdAt", "updatedAt"];
const TASK_KEYS = [
  "id", "title", "description", "status", "priority", "dueDate", "projectId",
  "createdAt", "updatedAt", "completedAt",
];
const NOTE_KEYS = ["id", "title", "content", "createdAt", "updatedAt"];
const SESSION_KEYS = [
  "id", "startedAt", "endedAt", "plannedDurationMs", "actualDurationMs", "completed", "taskId",
];
const SETTINGS_KEYS = ["theme", "focusDurationMinutes"];

function expectExactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(
      `${label} key mismatch — got [${actual.join(", ")}], expected [${wanted.join(", ")}]`,
    );
  }
}

/** Fails on any missing or unexpected field anywhere in the payload. */
function assertBackupShape(value: unknown): void {
  expectExactKeys(value, BACKUP_KEYS, "backup");
  const backup = value as Record<string, unknown>;
  expectExactKeys(backup.app, APP_KEYS, "backup.app");
  expectExactKeys(backup.settings, SETTINGS_KEYS, "backup.settings");
  for (const [key, keys] of [
    ["projects", PROJECT_KEYS],
    ["tasks", TASK_KEYS],
    ["notes", NOTE_KEYS],
    ["focusSessions", SESSION_KEYS],
  ] as const) {
    const rows = backup[key];
    if (!Array.isArray(rows)) throw new Error(`backup.${key} must be an array`);
    rows.forEach((row, index) => expectExactKeys(row, keys, `backup.${key}[${index}]`));
  }
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe("buildBackup", () => {
  it("produces the documented app block and a deterministic exportedAt", async () => {
    const backup = await buildBackup(fakeData(), { version: "9.9.9-test", now: FIXED_NOW });
    expect(backup.app).toEqual({ name: "DayDock", version: "9.9.9-test", schema: 1 });
    expect(backup.exportedAt).toBe(FIXED_NOW.toISOString());
  });

  it("defaults exportedAt to the current time when no clock is injected", async () => {
    const before = Date.now();
    const backup = await buildBackup(fakeData(), { version: "1.0.0" });
    expect(Date.parse(backup.exportedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(backup.exportedAt)).toBeLessThanOrEqual(Date.now());
  });

  it("reads every table through the injected aggregate", async () => {
    const data = fakeData();
    await buildBackup(data, { version: "1.0.0", now: FIXED_NOW });
    expect(data.projects.list).toHaveBeenCalledTimes(1);
    expect(data.tasks.list).toHaveBeenCalledTimes(1);
    expect(data.notes.list).toHaveBeenCalledTimes(1);
    expect(data.focusSessions.list).toHaveBeenCalledTimes(1);
    expect(data.settings.get).toHaveBeenCalledTimes(1);
  });

  it("carries the stored settings unchanged", async () => {
    const backup = await buildBackup(fakeData(), { version: "1.0.0", now: FIXED_NOW });
    expect(backup.settings).toEqual(SETTINGS);
  });

  it("strips the view-derived progress counters from projects", async () => {
    const backup = await buildBackup(fakeData(), { version: "1.0.0", now: FIXED_NOW });
    expect(backup.projects[0]).toEqual({
      id: 1,
      name: "School",
      createdAt: PROJECTS[0].createdAt,
      updatedAt: PROJECTS[0].updatedAt,
    });
  });
});

describe("serializeBackup", () => {
  it("round-trips through JSON.parse with counts equal to the aggregate", async () => {
    const backup = await buildBackup(fakeData(), { version: "1.0.0", now: FIXED_NOW });
    const parsed = JSON.parse(serializeBackup(backup));

    expect(parsed).toEqual(backup);
    expect(parsed.projects).toHaveLength(PROJECTS.length);
    expect(parsed.tasks).toHaveLength(TASKS.length);
    expect(parsed.notes).toHaveLength(NOTES.length);
    expect(parsed.focusSessions).toHaveLength(SESSIONS.length);
    /* 3 projects, 5 tasks, 2 notes, 4 focus sessions in the fixtures. */
    expect([parsed.projects.length, parsed.tasks.length, parsed.notes.length, parsed.focusSessions.length])
      .toEqual([3, 5, 2, 4]);
  });

  it("keeps app.schema === 1 and a present exportedAt after the round trip", async () => {
    const backup = await buildBackup(fakeData(), { version: "1.0.0", now: FIXED_NOW });
    const parsed = JSON.parse(serializeBackup(backup));
    expect(parsed.app.schema).toBe(BACKUP_SCHEMA);
    expect(typeof parsed.exportedAt).toBe("string");
    expect(parsed.exportedAt).toBe(FIXED_NOW.toISOString());
  });

  it("is pretty-printed with a stable key order", async () => {
    const backup = await buildBackup(fakeData(), { version: "1.0.0", now: FIXED_NOW });
    const first = serializeBackup(backup);
    const second = serializeBackup(backup);
    expect(first).toBe(second);
    expect(first).toContain('\n  "app": {');
  });

  it("passes the shape assertion; a missing or extra field fails it", async () => {
    const backup = await buildBackup(fakeData(), { version: "1.0.0", now: FIXED_NOW });
    const parsed = JSON.parse(serializeBackup(backup));
    expect(() => assertBackupShape(parsed)).not.toThrow();

    const missing = { ...parsed };
    delete missing.exportedAt;
    expect(() => assertBackupShape(missing)).toThrow(/exportedAt/);

    const extra = { ...parsed, restoreToken: "not part of the contract" };
    expect(() => assertBackupShape(extra)).toThrow(/key mismatch/);

    const mutatedRow = {
      ...parsed,
      projects: [{ ...parsed.projects[0], taskCount: 7 }, ...parsed.projects.slice(1)],
    };
    expect(() => assertBackupShape(mutatedRow)).toThrow(/projects\[0\]/);
  });
});

describe("exportBackupToFile", () => {
  beforeEach(() => {
    mockedSave.mockReset();
    mockedInvoke.mockReset();
  });

  it("returns null (not an error) when the dialog is cancelled", async () => {
    mockedSave.mockResolvedValue(null);
    const result = await exportBackupToFile(fakeData());
    expect(result).toBeNull();
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it("opens the dialog with a dated default name and a json filter", async () => {
    mockedSave.mockResolvedValue(null);
    await exportBackupToFile(fakeData());
    expect(mockedSave).toHaveBeenCalledTimes(1);
    const options = mockedSave.mock.calls[0][0];
    expect(options?.defaultPath).toMatch(/^daydock-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(options?.filters).toEqual([{ name: "DayDock backup", extensions: ["json"] }]);
  });

  it("writes the serialized backup through save_backup_file and reports bytes", async () => {
    const chosenPath = "C:\\Users\\test\\Desktop\\daydock-backup-2026-10-12.json";
    mockedSave.mockResolvedValue(chosenPath);
    mockedInvoke.mockResolvedValue(undefined);

    const result = await exportBackupToFile(fakeData());

    expect(mockedInvoke).toHaveBeenCalledTimes(1);
    const call = mockedInvoke.mock.calls[0];
    expect(call[0]).toBe("save_backup_file");
    const args = call[1] as Record<string, string>;
    expect(args.path).toBe(chosenPath);

    const parsed = JSON.parse(args.contents);
    expect(() => assertBackupShape(parsed)).not.toThrow();
    expect([parsed.projects.length, parsed.tasks.length, parsed.notes.length, parsed.focusSessions.length])
      .toEqual([3, 5, 2, 4]);
    expect(args.contents).not.toContain("taskCount");

    expect(result).not.toBeNull();
    expect(result?.path).toBe(chosenPath);
    expect(result?.bytes).toBe(new TextEncoder().encode(args.contents).length);
    expect(result?.bytes).toBeGreaterThan(0);
  });

  it("throws a user-safe error when the write fails", async () => {
    mockedSave.mockResolvedValue("C:\\Users\\test\\backup.json");
    mockedInvoke.mockRejectedValue(new Error("Could not write the backup file: access is denied."));

    await expect(exportBackupToFile(fakeData())).rejects.toThrow(
      "Could not write the backup file: access is denied.",
    );
  });

  it("throws a user-safe error when the save dialog fails", async () => {
    mockedSave.mockRejectedValue(new Error("The save dialog could not be shown."));

    await expect(exportBackupToFile(fakeData())).rejects.toThrow(
      "The save dialog could not be shown.",
    );
  });
});

describe("APP_VERSION", () => {
  it("mirrors the version field of package.json", () => {
    const manifest = JSON.parse(
      readFileSync(`${process.cwd()}/package.json`, "utf8"),
    ) as { version: string };
    expect(APP_VERSION).toBe(manifest.version);
  });
});
