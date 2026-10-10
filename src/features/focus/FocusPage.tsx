import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../../app/DataProvider";
import type { FocusSession, FocusState, Task } from "../../data/contracts";
import { formatClock } from "../../lib/date";
import { toErrorMessage } from "../../lib/errors";
import { PageHeader } from "../../components/layout/PageHeader";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { ErrorState } from "../../components/ui/error-state";
import { LoadingState } from "../../components/ui/loading-state";
import { SelectField, type SelectOption } from "../../components/ui/select";
import { FocusSessionList } from "./FocusSessionList";
import { FocusTimerPanel } from "./FocusTimerPanel";
import { completeFocusSessionIfDue } from "./completeSession";
import {
  computeFocusProgress,
  pauseTimer,
  resetTimer,
  resumeTimer,
  startTimer,
} from "./timer";

/** Preset durations offered by the selector (valid range is 1–180 minutes). */
const DURATION_STEPS_MINUTES = [1, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180];
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 180;
const MILLISECONDS_PER_MINUTE = 60_000;
/**
 * Re-render cadence for the clock only. The number on screen is always
 * derived from the wall clock (`computeFocusProgress`), never accumulated
 * from these ticks — so a suspended app or slept machine stays accurate.
 */
const CLOCK_REFRESH_MS = 500;
/** Minimum spacing between minute-boundary announcements of the live region. */
const MINUTE_ANNOUNCE_INTERVAL_MS = 60_000;
/** Fallback when an error carries no usable message (data-layer errors do). */
const ERROR_FALLBACK_MESSAGE = "The local database could not be reached.";

