//! DayDock Tauri entry point.
//!
//! The SQLite database lives at `<app config>/daydock.db` and is managed by
//! `tauri-plugin-sql`. Schema changes must always be added as a new migration
//! in `migrations.rs`; existing migrations are never edited after release.

mod migrations;

/// Writes a user-approved JSON backup to the path chosen in the native save
/// dialog.
///
/// Deliberately narrow: it only accepts `.json` targets and never touches the
/// SQLite database, so the frontend can export data without gaining general
/// filesystem access. Callers pass the already-serialized backup content.
#[tauri::command]
fn save_backup_file(path: String, contents: String) -> Result<(), String> {
    if !path.to_lowercase().ends_with(".json") {
        return Err("Backup files must use the .json extension.".to_string());
    }
    if contents.len() > 100 * 1024 * 1024 {
        return Err("The backup is too large to write.".to_string());
    }
    std::fs::write(&path, contents).map_err(|error| format!("Could not write the backup file: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:daydock.db", migrations::migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![save_backup_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
