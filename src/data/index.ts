/**
 * DayDock data layer entry point.
 *
 * `getData()` opens the SQLite database once (cached promise, migrations run
 * by the Tauri SQL plugin) and returns the typed repositories the UI uses.
 * All SQL lives under `src/data/**`; feature code never writes queries.
 */
import { type DayDockData } from "./contracts";
import { getDatabase } from "./db";
import * as focusRepositories from "./repositories/focusSessions";
import * as notesRepository from "./repositories/notes";
import * as projectsRepository from "./repositories/projects";
import * as settingsRepository from "./repositories/settings";
import * as tasksRepository from "./repositories/tasks";

let dataPromise: Promise<DayDockData> | null = null;

/**
 * Returns the shared data aggregate, opening the database on first call.
 * A successful aggregate is cached; a rejection is never cached — the slot is
 * cleared in the rejection handler so the app-wide Retry re-attempts for real
 * (the cached promise would otherwise be the same failure every time).
 */
export function getData(): Promise<DayDockData> {
  if (dataPromise === null) {
    dataPromise = getDatabase()
      .then(() => ({
        tasks: tasksRepository.tasks,
        projects: projectsRepository.projects,
        notes: notesRepository.notes,
        focusSessions: focusRepositories.focusSessions,
        focusState: focusRepositories.focusState,
        settings: settingsRepository.settings,
      }))
      .catch((error: unknown) => {
        /* Never cache a rejected promise — see the JSDoc above. */
        dataPromise = null;
        throw error;
      });
  }
  return dataPromise;
}

export { DataError, ValidationError } from "./contracts";
export type {
  AppSettings,
  Backup,
  DayDockData,
  FocusSession,
  FocusState,
  Instant,
  LocalDate,
  Note,
  Priority,
  Project,
  ProjectWithProgress,
  Task,
  TaskFilter,
  TaskInput,
  TaskPatch,
  TaskStatus,
  ThemeMode,
} from "./contracts";
export { todayLocalDate, localDateOf, formatClock, isPastLocalDate } from "../lib/date";
