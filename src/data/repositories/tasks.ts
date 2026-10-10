/**
 * Task repository: all SQL and row mapping for the `tasks` table.
 * Implements `TaskRepository` from `src/data/contracts.ts`; every write path
 * validates through `src/data/validation.ts` before touching the database.
 */
import {
  DataError,
  type Task,
  type TaskFilter,
  type TaskInput,
  type TaskPatch,
  type TaskRepository,
  type TaskStatus,
} from "../contracts";
import { execute, select } from "../db";
import { validateTaskInput } from "../validation";
import { likeContainsPattern, notFoundError, nowInstant } from "./shared";

const TASK_COLUMNS =
  "id, title, description, status, priority, due_date, project_id, created_at, updated_at, completed_at";

/** Columns targeted by an insert; `id` autoincrements and is never bound. */
const TASK_INSERT_COLUMNS =
  "title, description, status, priority, due_date, project_id, created_at, updated_at, completed_at";

/** Pending tasks first, then due date ascending with null due dates last, newest id first. */
const TASK_ORDER_BY =
  "ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END ASC, due_date IS NULL ASC, due_date ASC, id DESC";

/** Raw `tasks` row as returned by SQLite (snake_case columns). */
export interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** Maps a raw row to the camelCase `Task` domain type. Exported for unit tests. */
export function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    status: row.status as TaskStatus,
    priority: row.priority as Task["priority"],
    dueDate: row.due_date ?? null,
    projectId: row.project_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? null,
  };
}

/** Translates a `TaskFilter` into a parameterized WHERE clause. */
function buildFilterClause(filter: TaskFilter): { clause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const status = filter.status ?? "all";
  if (status === "pending" || status === "completed") {
    conditions.push("status = ?");
    params.push(status);
  }

  const priority = filter.priority ?? "all";
  if (priority === "low" || priority === "medium" || priority === "high") {
    conditions.push("priority = ?");
    params.push(priority);
  }

  const projectId = filter.projectId ?? "all";
  if (projectId === "none") {
    conditions.push("project_id IS NULL");
  } else if (typeof projectId === "number") {
    conditions.push("project_id = ?");
    params.push(projectId);
  }

  const query = filter.query?.trim() ?? "";
  if (query.length > 0) {
    const pattern = likeContainsPattern(query);
    conditions.push(
      "(lower(title) LIKE ? ESCAPE '\\' OR lower(description) LIKE ? ESCAPE '\\')",
    );
    params.push(pattern, pattern);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

async function list(filter: TaskFilter = {}): Promise<Task[]> {
  const { clause, params } = buildFilterClause(filter);
  const rows = await select<TaskRow>(
    `SELECT ${TASK_COLUMNS} FROM tasks ${clause} ${TASK_ORDER_BY}`,
    params,
  );
  return rows.map(mapTaskRow);
}

async function get(id: number): Promise<Task | null> {
  const rows = await select<TaskRow>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`, [id]);
  return rows.length > 0 ? mapTaskRow(rows[0]) : null;
}

async function create(input: TaskInput): Promise<Task> {
  const validated = validateTaskInput(input);
  const now = nowInstant();
  const result = await execute(
    `INSERT INTO tasks (${TASK_INSERT_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      validated.title,
      validated.description,
      "pending",
      validated.priority,
      validated.dueDate,
      validated.projectId,
      now,
      now,
    ],
  );
  if (result.lastInsertId === undefined) {
    throw new DataError("Could not save the new task.");
  }
  return {
    id: result.lastInsertId,
    title: validated.title,
    description: validated.description,
    status: "pending",
    priority: validated.priority,
    dueDate: validated.dueDate,
    projectId: validated.projectId,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

async function update(id: number, patch: TaskPatch): Promise<Task> {
  const existing = await get(id);
  if (existing === null) {
    throw notFoundError("Task");
  }
  const validated = validateTaskInput({
    title: patch.title !== undefined ? patch.title : existing.title,
    description: patch.description !== undefined ? patch.description : existing.description,
    priority: patch.priority !== undefined ? patch.priority : existing.priority,
    dueDate: patch.dueDate !== undefined ? patch.dueDate : existing.dueDate,
    projectId: patch.projectId !== undefined ? patch.projectId : existing.projectId,
  });
  const now = nowInstant();
  const result = await execute(
    `UPDATE tasks
     SET title = ?, description = ?, priority = ?, due_date = ?, project_id = ?, updated_at = ?
     WHERE id = ?`,
    [
      validated.title,
      validated.description,
      validated.priority,
      validated.dueDate,
      validated.projectId,
      now,
      id,
    ],
  );
  if (result.rowsAffected === 0) {
    throw notFoundError("Task");
  }
  return {
    ...existing,
    title: validated.title,
    description: validated.description,
    priority: validated.priority,
    dueDate: validated.dueDate,
    projectId: validated.projectId,
    updatedAt: now,
  };
}

async function setStatus(id: number, status: TaskStatus): Promise<Task> {
  if (status !== "pending" && status !== "completed") {
    throw new DataError("Status must be pending or completed.");
  }
  const existing = await get(id);
  if (existing === null) {
    throw notFoundError("Task");
  }
  const now = nowInstant();
  const result =
    status === "completed"
      ? await execute(
          `UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`,
          [now, now, id],
        )
      : await execute(
          `UPDATE tasks SET status = 'pending', completed_at = NULL, updated_at = ? WHERE id = ?`,
          [now, id],
        );
  if (result.rowsAffected === 0) {
    throw notFoundError("Task");
  }
  return {
    ...existing,
    status,
    updatedAt: now,
    completedAt: status === "completed" ? now : null,
  };
}

async function remove(id: number): Promise<void> {
  const result = await execute("DELETE FROM tasks WHERE id = ?", [id]);
  if (result.rowsAffected === 0) {
    throw notFoundError("Task");
  }
}

export const tasks: TaskRepository = { list, get, create, update, setStatus, remove };
