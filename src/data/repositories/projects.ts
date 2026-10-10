/**
 * Project repository: all SQL and row mapping for the `projects` table.
 * Implements `ProjectRepository` from `src/data/contracts.ts`.
 *
 * Deleting a project never deletes its tasks: the tasks are unassigned
 * (`project_id = NULL`) and kept.
 */
import {
  DataError,
  type Project,
  type ProjectRepository,
  type ProjectWithProgress,
} from "../contracts";
import { execute, select } from "../db";
import { validateProjectName } from "../validation";
import { notFoundError, nowInstant } from "./shared";

/** Joins projects with their task aggregates; pair with `PROJECT_GROUP_BY`. */
const PROJECT_PROGRESS_SELECT = `
    SELECT p.id, p.name, p.created_at, p.updated_at,
           COUNT(t.id) AS task_count,
           SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_count
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id`;

const PROJECT_GROUP_BY =
  " GROUP BY p.id, p.name, p.created_at, p.updated_at";

/** Raw `projects` row as returned by SQLite (snake_case columns). */
export interface ProjectRow {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

/** Raw row of the progress query: a project plus its task aggregates. */
export interface ProjectProgressRow extends ProjectRow {
  task_count: number | null;
  completed_count: number | null;
}

/** Maps a raw row to the camelCase `Project` domain type. Exported for unit tests. */
export function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Maps a raw progress row to `ProjectWithProgress`. LEFT JOIN aggregates come
 * back as `NULL` on an empty project, which maps to zero. Unit tested.
 */
export function mapProjectWithProgressRow(row: ProjectProgressRow): ProjectWithProgress {
  return {
    ...mapProjectRow(row),
    taskCount: row.task_count ?? 0,
    completedCount: row.completed_count ?? 0,
  };
}

async function list(): Promise<ProjectWithProgress[]> {
  const rows = await select<ProjectProgressRow>(
    `${PROJECT_PROGRESS_SELECT}${PROJECT_GROUP_BY} ORDER BY p.created_at ASC, p.id ASC`,
  );
  return rows.map(mapProjectWithProgressRow);
}

async function get(id: number): Promise<ProjectWithProgress | null> {
  const rows = await select<ProjectProgressRow>(
    `${PROJECT_PROGRESS_SELECT} WHERE p.id = ?${PROJECT_GROUP_BY}`,
    [id],
  );
  return rows.length > 0 ? mapProjectWithProgressRow(rows[0]) : null;
}

async function create(name: string): Promise<Project> {
  const validatedName = validateProjectName(name);
  const now = nowInstant();
  const result = await execute(
    `INSERT INTO projects (name, created_at, updated_at) VALUES (?, ?, ?)`,
    [validatedName, now, now],
  );
  if (result.lastInsertId === undefined) {
    throw new DataError("Could not save the new project.");
  }
  return {
    id: result.lastInsertId,
    name: validatedName,
    createdAt: now,
    updatedAt: now,
  };
}

async function rename(id: number, name: string): Promise<Project> {
  const validatedName = validateProjectName(name);
  const existing = await get(id);
  if (existing === null) {
    throw notFoundError("Project");
  }
  const now = nowInstant();
  const result = await execute(
    `UPDATE projects SET name = ?, updated_at = ? WHERE id = ?`,
    [validatedName, now, id],
  );
  if (result.rowsAffected === 0) {
    throw notFoundError("Project");
  }
  return {
    id,
    name: validatedName,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
}

async function remove(id: number): Promise<void> {
  const existing = await get(id);
  if (existing === null) {
    throw notFoundError("Project");
  }
  // Unassign first: tasks survive project deletion, they are never deleted here.
  await execute("UPDATE tasks SET project_id = NULL WHERE project_id = ?", [id]);
  await execute("DELETE FROM projects WHERE id = ?", [id]);
}

export const projects: ProjectRepository = { list, get, create, rename, remove };
