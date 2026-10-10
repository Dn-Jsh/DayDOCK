/**
 * Typed database contracts for DayDock.
 *
 * This module is the single source of truth for the shapes exchanged between the
 * SQLite persistence layer (`src-tauri/src/migrations.rs` + `src/data/repositories`)
 * and the UI. It contains types and error classes only — no business logic, no SQL.
 *
 * Ownership: coordinator wrote the contract; repositories implement it. Feature
 * tickets import from here, never from the repositories' internals.
 */

export type TaskStatus = "pending" | "completed";
export type Priority = "low" | "medium" | "high";
export type ThemeMode = "dark" | "light";

/** `YYYY-MM-DD` in the user's local time zone, or `null` when unset. */
export type LocalDate = string;

/** ISO 8601 UTC timestamp, e.g. `2026-10-10T09:30:00.000Z`. */
export type Instant = string;

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: LocalDate | null;
  projectId: number | null;
  createdAt: Instant;
  updatedAt: Instant;
  completedAt: Instant | null;
}

export interface TaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: LocalDate | null;
  projectId?: number | null;
}

export interface TaskPatch {
  title?: string;
  description?: string;
  priority?: Priority;
  dueDate?: LocalDate | null;
  projectId?: number | null;
}

export interface TaskFilter {
  /** `all` (default), `pending` or `completed`. */
  status?: TaskStatus | "all";
  /** `all` (default), `any`, `low`, `medium` or `high`. */
  priority?: Priority | "all" | "any";
  /** Project id, `"none"` for unassigned, or `"all"` (default). */
  projectId?: number | "none" | "all";
  /** Case-insensitive substring match over title and description. */
  query?: string;
}

export interface Project {
  id: number;
  name: string;
  createdAt: Instant;
  updatedAt: Instant;
}

/** A project plus its task progress, as shown in the projects view. */
export interface ProjectWithProgress extends Project {
  taskCount: number;
  completedCount: number;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface FocusSession {
  id: number;
  startedAt: Instant;
  endedAt: Instant | null;
  plannedDurationMs: number;
  actualDurationMs: number;
  completed: boolean;
  taskId: number | null;
}

export interface FocusSessionInput {
  startedAt: Instant;
  endedAt: Instant | null;
  plannedDurationMs: number;
  actualDurationMs: number;
  completed: boolean;
  taskId?: number | null;
}

/** Persisted state of the focus timer so it survives restarts and suspension. */
export interface FocusState {
  status: "running" | "paused";
  /** When the current running segment started (`now` semantics while running). */
  startedAt: Instant;
  /** Milliseconds accumulated in earlier segments (before `startedAt`). */
  elapsedBeforeMs: number;
  plannedDurationMs: number;
  taskId: number | null;
}

export interface AppSettings {
  theme: ThemeMode;
  /** Configurable focus duration, minutes. Valid range 1–180. */
  focusDurationMinutes: number;
}

/** Shape of the JSON written by the backup export. */
export interface Backup {
  app: { name: string; version: string; schema: number };
  exportedAt: Instant;
  projects: Project[];
  tasks: Task[];
  notes: Note[];
  focusSessions: FocusSession[];
  settings: AppSettings;
}

/* -------------------------------------------------------------------------- */
/* Repositories                                                               */
/* -------------------------------------------------------------------------- */

export interface TaskRepository {
  list(filter?: TaskFilter): Promise<Task[]>;
  get(id: number): Promise<Task | null>;
  create(input: TaskInput): Promise<Task>;
  update(id: number, patch: TaskPatch): Promise<Task>;
  /** Completes (`completedAt = now`) or reopens a task. */
  setStatus(id: number, status: TaskStatus): Promise<Task>;
  remove(id: number): Promise<void>;
}

export interface ProjectRepository {
  list(): Promise<ProjectWithProgress[]>;
  get(id: number): Promise<ProjectWithProgress | null>;
  create(name: string): Promise<Project>;
  rename(id: number, name: string): Promise<Project>;
  /** Deletes the project and unassigns its tasks — tasks are never deleted here. */
  remove(id: number): Promise<void>;
}

export interface NoteRepository {
  list(query?: string): Promise<Note[]>;
  get(id: number): Promise<Note | null>;
  create(input: { title: string; content?: string }): Promise<Note>;
  update(id: number, patch: { title?: string; content?: string }): Promise<Note>;
  remove(id: number): Promise<void>;
}

export interface FocusSessionRepository {
  /** Newest first. */
  list(limit?: number): Promise<FocusSession[]>;
  create(input: FocusSessionInput): Promise<FocusSession>;
}

export interface FocusStateRepository {
  get(): Promise<FocusState | null>;
  save(state: FocusState): Promise<void>;
  clear(): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  update(patch: Partial<AppSettings>): Promise<AppSettings>;
}

/** Aggregate handed to the UI by `src/data/index.ts`. */
export interface DayDockData {
  tasks: TaskRepository;
  projects: ProjectRepository;
  notes: NoteRepository;
  focusSessions: FocusSessionRepository;
  focusState: FocusStateRepository;
  settings: SettingsRepository;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * User-input validation failure. `fieldErrors` maps a field name to a message
 * that is safe to render next to the field.
 */
export class ValidationError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(fieldErrors: Record<string, string>) {
    const first = Object.values(fieldErrors)[0] ?? "Invalid input";
    super(first);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Persistence failure (database unavailable, constraint violation, query error).
 * `message` is user-safe and must never contain note content or secrets.
 */
export class DataError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DataError";
  }
}
