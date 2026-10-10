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
 * - `reset()` undoes `cancel()` for a cleanup that is followed by a fresh
 *   setup. React StrictMode double-invokes the mount effect exactly that way,
 *   and without the reset every editor would be born detached (T-013 Major #1).
 */

/** Debounce window before a change is written to SQLite. */
export const AUTOSAVE_DELAY_MS = 500;

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface AutoSaver {
  /** Call on every keystroke: (re)starts the debounce window. */
  schedule(): void;
  /** Runs the pending change immediately (Retry after a failed save). */
  runNow(): void;
  /**
   * Re-attaches after a cleanup that is followed by a new setup — what
   * React StrictMode's double-invoked mount effect produces
   * (setup → cleanup → setup). Undoes `cancel()` so later `schedule()` and
   * `runNow()` calls actually write again. Call it at the START of the effect
   * setup, before returning the cleanup.
   */
  reset(): void;
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
    reset(): void {
      /* StrictMode runs the mount effect as setup → cleanup → setup; without
         this re-arm the cleanup's cancel() would leave the saver detached
         forever, turning every later schedule()/runNow() into a silent no-op
         while the UI still claims "Saved" (T-013 Major #1). */
      detached = false;
      if (inFlight) {
        /* A write is still running: it stays the newest generation (cancel()
           no longer bumps it), so its completion reports status again now
           that the saver is attached. Nothing else may change under it. */
        return;
      }
      /* No write in flight: no completion can be pending, so stale flags are
         safe to clear and the generation counter starts fresh. */
      finalWritePending = false;
      generation = 0;
      /* A change that was still dirty when cancel() cleared its timer must
         get a new one — reset() may never strand a draft. */
      if (dirty && timer === null) {
        timer = setTimeout(start, delayMs);
      }
    },
    cancel(): void {
      detached = true;
      clearTimer();
      /* `detached` alone keeps any in-flight completion from reporting status;
         the generation counter stays untouched so a later reset() still
         recognises that write as the newest one and can let it report.
         If that write never picked up the newest change, queue exactly one
         final detached write for it to run when it settles. */
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
