//! Database migrations for `sqlite:daydock.db`.
//!
//! Rules (db-migration-discipline):
//! - Every released migration is immutable: add a new version instead of editing.
//! - Version numbers are unique and ascending; SQLite runs them in order.
//! - Migrations must be safe to re-run and are applied inside a transaction.
use tauri_plugin_sql::{Migration, MigrationKind};

/// Returns every migration for the DayDock database, oldest first.
pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "initial_schema",
        sql: INITIAL_SCHEMA,
        kind: MigrationKind::Up,
    }]
}

/// Initial schema: projects, tasks, notes, focus sessions, focus state, settings.
///
/// Conventions (kept in sync with `src/data/contracts.ts`):
/// - Instants are ISO-8601 UTC strings, e.g. `2026-10-10T09:30:00.000Z`.
/// - `due_date` is a local date, `YYYY-MM-DD`.
/// - Booleans are INTEGER 0/1.
///
/// The whole statement is idempotent (`IF NOT EXISTS` / `INSERT OR IGNORE`) so
/// re-running migration v1 never touches existing user data.
const INITIAL_SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS projects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL CHECK (length(title) > 0),
    description  TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'completed')),
    priority     TEXT NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('low', 'medium', 'high')),
    due_date     TEXT,
    project_id   INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS focus_sessions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at          TEXT NOT NULL,
    ended_at            TEXT,
    planned_duration_ms INTEGER NOT NULL,
    actual_duration_ms  INTEGER NOT NULL DEFAULT 0,
    completed           INTEGER NOT NULL DEFAULT 0
                            CHECK (completed IN (0, 1)),
    task_id             INTEGER REFERENCES tasks(id) ON DELETE SET NULL
);

-- Single-row table holding the running/paused focus timer (row id is always 1).
CREATE TABLE IF NOT EXISTS focus_state (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    status              TEXT NOT NULL CHECK (status IN ('running', 'paused')),
    started_at          TEXT NOT NULL,
    elapsed_before_ms   INTEGER NOT NULL DEFAULT 0,
    planned_duration_ms INTEGER NOT NULL,
    task_id             INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_focus_started ON focus_sessions (started_at DESC);

INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark');
INSERT OR IGNORE INTO settings (key, value) VALUES ('focusDurationMinutes', '25');
";
