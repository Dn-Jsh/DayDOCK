import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useData } from "../../app/DataProvider";
import { useTheme } from "../../app/theme";
import type { AppSettings, ThemeMode } from "../../data/contracts";
import { ValidationError } from "../../data/contracts";
import { exportBackupToFile } from "../../data/export";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/button";
import { ErrorState } from "../../components/ui/error-state";
import { Input } from "../../components/ui/input";
import { LoadingState } from "../../components/ui/loading-state";
import { SelectField, type SelectOption } from "../../components/ui/select";
import { APP_VERSION } from "../../data/export";
import {
  FOCUS_DURATION_PRESETS,
  MAX_FOCUS_MINUTES,
  MIN_FOCUS_MINUTES,
  parseFocusMinutesInput,
} from "./focusDuration";
import {
  ABOUT_OFFLINE_LINE,
  ABOUT_PLATFORM_LINE,
  EXPORT_INCLUDES_LINE,
  RESTORE_LIMITATION_LINE,
  STORAGE_LOCATION_LINE,
} from "./settingsCopy";

/** Product name for the About section (matches `Backup.app.name`). */
const APP_NAME = "DayDock";

const THEME_CHOICES: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

/** DataError/ValidationError already carry user-safe messages; fall back anyway. */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "The change could not be saved.";
}

function formatByteCount(bytes: number): string {
  return `${new Intl.NumberFormat().format(bytes)} bytes`;
}

/**
 * Settings (T-009): theme, focus duration, JSON backup export and app info.
 *
 * Theme changes go through `useTheme()`, which applies the value immediately
 * and persists it through the settings repository; the duration is written
 * with `data.settings.update`, so the Focus page reads the new value the next
 * time it mounts. Export gathers every table, opens the native save dialog
 * and writes through the `save_backup_file` command — it is one-way by
 * design; restore/import does not exist in this version.
 */
