/**
 * Settings repository: key/value rows in the `settings` table.
 * Implements `SettingsRepository` from `src/data/contracts.ts`.
 *
 * Migration v1 seeds both keys; if a row is ever missing or unreadable the
 * built-in defaults are returned instead so the app keeps working.
 */
import { type AppSettings, type SettingsRepository, ValidationError } from "../contracts";
import { execute, select } from "../db";
import { validateFocusDurationMinutes } from "../validation";

const THEME_KEY = "theme";
const FOCUS_DURATION_KEY = "focusDurationMinutes";

/** Mirrors the defaults seeded by migration v1 (`INSERT OR IGNORE`). */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  focusDurationMinutes: 25,
};

interface SettingRow {
  key: string;
  value: string;
}

/** Maps raw settings rows to `AppSettings`, falling back to defaults. Exported for unit tests. */
export function mapSettingsRows(rows: SettingRow[]): AppSettings {
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const focusDurationMinutes = Number(stored.get(FOCUS_DURATION_KEY));
  return {
    theme: stored.get(THEME_KEY) === "light" ? "light" : "dark",
    focusDurationMinutes:
      Number.isSafeInteger(focusDurationMinutes) &&
      focusDurationMinutes >= 1 &&
      focusDurationMinutes <= 180
        ? focusDurationMinutes
        : DEFAULT_SETTINGS.focusDurationMinutes,
  };
}

async function get(): Promise<AppSettings> {
  const rows = await select<SettingRow>(
    "SELECT key, value FROM settings WHERE key IN (?, ?)",
    [THEME_KEY, FOCUS_DURATION_KEY],
  );
  return mapSettingsRows(rows);
}

async function update(patch: Partial<AppSettings>): Promise<AppSettings> {
  const errors: Record<string, string> = {};

  if (patch.theme !== undefined && patch.theme !== "dark" && patch.theme !== "light") {
    errors.theme = 'Theme must be "dark" or "light"';
  }
  if (patch.focusDurationMinutes !== undefined) {
    try {
      validateFocusDurationMinutes(patch.focusDurationMinutes);
    } catch (error) {
      if (error instanceof ValidationError) {
        Object.assign(errors, error.fieldErrors);
      } else {
        throw error;
      }
    }
  }
  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  if (patch.theme !== undefined) {
    await execute(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [THEME_KEY, patch.theme],
    );
  }
  if (patch.focusDurationMinutes !== undefined) {
    await execute(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [FOCUS_DURATION_KEY, String(patch.focusDurationMinutes)],
    );
  }
  return get();
}

export const settings: SettingsRepository = { get, update };
