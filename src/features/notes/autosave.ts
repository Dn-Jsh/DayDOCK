/**
 * Debounced auto-save controller for the notes editor (T-007).
 *
 * Pure TypeScript — no React, no timers hidden behind components — so the
 * coalescing, retry and cancel semantics are unit-testable with fake timers.
 * The component supplies the actual write (`save`) and reacts to status
 * transitions; content is read through the closure the caller passes, which
 * keeps "what gets written" the component's concern and "when it gets written"
 * this module's concern.
 *
 * Semantics:
 * - `schedule()` marks the note dirty and (re)starts the debounce window; rapid
 *   typing therefore produces exactly one write after the user pauses.
 * - A change that arrives while a write is in flight is not lost: the in-flight
 *   result is ignored in favour of the newer dirty state, and the armed timer
 *   fires a follow-up write with the latest content.
 * - `runNow()` bypasses the debounce (used by the Retry affordance).
 * - `cancel()` is the unmount/switch path: it stops the pending timer and
 *   suppresses every further status notification. A write that already started
 *   still completes on the database side, and if newer keystrokes were waiting
 *   on the timer (or on that in-flight write) exactly one final detached write
 *   runs when it settles — cancel never drops content, it only detaches the UI.
 */

/** Debounce window before a change is written to SQLite. */
export const AUTOSAVE_DELAY_MS = 500;

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface AutoSaver {
  /** Call on every keystroke: (re)starts the debounce window. */
  schedule(): void;
  /** Runs the pending change immediately (Retry after a failed save). */
  runNow(): void;
  /** Stops the pending timer and detaches status reporting (unmount/note switch). */
  cancel(): void;
  /** True while a change exists that the database has not confirmed yet. */
  hasPendingChanges(): boolean;
  /** Current status; also reported through `onStatusChange`. */
  readonly status: SaveStatus;
}

export interface AutoSaverOptions {
  /** Performs the write; must resolve when the change is persisted. */
  save: () => Promise<void>;
  /** Receives every status transition, in order. */
  onStatusChange?: (status: SaveStatus) => void;
  /** Receives the failure behind an `"error"` status (ValidationError, DataError…). */
  onError?: (error: unknown) => void;
  /** Debounce window; defaults to `AUTOSAVE_DELAY_MS`. */
  delayMs?: number;
}

export function createAutoSaver({
  save,
  onStatusChange,
  onError,
  delayMs = AUTOSAVE_DELAY_MS,
}: AutoSaverOptions): AutoSaver {
  let status: SaveStatus = "idle";
  let timer: ReturnType<typeof setTimeout> | null = null;
  /* Bumped on every write start; a completion from an older generation is stale
     (a newer write superseded it) and must not touch the status. */
  let generation = 0;
  /* True while a change exists that no write has picked up yet. */
  let dirty = false;
  let inFlight = false;
  let detached = false;
  /* Set by `cancel()` when an in-flight write has not yet consumed the newest
     change; exactly one final detached write runs once it settles. */
  let finalWritePending = false;

  const setStatus = (next: SaveStatus): void => {
    if (detached || status === next) return;
    status = next;
    onStatusChange?.(next);
  };

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const start = (): void => {
    clearTimer();
    dirty = false;
    inFlight = true;
    const current = ++generation;
    setStatus("saving");
    void save().then(
      () => {
        inFlight = false;
        if (finalWritePending) {
          finalWritePending = false;
          start();
          return;
        }
        if (detached || current !== generation) return;
        /* If the user typed during the write, its timer is already armed —
           report "pending" so the UI never claims everything is saved. */
        setStatus(dirty ? "pending" : "saved");
      },
      (error: unknown) => {
        inFlight = false;
        if (finalWritePending) {
          /* The queued final write carries newer content, which may well
             validate where the failed one did not — give it its chance. */
          finalWritePending = false;
          start();
          return;
        }
        if (detached || current !== generation) return;
        onError?.(error);
        setStatus("error");
      },
    );
  };

  return {
    schedule(): void {
      if (detached) return;
      dirty = true;
      clearTimer();
      timer = setTimeout(start, delayMs);
      setStatus("pending");
    },
    runNow(): void {
      if (detached || inFlight) return;
      /* Nothing new to write, and no failure to retry. */
      if (!dirty && status !== "error") return;
      start();
    },
    cancel(): void {
      detached = true;
      clearTimer();
      /* Invalidate any in-flight completion so it cannot report status. */
      generation += 1;
      /* The newest change never reached `save()` (its write is still running or
         its timer never fired): queue exactly one final detached write. */
      if (inFlight && dirty) {
        finalWritePending = true;
      }
    },
    hasPendingChanges(): boolean {
      /* Once detached the saver will never write again — nothing is pending
         from its perspective, even if the abandoned change was dirty. */
      return !detached && (dirty || timer !== null);
    },
    get status(): SaveStatus {
      return status;
    },
  };
}

/**
 * Short, screen-reader-friendly label for the persistent save status.
 * "pending" and "saving" share one phrase so the aria-live region does not
 * announce the debounce window separately from the write itself.
 */
export function saveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case "idle":
    case "saved":
      return "Saved";
    case "pending":
    case "saving":
      return "Saving…";
    case "error":
      return "Save failed";
  }
}
