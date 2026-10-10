/**
 * User-facing copy for the Settings page (T-009), kept in one module so the
 * honesty-critical sentences are pinned by unit tests and cannot drift.
 *
 * The restore limitation is a hard product rule (PROJECT-BRIEF.md):
 * DayDock exports backups but has no restore/import in the MVP. Nothing on
 * this page may imply otherwise.
 */

/** What the export contains — must list every supported table. */
export const EXPORT_INCLUDES_LINE =
  "Includes every project, task, note and focus session, plus your settings.";

/**
 * The mandatory honesty line. Export is one-way in this version; this exact
 * sentence must remain visible next to the export control.
 */
export const RESTORE_LIMITATION_LINE =
  "Export only — restoring a backup is not available in this version.";

/** Where the working data lives (no fabricated absolute path). */
export const STORAGE_LOCATION_LINE =
  "Your data lives in a local SQLite file (daydock.db) inside DayDock's application-data folder.";

/** About facts. */
export const ABOUT_OFFLINE_LINE = "Works fully offline — no account, no cloud.";
export const ABOUT_PLATFORM_LINE = "Windows desktop (Tauri 2)";
