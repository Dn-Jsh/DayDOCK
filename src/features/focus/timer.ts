/**
 * Pure timing model for the focus timer (T-008, gold lane).
 *
 * The clock is always injected (`nowMs`); nothing in this module reads
 * `Date.now()`, so every rule is unit-testable with a fake clock.
 *
 * Elapsed time derives from wall-clock timestamps, never from accumulated
 * interval ticks:
 *
 *   elapsedMs = elapsedBeforeMs + (status === "running" ? now − startedAt : 0)
 *
 * Because the delta comes from timestamps, system sleep, app suspension and
 * window blur are accounted for automatically: a session started at T that
 * sleeps for 10 minutes wakes with `now` 10 minutes later and correctly shows
 * 10 minutes consumed. The `setInterval` in the UI only triggers a re-render;
 * the displayed number always comes from `computeFocusProgress(state, now)`.
 *
 * All elapsed values are clamped at zero (guarding against clock skew) and
 * `remainingMs` is clamped at zero (guarding against running past the plan).
 */
import type { FocusSessionInput, FocusState } from "../../data/contracts";

/** Result of a `tickTimer` call. */
export interface FocusTickResult {
  /**
   * The state to keep after the tick. `null` when no session is active or the
   * session just completed (the state row is cleared — see `FocusPage`).
   */
  state: FocusState | null;
  /**
   * Present only on the single tick that reaches the deadline. A later tick
   * over `null` state yields no second session (completion is idempotent).
   */
  completedSession?: FocusSessionInput;
}

/** Snapshot of an active session's timing, safe to render at any `nowMs`. */
export interface FocusProgress {
  /** Milliseconds consumed so far; may exceed `plannedDurationMs` after a sleep past the deadline. */
  elapsedMs: number;
  /** Milliseconds left, clamped at 0. */
  remainingMs: number;
  /** Completion fraction in `[0, 1]` (multiply by 100 for a percentage bar). */
  progress: number;
}

/** ISO-8601 UTC instant for an epoch-millisecond clock reading. */
function toInstant(nowMs: number): string {
  return new Date(nowMs).toISOString();
}

/**
 * Milliseconds consumed by `state` at `nowMs`.
 *
 * The running segment is clamped at zero separately from
 * `elapsedBeforeMs`, so a clock that jumps *backwards* mid-run can never eat
 * time already accumulated in earlier segments.
 */
export function elapsedMsOf(state: FocusState, nowMs: number): number {
  const startedAtMs = Date.parse(state.startedAt);
  const segmentMs =
    state.status === "running" ? Math.max(0, nowMs - startedAtMs) : 0;
  return Math.max(0, state.elapsedBeforeMs) + segmentMs;
}

/** Milliseconds left at `nowMs`, clamped at 0. */
export function remainingMsOf(state: FocusState, nowMs: number): number {
  return Math.max(0, state.plannedDurationMs - elapsedMsOf(state, nowMs));
}

/** Idle → running. Persists as the `focus_state` row so it survives restart. */
export function startTimer(
  nowMs: number,
  plannedDurationMs: number,
  taskId: number | null,
): FocusState {
  return {
    status: "running",
    startedAt: toInstant(nowMs),
    elapsedBeforeMs: 0,
    plannedDurationMs,
    taskId,
  };
}

/**
 * Running → paused. Freezes the elapsed time into `elapsedBeforeMs` so the
 * paused session stops consuming its plan no matter how long it stays paused.
 * Already paused: returns the state unchanged (no-op).
 */
export function pauseTimer(state: FocusState, nowMs: number): FocusState {
  if (state.status === "paused") return state;
  return {
    status: "paused",
    startedAt: state.startedAt,
    elapsedBeforeMs: elapsedMsOf(state, nowMs),
    plannedDurationMs: state.plannedDurationMs,
    taskId: state.taskId,
  };
}

/**
 * Paused → running. Re-anchors `startedAt` to `now` and keeps the frozen
 * `elapsedBeforeMs`. Already running: returns the state unchanged (no-op —
 * re-anchoring would silently discard the current segment).
 */
