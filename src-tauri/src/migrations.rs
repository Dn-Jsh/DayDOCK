//! Database migrations for `sqlite:daydock.db`.
//!
//! Rules (db-migration-discipline):
//! - Every released migration is immutable: add a new version instead of editing.
//! - Version numbers are unique and ascending; SQLite runs them in order.
//! - Migrations must be safe to re-run and are applied inside a transaction.
use tauri_plugin_sql::{Migration, MigrationKind};

/// Returns every migration for the DayDock database, oldest first.
pub fn migrations() -> Vec<Migration> {
    Vec::new()
}
