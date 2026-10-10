/**
 * JSON backup export (T-009).
 *
 * `buildBackup` gathers every supported table through the injected `DayDockData`
 * aggregate and returns the exact `Backup` shape from `contracts.ts`;
 * `serializeBackup` renders it as stable, pretty JSON; `exportBackupToFile`
 * drives the native save dialog and hands the serialized text to the narrow
 * `save_backup_file` Tauri command (which only accepts `.json` targets and
 * never touches the database).
 *
 * Export only — DayDock has no restore/import path. Nothing in this module
 * reads a backup back into SQLite.
 */
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { Backup, DayDockData, Project, ProjectWithProgress } from "./contracts";
import { todayLocalDate } from "../lib/date";
import { toErrorMessage } from "../lib/errors";

/**
 * Written into `backup.app.version`. Mirrors the `version` field of
 * `package.json`; kept as a constant because this project's TypeScript
 * configuration cannot import `package.json` directly (TS2307). The unit
 * tests read `package.json` from disk and fail if the two ever diverge.
 */
export const APP_VERSION = "0.1.0";

/** Backup payload format version; must match the `Backup` contract. */
export const BACKUP_SCHEMA = 1;

export interface BuildBackupOptions {
  /** App version string placed in `backup.app.version`. */
  version: string;
  /** Injection point for tests; defaults to the current time. */
  now?: Date;
}

export interface ExportResult {
  /** Absolute path the user chose in the save dialog. */
  path: string;
  /** Size of the written file in bytes (UTF-8 encoded). */
  bytes: number;
}

/**
 * Project rows are stored with progress counters for the projects view; the
 * backup carries only the durable `Project` fields so a future importer would
 * not depend on view-derived data.
 */
function toBackupProject(project: ProjectWithProgress): Project {
  const { id, name, createdAt, updatedAt } = project;
  return { id, name, createdAt, updatedAt };
}

/**
 * Reads every supported table through `data` and returns a complete `Backup`.
 * Pure with respect to its inputs: the only impure input is `now`, which is
 * injectable for tests.
 */
export async function buildBackup(
  data: DayDockData,
  options: BuildBackupOptions,
): Promise<Backup> {
  const [projects, tasks, notes, focusSessions, settings] = await Promise.all([
    data.projects.list(),
    data.tasks.list(),
    data.notes.list(),
    data.focusSessions.list(),
    data.settings.get(),
  ]);
  return {
    app: { name: "DayDock", version: options.version, schema: BACKUP_SCHEMA },
    exportedAt: (options.now ?? new Date()).toISOString(),
    projects: projects.map(toBackupProject),
    tasks,
    notes,
    focusSessions,
    settings,
  };
}

/** Pretty-prints the backup (2-space indent) so the file is human-readable. */
export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

function toUserSafeError(error: unknown, fallback: string): Error {
  return new Error(toErrorMessage(error, fallback));
}

/**
 * Full export flow: gather data → native save dialog → write through the
 * `save_backup_file` command. Returns `null` when the user cancels the dialog
 * (a cancel is not an error), otherwise the chosen path and written byte
 * count. Any failure throws an `Error` whose message is safe to render.
 */
export async function exportBackupToFile(data: DayDockData): Promise<ExportResult | null> {
  const backup = await buildBackup(data, { version: APP_VERSION });

  let path: string | null;
  try {
    path = await save({
      defaultPath: `daydock-backup-${todayLocalDate()}.json`,
      filters: [{ name: "DayDock backup", extensions: ["json"] }],
    });
  } catch (error) {
    throw toUserSafeError(error, "The save dialog could not be opened.");
  }
  if (path === null) {
    return null;
  }

  const contents = serializeBackup(backup);
  try {
    await invoke("save_backup_file", { path, contents });
  } catch (error) {
    throw toUserSafeError(error, "The backup file could not be written.");
  }
  return { path, bytes: new TextEncoder().encode(contents).length };
}
