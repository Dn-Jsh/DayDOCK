//! DayDock Tauri entry point.
//!
//! The SQLite database lives at `<app config>/daydock.db` and is managed by
//! `tauri-plugin-sql`. Schema changes must always be added as a new migration
//! in `migrations.rs`; existing migrations are never edited after release.

mod migrations;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:daydock.db", migrations::migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
