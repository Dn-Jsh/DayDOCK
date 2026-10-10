/**
 * Focus repositories: history rows for the `focus_sessions` table and the
 * single-row running timer state in `focus_state` (row id is always 1).
 *
 * Implements `FocusSessionRepository` and `FocusStateRepository` from
 * `src/data/contracts.ts`. `focusState.clear()` is an idempotent reset — it
 * succeeds even when nothing is stored, so "reset the timer" never errors.
 */
import {
  DataError,
  type FocusSession,
  type FocusSessionInput,
  type FocusSessionRepository,
  type FocusState,
  type FocusStateRepository,
} from "../contracts";
import { execute, select } from "../db";
import { validateFocusSessionInput, validateFocusState } from "../validation";

/** The single row of `focus_state` always uses this id. */
const FOCUS_STATE_ROW_ID = 1;

/** Full column list for SELECTs (includes the autoincrement key). */
const FOCUS_SESSION_COLUMNS =
  "id, started_at, ended_at, planned_duration_ms, actual_duration_ms, completed, task_id";

/**
 * Columns targeted by an insert. `id` is deliberately absent — it
 * autoincrements (`INTEGER PRIMARY KEY AUTOINCREMENT` in migration v1) and
 * must never appear in the column list or the placeholder list. Kept separate
 * from `FOCUS_SESSION_COLUMNS` so a SELECT and an INSERT can never drift into
 * different column counts; the lockstep regression test in
 * `repositories.integration.test.ts` pins columns = placeholders = params.
 */
const FOCUS_SESSION_INSERT_COLUMNS =
  "started_at, ended_at, planned_duration_ms, actual_duration_ms, completed, task_id";

const FOCUS_STATE_COLUMNS =
  "id, status, started_at, elapsed_before_ms, planned_duration_ms, task_id";

/** Raw `focus_sessions` row as returned by SQLite (snake_case columns). */
export interface FocusSessionRow {
  id: number;
  started_at: string;
  ended_at: string | null;
  planned_duration_ms: number;
  actual_duration_ms: number;
  completed: number;
  task_id: number | null;
}

/** Raw `focus_state` row as returned by SQLite (snake_case columns). */
export interface FocusStateRow {
  id: number;
  status: string;
  started_at: string;
  elapsed_before_ms: number;
  planned_duration_ms: number;
  task_id: number | null;
}

/** Maps a raw row to the camelCase `FocusSession` domain type (0/1 → boolean). */
export function mapFocusSessionRow(row: FocusSessionRow): FocusSession {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    plannedDurationMs: row.planned_duration_ms,
    actualDurationMs: row.actual_duration_ms,
    completed: row.completed === 1,
    taskId: row.task_id ?? null,
  };
}

/** Maps a raw row to the camelCase `FocusState` domain type. */
export function mapFocusStateRow(row: FocusStateRow): FocusState {
  return {
    status: row.status as FocusState["status"],
    startedAt: row.started_at,
    elapsedBeforeMs: row.elapsed_before_ms,
    plannedDurationMs: row.planned_duration_ms,
    taskId: row.task_id ?? null,
  };
}

async function list(limit?: number): Promise<FocusSession[]> {
  if (limit === undefined) {
    const rows = await select<FocusSessionRow>(
      `SELECT ${FOCUS_SESSION_COLUMNS} FROM focus_sessions ORDER BY started_at DESC, id DESC`,
    );
    return rows.map(mapFocusSessionRow);
  }
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new DataError("History limit must be a positive whole number.");
  }
  const rows = await select<FocusSessionRow>(
    `SELECT ${FOCUS_SESSION_COLUMNS} FROM focus_sessions
     ORDER BY started_at DESC, id DESC LIMIT ?`,
    [limit],
  );
  return rows.map(mapFocusSessionRow);
}

async function create(input: FocusSessionInput): Promise<FocusSession> {
  const validated = validateFocusSessionInput(input);
  /* The placeholder list is derived from the column list, so the two can
     never diverge in count again (the T-014 Blocker: 7 columns, 6 params). */
  const placeholders = FOCUS_SESSION_INSERT_COLUMNS.split(", ")
    .map(() => "?")
    .join(", ");
  const result = await execute(
    `INSERT INTO focus_sessions (${FOCUS_SESSION_INSERT_COLUMNS})
     VALUES (${placeholders})`,
    [
      validated.startedAt,
      validated.endedAt,
      validated.plannedDurationMs,
      validated.actualDurationMs,
      validated.completed ? 1 : 0,
      validated.taskId,
    ],
  );
  if (result.lastInsertId === undefined) {
    throw new DataError("Could not save the focus session.");
  }
  return {
    id: result.lastInsertId,
    startedAt: validated.startedAt,
    endedAt: validated.endedAt,
    plannedDurationMs: validated.plannedDurationMs,
    actualDurationMs: validated.actualDurationMs,
    completed: validated.completed,
    taskId: validated.taskId ?? null,
  };
}

async function getFocusState(): Promise<FocusState | null> {
  const rows = await select<FocusStateRow>(
    `SELECT ${FOCUS_STATE_COLUMNS} FROM focus_state WHERE id = ?`,
    [FOCUS_STATE_ROW_ID],
  );
  return rows.length > 0 ? mapFocusStateRow(rows[0]) : null;
}

async function saveFocusState(state: FocusState): Promise<void> {
  const validated = validateFocusState(state);
  await execute(
    `INSERT INTO focus_state (${FOCUS_STATE_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        started_at = excluded.started_at,
        elapsed_before_ms = excluded.elapsed_before_ms,
        planned_duration_ms = excluded.planned_duration_ms,
        task_id = excluded.task_id`,
    [
      FOCUS_STATE_ROW_ID,
      validated.status,
      validated.startedAt,
      validated.elapsedBeforeMs,
      validated.plannedDurationMs,
      validated.taskId,
    ],
  );
}

async function clearFocusState(): Promise<void> {
  await execute("DELETE FROM focus_state WHERE id = ?", [FOCUS_STATE_ROW_ID]);
}

export const focusSessions: FocusSessionRepository = { list, create };
export const focusState: FocusStateRepository = {
  get: getFocusState,
  save: saveFocusState,
  clear: clearFocusState,
};