export default function SettingsPage() {
  const data = useData();
  const { theme, setTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [themeError, setThemeError] = useState<string | null>(null);

  const [durationDraft, setDurationDraft] = useState("");
  const [durationSaving, setDurationSaving] = useState(false);
  const [durationFieldErrors, setDurationFieldErrors] = useState<Record<string, string>>({});
  const [durationSaveError, setDurationSaveError] = useState<string | null>(null);
  const [durationStatus, setDurationStatus] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadRequestRef = useRef(0);
  const baseId = useId();
  const durationInputId = `${baseId}-duration`;
  const durationHintId = `${baseId}-duration-hint`;
  const durationErrorId = `${baseId}-duration-error`;

  /* --------------------------------------------------------------- load -- */

  const load = useCallback(async () => {
    const requestId = (loadRequestRef.current += 1);
    setLoading(true);
    try {
      const loaded = await data.settings.get();
      if (requestId !== loadRequestRef.current) return;
      setSettings(loaded);
      setDurationDraft(String(loaded.focusDurationMinutes));
      setLoadError(null);
    } catch (error: unknown) {
      if (requestId !== loadRequestRef.current) return;
      setLoadError(toErrorMessage(error));
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    void load();
  }, [load]);

  /* -------------------------------------------------------------- theme -- */

  /* Persistence is owned by ThemeProvider.setTheme; this only surfaces failures. */
  const handleThemeChange = useCallback(
    async (next: ThemeMode) => {
      setThemeError(null);
      try {
        await setTheme(next);
      } catch (error: unknown) {
        setThemeError(toErrorMessage(error));
      }
    },
    [setTheme],
  );

  /* ------------------------------------------------ focus duration ------- */

  const durationError = durationFieldErrors.focusDurationMinutes;

  const commitDuration = useCallback(
    async (raw: string) => {
      let minutes: number;
      try {
        minutes = parseFocusMinutesInput(raw);
      } catch (error: unknown) {
        if (error instanceof ValidationError) {
          setDurationFieldErrors(error.fieldErrors);
          setDurationStatus(null);
        } else {
          setDurationSaveError(toErrorMessage(error));
        }
        return;
      }
      if (settings !== null && minutes === settings.focusDurationMinutes) {
        /* Already stored — normalise the draft without a pointless write. */
        setDurationDraft(String(minutes));
        setDurationFieldErrors({});
        return;
      }
      setDurationSaving(true);
      try {
        const updated = await data.settings.update({ focusDurationMinutes: minutes });
        setSettings(updated);
        setDurationDraft(String(updated.focusDurationMinutes));
        setDurationFieldErrors({});
        setDurationSaveError(null);
        setDurationStatus(`Focus duration saved — ${updated.focusDurationMinutes} minutes.`);
      } catch (error: unknown) {
        /* Typed text stays in the draft; only the message is shown inline. */
        if (error instanceof ValidationError) {
          setDurationFieldErrors(error.fieldErrors);
        } else {
          setDurationSaveError(toErrorMessage(error));
        }
      } finally {
        setDurationSaving(false);
      }
    },
    [data, settings],
  );

  const handlePresetChange = useCallback(
    (value: string) => {
      setDurationDraft(value);
      void commitDuration(value);
    },
    [commitDuration],
  );

  const presetOptions = useMemo<SelectOption[]>(() => {
    const steps =
      settings !== null && !(FOCUS_DURATION_PRESETS as readonly number[]).includes(
        settings.focusDurationMinutes,
      )
        ? [...FOCUS_DURATION_PRESETS, settings.focusDurationMinutes].sort((a, b) => a - b)
        : [...FOCUS_DURATION_PRESETS];
    return steps.map((minutes) => ({ value: String(minutes), label: `${minutes} minutes` }));
  }, [settings]);

  /* ------------------------------------------------------------- export -- */

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    setExportStatus(null);
    try {
      const result = await exportBackupToFile(data);
      setExportStatus(
        result === null
          ? "Export cancelled — no file was written."
          : `Backup saved to ${result.path} (${formatByteCount(result.bytes)}).`,
      );
    } catch (error: unknown) {
      setExportError(toErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }, [data]);

  /* ------------------------------------------------------------- render -- */

  if (loading) {
    return (
      <>
        <PageHeader title="Settings" subtitle="Theme, focus duration and local data export." />
        <LoadingState label="Loading settings…" />
      </>
    );
  }

  if (loadError !== null) {
    return (
      <>
        <PageHeader title="Settings" subtitle="Theme, focus duration and local data export." />
        <ErrorState
          title="Settings could not be loaded"
          message={loadError}
          onRetry={() => void load()}
        />
      </>
    );
  }

  const storedDuration = settings?.focusDurationMinutes ?? MIN_FOCUS_MINUTES;
  const presetValue = (FOCUS_DURATION_PRESETS as readonly number[]).includes(storedDuration)
    ? String(storedDuration)
    : "";

  return (
    <>
      <PageHeader title="Settings" subtitle="Theme, focus duration and local data export." />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* ------------------------------------------------------ appearance */}
        <section
          aria-labelledby={`${baseId}-appearance`}
          className="rounded-none border border-border bg-card p-4"
        >
          <h2 id={`${baseId}-appearance`} className="text-sm font-medium text-foreground">
            Appearance
          </h2>
          <fieldset className="mt-3">
            <legend className="text-xs font-medium text-foreground">Theme</legend>
            <div className="mt-2 flex items-center gap-4">
              {THEME_CHOICES.map(({ value, label }) => (
                <label
                  key={value}
                  htmlFor={`${baseId}-theme-${value}`}
                  className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="radio"
                    id={`${baseId}-theme-${value}`}
                    name={`${baseId}-theme`}
                    value={value}
                    checked={theme === value}
                    onChange={() => void handleThemeChange(value)}
                    className="h-4 w-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-2 text-xs text-muted-foreground">
            Applied immediately and remembered for the next start.
          </p>
          {themeError !== null ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {themeError}
            </p>
          ) : null}
        </section>

        {/* --------------------------------------------------- focus timer -- */}
        <section
          aria-labelledby={`${baseId}-timer`}
          className="rounded-none border border-border bg-card p-4"
        >
          <h2 id={`${baseId}-timer`} className="text-sm font-medium text-foreground">
            Focus timer
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            <SelectField
              label="Preset durations"
              value={presetValue}
              onValueChange={handlePresetChange}
              options={presetOptions}
              placeholder="Custom…"
              disabled={durationSaving}
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={durationInputId}
                className="text-xs font-medium text-foreground"
              >
                Focus duration (minutes)
              </label>
              <Input
                id={durationInputId}
                type="number"
                inputMode="numeric"
                min={MIN_FOCUS_MINUTES}
                max={MAX_FOCUS_MINUTES}
                step={1}
                value={durationDraft}
                onChange={(event) => setDurationDraft(event.target.value)}
                onBlur={() => void commitDuration(durationDraft)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void commitDuration(durationDraft);
                  }
                }}
                aria-invalid={durationError !== undefined || undefined}
                aria-describedby={durationError !== undefined ? durationErrorId : durationHintId}
                disabled={durationSaving}
                className="max-w-[9rem]"
              />
              {durationError !== undefined ? (
                <p id={durationErrorId} className="text-xs text-destructive">
                  {durationError}
                </p>
              ) : (
                <p id={durationHintId} className="text-xs text-muted-foreground">
                  Whole minutes, {MIN_FOCUS_MINUTES}–{MAX_FOCUS_MINUTES}. Used for the next
                  session.
                </p>
              )}
            </div>
            {durationSaveError !== null ? (
              <p role="alert" className="text-sm text-destructive">
                {durationSaveError}
              </p>
            ) : null}
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {durationStatus}
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------- data -- */}
        <section
          aria-labelledby={`${baseId}-data`}
          className="rounded-none border border-border bg-card p-4"
        >
          <h2 id={`${baseId}-data`} className="text-sm font-medium text-foreground">
            Data
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{EXPORT_INCLUDES_LINE}</p>
          <p className="mt-1 text-sm font-medium text-foreground">{RESTORE_LIMITATION_LINE}</p>
          <p className="mt-1 text-xs text-muted-foreground">{STORAGE_LOCATION_LINE}</p>
          <div className="mt-3 flex items-center gap-3">
            <Button variant="primary" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? "Exporting…" : "Export backup"}
            </Button>
            {exporting ? (
              <span role="status" className="text-sm text-muted-foreground">
                Writing backup…
              </span>
            ) : null}
          </div>
          <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">
            {exportStatus}
          </p>
          {exportError !== null ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {exportError}
            </p>
          ) : null}
        </section>

        {/* --------------------------------------------------------- about -- */}
        <section
          aria-labelledby={`${baseId}-about`}
          className="rounded-none border border-border bg-card p-4"
        >
          <h2 id={`${baseId}-about`} className="text-sm font-medium text-foreground">
            About
          </h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Application</dt>
              <dd className="text-foreground">{APP_NAME}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Version</dt>
              <dd className="text-foreground">{APP_VERSION}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">Platform</dt>
              <dd className="text-foreground">{ABOUT_PLATFORM_LINE}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">Connectivity</dt>
              <dd className="text-foreground">{ABOUT_OFFLINE_LINE}</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}