export function resumeTimer(state: FocusState, nowMs: number): FocusState {
  if (state.status === "running") return state;
  return {
    status: "running",
    startedAt: toInstant(nowMs),
    elapsedBeforeMs: Math.max(0, state.elapsedBeforeMs),
    plannedDurationMs: state.plannedDurationMs,
    taskId: state.taskId,
  };
}

/**
 * Clears `focus_state` and writes **no** history row — the session is
 * discarded (the UI must say so before confirming). The `state` argument is
 * accepted for transition symmetry, `reset(state)`, and intentionally unused;
 * the result is always `null`.
 */
export function resetTimer(_state: FocusState | null): null {
  return null;
}

/**
 * The instant at which `state`'s accumulated elapsed time reaches its plan —
 * the `endedAt` recorded for a completed session. Derived only from the
 * stored timestamps:
 *
 *   deadline = startedAt + max(0, plannedDurationMs − elapsedBeforeMs)
 *
 * The current running segment began at `startedAt` with `elapsedBeforeMs`
 * already banked, so the plan is reached `planned − elapsedBefore` into the
 * segment: a session that ran straight through (`elapsedBeforeMs = 0`) ends
 * exactly `plannedDurationMs` after its start, and a paused session ends at
 * the point in its *current* segment where the banked + segment time added up
 * to the plan. When `elapsedBeforeMs` already meets the plan (a pause that
 * banked time at/over the deadline), the exact earlier instant is not stored,
 * so it clamps to the segment start — the earliest instant consistent with
 * the stored state.
 */
export function completionDeadlineMs(state: FocusState): number {
  const startedAtMs = Date.parse(state.startedAt);
  const remainingToPlanMs = Math.max(
    0,
    state.plannedDurationMs - Math.max(0, state.elapsedBeforeMs),
  );
  return startedAtMs + remainingToPlanMs;
}

/**
 * Re-derives the state at `nowMs` and detects completion.
 *
 * When `elapsedMs >= plannedDurationMs` the result carries the *completed*
 * session exactly once — `actualDurationMs` equals the planned duration (the
 * time past the deadline was sleep, not focus), `endedAt` is the deadline
 * instant from `completionDeadlineMs` (the moment the plan was reached, *not*
 * this tick's clock reading — detecting a session an hour after it finished
 * must not rewrite its history), `startedAt` is kept from the state — and
 * `state` is `null`. Callers clear the persisted row; a subsequent tick over
 * `null` yields no second session, which is what makes completion idempotent.
 */
export function tickTimer(state: FocusState | null, nowMs: number): FocusTickResult {
  if (state === null) return { state: null };
  /* A paused session never auto-completes — the user controls it, even when
     the plan was already banked at pause time. It completes on the first tick
     after resume (or not at all, if it stays paused). */
  if (state.status !== "running") return { state };
  if (elapsedMsOf(state, nowMs) < state.plannedDurationMs) return { state };
  return {
    state: null,
    completedSession: {
      startedAt: state.startedAt,
      endedAt: toInstant(completionDeadlineMs(state)),
      plannedDurationMs: state.plannedDurationMs,
      actualDurationMs: state.plannedDurationMs,
      completed: true,
      taskId: state.taskId,
    },
  };
}

/**
 * Pure snapshot for rendering (Focus page and the Today dashboard's active
 * session card). `null` state (idle) reports zeros; `progress` is clamped to
 * `[0, 1]` while `elapsedMs` reports the raw truth.
 */
export function computeFocusProgress(
  state: FocusState | null,
  nowMs: number,
): FocusProgress {
  if (state === null) return { elapsedMs: 0, remainingMs: 0, progress: 0 };
  const elapsedMs = elapsedMsOf(state, nowMs);
  const remainingMs = Math.max(0, state.plannedDurationMs - elapsedMs);
  const progress =
    state.plannedDurationMs > 0
      ? Math.min(1, Math.max(0, elapsedMs / state.plannedDurationMs))
      : 0;
  return { elapsedMs, remainingMs, progress };
}
