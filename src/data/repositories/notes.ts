/**
 * Note repository: all SQL and row mapping for the `notes` table.
 * Implements `NoteRepository` from `src/data/contracts.ts`.
 * Search matches title and content, case-insensitively.
 */
import { DataError, type Note, type NoteRepository } from "../contracts";
import { execute, select } from "../db";
import { validateNoteInput } from "../validation";
import { likeContainsPattern, notFoundError, nowInstant } from "./shared";

const NOTE_COLUMNS = "id, title, content, created_at, updated_at";

/** Raw `notes` row as returned by SQLite (snake_case columns). */
export interface NoteRow {
  id: number;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
}

/** Maps a raw row to the camelCase `Note` domain type. Exported for unit tests. */
export function mapNoteRow(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function list(query = ""): Promise<Note[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    const rows = await select<NoteRow>(
      `SELECT ${NOTE_COLUMNS} FROM notes ORDER BY updated_at DESC, id DESC`,
    );
    return rows.map(mapNoteRow);
  }
  const pattern = likeContainsPattern(trimmed);
  const rows = await select<NoteRow>(
    `SELECT ${NOTE_COLUMNS} FROM notes
     WHERE (lower(title) LIKE ? ESCAPE '\\' OR lower(content) LIKE ? ESCAPE '\\')
     ORDER BY updated_at DESC, id DESC`,
    [pattern, pattern],
  );
  return rows.map(mapNoteRow);
}

async function get(id: number): Promise<Note | null> {
  const rows = await select<NoteRow>(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`, [id]);
  return rows.length > 0 ? mapNoteRow(rows[0]) : null;
}

async function create(input: { title: string; content?: string }): Promise<Note> {
  const validated = validateNoteInput(input);
  const now = nowInstant();
  const result = await execute(
    `INSERT INTO notes (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    [validated.title, validated.content, now, now],
  );
  if (result.lastInsertId === undefined) {
    throw new DataError("Could not save the new note.");
  }
  return {
    id: result.lastInsertId,
    title: validated.title,
    content: validated.content,
    createdAt: now,
    updatedAt: now,
  };
}

async function update(id: number, patch: { title?: string; content?: string }): Promise<Note> {
  const existing = await get(id);
  if (existing === null) {
    throw notFoundError("Note");
  }
  const validated = validateNoteInput({
    title: patch.title !== undefined ? patch.title : existing.title,
    content: patch.content !== undefined ? patch.content : existing.content,
  });
  const now = nowInstant();
  const result = await execute(
    `UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?`,
    [validated.title, validated.content, now, id],
  );
  if (result.rowsAffected === 0) {
    throw notFoundError("Note");
  }
  return {
    ...existing,
    title: validated.title,
    content: validated.content,
    updatedAt: now,
  };
}

async function remove(id: number): Promise<void> {
  const result = await execute("DELETE FROM notes WHERE id = ?", [id]);
  if (result.rowsAffected === 0) {
    throw notFoundError("Note");
  }
}

export const notes: NoteRepository = { list, get, create, update, remove };