/** Select value → task id (`"none"`/invalid → `null`). */
function toTaskId(value: string): number | null {
  if (value === "none") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Adds a fallback option so a select value that vanished from the list still renders. */
function ensureTaskOption(options: SelectOption[], taskId: number | null): SelectOption[] {
  if (taskId === null) return options;
  const value = String(taskId);
  if (options.some((option) => option.value === value)) return options;
  return [...options, { value, label: `Task #${taskId} (no longer pending)` }];
}

/**
 * Focus timer and session history (T-008).
 *
 * Responsibilities: load settings + `focus_state` + history, re-derive the
 * remaining time from the wall clock on every render, persist every transition
 * through the data layer (so a running session survives restart), and surface
 * completion errors for the shared helper in `completeSession.ts`, which
 * writes a completed session to `focus_sessions` exactly once app-globally.
 * All timing rules live in the pure `timer.ts`; this component only
 * orchestrates.
 */
export default function FocusPage() {
  const data = useData();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [focusState, setFocusState] = useState<FocusState | null>(null);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [draftTaskId, setDraftTaskId] = useState("none");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  /** Stale-response guard for the load effect (StrictMode + Retry). */
  const loadRequestRef = useRef(0);
  /** Latest history rows without waiting for a render (list merge on completion). */
  const sessionsRef = useRef<FocusSession[]>([]);
  /** Last clock reading that touched the live region (throttle timestamps). */
  const lastAnnouncedAtRef = useRef(0);
  /** Minute bucket of the last minute-boundary announcement. */
  const lastAnnouncedMinuteKeyRef = useRef<number | null>(null);

  const replaceSessions = useCallback((rows: FocusSession[]) => {
    sessionsRef.current = rows;
    setSessions(rows);
  }, []);

  /* ---------------------------------------------------------------- load -- */

  const load = useCallback(async () => {
    const requestId = (loadRequestRef.current += 1);
    setLoading(true);
    try {
      const [settings, storedState, history, tasks] = await Promise.all([
        data.settings.get(),
        data.focusState.get(),
        data.focusSessions.list(),
        data.tasks.list({ status: "pending" }),
      ]);
      if (requestId !== loadRequestRef.current) return;
      setDurationMinutes(settings.focusDurationMinutes);
      setFocusState(storedState);
      replaceSessions(history);
      setPendingTasks(tasks);
      setLoadError(null);
      setActionError(null);
      setCompletionError(null);
      lastAnnouncedMinuteKeyRef.current = null;
    } catch (error: unknown) {
      if (requestId !== loadRequestRef.current) return;
      setLoadError(toErrorMessage(error, ERROR_FALLBACK_MESSAGE));
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [data, replaceSessions]);

  useEffect(() => {
    void load();
  }, [load]);

  /* --------------------------------------------------------------- clock -- */

  useEffect(() => {
    const sync = () => setNowMs(Date.now());
    sync();
    const intervalId = window.setInterval(sync, CLOCK_REFRESH_MS);
    /* Re-derive the moment the window wakes; the timestamp formula turns this
       into a correctness catch-up (e.g. after system sleep), not a reset. */
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  /* ---------------------------------------------------------- timing math -- */

  const { elapsedMs, remainingMs, progress } = computeFocusProgress(focusState, nowMs);
  const isActive = focusState !== null;
  const plannedMs =
    focusState?.plannedDurationMs ?? durationMinutes * MILLISECONDS_PER_MINUTE;
  /* Idle shows the planned duration as the ready value, not a dead 00:00. */
  const clockRemainingMs = isActive ? remainingMs : plannedMs;
  const activeTaskId = focusState?.taskId ?? null;
  const linkedTaskTitle =
    activeTaskId !== null
      ? (pendingTasks.find((task) => task.id === activeTaskId)?.title ?? null)
      : null;

  /* -------------------------------------------------------- live region --- */

  const announce = useCallback((text: string) => {
    lastAnnouncedAtRef.current = Date.now();
    setAnnouncement(text);
  }, []);

  /* Minute-boundary announcements: at most one per minute while running, and
     never within a minute of a state-change announcement. */
  const runningMinuteKey =
    focusState !== null && focusState.status === "running"
      ? Math.ceil(remainingMs / MILLISECONDS_PER_MINUTE)
      : null;

  useEffect(() => {
    if (runningMinuteKey === null) return;
    if (runningMinuteKey === lastAnnouncedMinuteKeyRef.current) return;
    if (nowMs - lastAnnouncedAtRef.current < MINUTE_ANNOUNCE_INTERVAL_MS) return;
    lastAnnouncedMinuteKeyRef.current = runningMinuteKey;
    lastAnnouncedAtRef.current = nowMs;
    setAnnouncement(`${formatClock(remainingMs)} remaining`);
  }, [runningMinuteKey, nowMs, remainingMs]);

  /* --------------------------------------------------------- transitions -- */

  /** Persists the next state first; the UI only changes if the write succeeded. */
  const applyState = useCallback(
    async (next: FocusState | null): Promise<boolean> => {
      setBusy(true);
      try {
        if (next === null) await data.focusState.clear();
        else await data.focusState.save(next);
        setFocusState(next);
        setActionError(null);
        return true;
      } catch (error: unknown) {
        setActionError(toErrorMessage(error, ERROR_FALLBACK_MESSAGE));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [data],
  );

  const handleStart = useCallback(async () => {
    if (busy || focusState !== null) return;
    const next = startTimer(
      Date.now(),
      durationMinutes * MILLISECONDS_PER_MINUTE,
      toTaskId(draftTaskId),
    );
    if (await applyState(next)) {
      announce(`Focus session started — ${durationMinutes} minutes.`);
    }
  }, [busy, focusState, durationMinutes, draftTaskId, applyState, announce]);

  const handlePause = useCallback(async () => {
    if (busy || focusState === null) return;
    const next = pauseTimer(focusState, Date.now());
    if (await applyState(next)) {
      announce(
        `Paused — ${formatClock(computeFocusProgress(next, Date.now()).remainingMs)} remaining.`,
      );
    }
  }, [busy, focusState, applyState, announce]);

  const handleResume = useCallback(async () => {
    if (busy || focusState === null) return;
    const next = resumeTimer(focusState, Date.now());
    if (await applyState(next)) {
      announce(
        `Resumed — ${formatClock(computeFocusProgress(next, Date.now()).remainingMs)} remaining.`,
      );
    }
  }, [busy, focusState, applyState, announce]);

  /** Reset: clears `focus_state`, writes no history row (confirmed in the UI). */
  const handleReset = useCallback(async () => {
    if (busy || focusState === null) return;
    if (await applyState(resetTimer(focusState))) {
      announce("Session reset — the current session was discarded.");
    }
  }, [busy, focusState, applyState, announce]);

  const handleDurationChange = useCallback(
    async (value: string) => {
      const minutes = Number(value);
      if (busy || focusState !== null) return;
      if (
        !Number.isSafeInteger(minutes) ||
        minutes < MIN_DURATION_MINUTES ||
        minutes > MAX_DURATION_MINUTES
      ) {
        return;
      }
      setBusy(true);
      try {
        const updated = await data.settings.update({ focusDurationMinutes: minutes });
        setDurationMinutes(updated.focusDurationMinutes);
        setActionError(null);
      } catch (error: unknown) {
        setActionError(toErrorMessage(error, ERROR_FALLBACK_MESSAGE));
      } finally {
        setBusy(false);
      }
    },
    [busy, focusState, data],
  );

  /* ---------------------------------------------------------- completion -- */

  /**
   * Runs the shared completion helper (`completeSession.ts` — the one
   * implementation, also driven app-globally by the completion watcher) and
   * applies the result to this page. The helper creates the history row
   * first, then clears `focus_state`, deduping against freshly loaded
   * history, so a crash between the two writes re-completes on retry
   * instead of duplicating the row.
   */
  const runCompletion = useCallback(
    async (state: FocusState): Promise<void> => {
      try {
        const outcome = await completeFocusSessionIfDue(data, state, Date.now());
        /* `null` = not due, or another caller (the watcher / a concurrent
           tick) owns this completion; it applies its own result. */
        if (outcome === null) return;
        replaceSessions([
          outcome.session,
          ...sessionsRef.current.filter((row) => row.id !== outcome.session.id),
        ]);
        setFocusState(null);
        setCompletionError(null);
        announce("Focus session complete.");
      } catch (error: unknown) {
        /* `focus_state` still holds the session (the helper clears it only
           after the history row exists), so Retry re-runs the helper and
           finishes the job without writing the row a second time. */
        setCompletionError(toErrorMessage(error, ERROR_FALLBACK_MESSAGE));
      }
    },
    [data, announce, replaceSessions],
  );

  /* The clock keeps re-running this while the deadline has passed but the
     write failed; `completionError` halts automatic retries until Retry.
     Before the deadline the helper answers `null` in memory — no I/O.
     `nowMs` is a deliberate dependency: every clock tick re-checks, so a
     completion the helper just handed to another caller (or a transient
     failure) is picked up without waiting for a state change. */
  useEffect(() => {
    if (focusState === null || completionError !== null) return;
    void runCompletion(focusState);
  }, [focusState, nowMs, completionError, runCompletion]);

  const handleRetryCompletion = useCallback(() => {
    setCompletionError(null);
    if (focusState !== null) {
      void runCompletion(focusState);
    }
  }, [focusState, runCompletion]);

  /* -------------------------------------------------------------- options -- */

  const durationOptions = useMemo<SelectOption[]>(() => {
    const steps = DURATION_STEPS_MINUTES.includes(durationMinutes)
      ? DURATION_STEPS_MINUTES
      : [...DURATION_STEPS_MINUTES, durationMinutes].sort((a, b) => a - b);
    return steps.map((minutes) => ({ value: String(minutes), label: `${minutes} min` }));
  }, [durationMinutes]);

  const taskOptions = useMemo<SelectOption[]>(() => {
    const base: SelectOption[] = [
      { value: "none", label: "No task" },
      ...pendingTasks.map((task) => ({ value: String(task.id), label: task.title })),
    ];
    const shownTaskId =
      focusState !== null ? focusState.taskId : toTaskId(draftTaskId);
    return ensureTaskOption(base, shownTaskId);
  }, [pendingTasks, focusState, draftTaskId]);

  const taskValue =
    focusState !== null ? String(focusState.taskId ?? "none") : draftTaskId;

  /* A failed completion write locks the timer controls until Retry succeeds —
     pausing an over-plan session would otherwise strand it. */
  const controlsLocked = busy || completionError !== null;

  /* --------------------------------------------------------------- render -- */

  if (loading) {
    return (
      <>
        <PageHeader
          title="Focus"
          subtitle="Pomodoro-style sessions with a history you can trust."
        />
        <LoadingState label="Loading focus timer…" />
      </>
    );
  }

  if (loadError !== null) {
    return (
      <>
        <PageHeader
          title="Focus"
          subtitle="Pomodoro-style sessions with a history you can trust."
        />
        <ErrorState
          title="Focus data could not be loaded"
          message={loadError}
          onRetry={() => void load()}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Focus"
        subtitle="Pomodoro-style sessions with a history you can trust."
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <FocusTimerPanel
          status={focusState?.status ?? null}
          remainingMs={clockRemainingMs}
          elapsedMs={elapsedMs}
          plannedDurationMs={plannedMs}
          progress={progress}
          announcement={announcement}
          busy={controlsLocked}
          linkedTaskTitle={linkedTaskTitle}
          onStart={() => void handleStart()}
          onPause={() => void handlePause()}
          onResume={() => void handleResume()}
          onReset={() => setConfirmReset(true)}
        />

        <section
          aria-label="Session settings"
          className="rounded-none border border-border bg-card p-4"
        >
          <h2 className="text-sm font-medium text-foreground">Session settings</h2>
          <div className="mt-3 flex flex-col gap-1.5">
            <SelectField
              label="Focus duration"
              value={String(durationMinutes)}
              onValueChange={(value) => void handleDurationChange(value)}
              options={durationOptions}
              disabled={controlsLocked || isActive}
              describedBy="focus-duration-hint"
            />
            <p id="focus-duration-hint" className="text-xs text-muted-foreground">
              {isActive
                ? "Locked while a session is active."
                : "Minutes for the next session (1–180)."}
            </p>

            <div className="mt-2">
              <SelectField
                label="Link a task"
                value={taskValue}
                onValueChange={setDraftTaskId}
                options={taskOptions}
                disabled={controlsLocked || isActive}
                describedBy="focus-task-hint"
              />
              <p id="focus-task-hint" className="mt-1.5 text-xs text-muted-foreground">
                {isActive
                  ? "The active session keeps the task it started with."
                  : "Optional: attribute the next session to a pending task."}
              </p>
            </div>
          </div>
        </section>
      </div>

      {actionError !== null ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {completionError !== null ? (
        <div className="mt-3">
          <ErrorState
            title="The completed session could not be saved"
            message={completionError}
            onRetry={handleRetryCompletion}
          />
        </div>
      ) : null}

      <div className="mt-4">
        <FocusSessionList sessions={sessions} nowMs={nowMs} />
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset focus session?"
        description={`Reset discards the current session — ${formatClock(
          remainingMs,
        )} remaining will be discarded and no entry is added to history.`}
        confirmLabel="Reset session"
        onConfirm={handleReset}
      />
    </>
  );
}
