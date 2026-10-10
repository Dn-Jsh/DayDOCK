import { describe, expect, it } from "vitest";
import type { FocusState } from "../../data/contracts";
import {
  computeFocusProgress,
  elapsedMsOf,
  pauseTimer,
  remainingMsOf,
  resetTimer,
  resumeTimer,
  startTimer,
  tickTimer,
} from "./timer";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const PLANNED_25_MIN = 25 * MINUTE;

/* Fixed epoch — the model never reads the clock, so every test drives `now`. */
const T0 = Date.UTC(2026, 9, 10, 9, 0, 0);

function iso(nowMs: number): string {
  return new Date(nowMs).toISOString();
}

function runningState(overrides: Partial<FocusState> = {}): FocusState {
  return {
    status: "running",
    startedAt: iso(T0),
    elapsedBeforeMs: 0,
    plannedDurationMs: PLANNED_25_MIN,
    taskId: null,
    ...overrides,
  };
}

describe("startTimer", () => {
  it("creates a running state with zero elapsed time and the planned duration", () => {
    expect(startTimer(T0, PLANNED_25_MIN, 42)).toEqual({
      status: "running",
      startedAt: iso(T0),
      elapsedBeforeMs: 0,
      plannedDurationMs: PLANNED_25_MIN,
      taskId: 42,
    });
  });

  it("accepts a null task id (session not linked to a task)", () => {
    expect(startTimer(T0, 5 * MINUTE, null).taskId).toBeNull();
    expect(startTimer(T0, 5 * MINUTE, null).plannedDurationMs).toBe(5 * MINUTE);
  });
});

describe("elapsed time from the wall clock", () => {
  it("grows with now − startedAt while running", () => {
    const state = runningState();
    expect(elapsedMsOf(state, T0)).toBe(0);
    expect(elapsedMsOf(state, T0 + 10 * MINUTE)).toBe(10 * MINUTE);
    expect(remainingMsOf(state, T0 + 10 * MINUTE)).toBe(15 * MINUTE);
  });

  it("stays frozen while paused no matter how far the clock advances", () => {
    const paused = pauseTimer(runningState(), T0 + 5 * MINUTE);
    expect(elapsedMsOf(paused, T0 + 5 * MINUTE)).toBe(5 * MINUTE);
    expect(elapsedMsOf(paused, T0 + 55 * MINUTE)).toBe(5 * MINUTE);
    expect(remainingMsOf(paused, T0 + 55 * MINUTE)).toBe(20 * MINUTE);
  });

  it("never goes negative when the clock reads earlier than startedAt (skew)", () => {
    const state = runningState({ startedAt: iso(T0 + 30_000) });
    expect(elapsedMsOf(state, T0)).toBe(0);
    expect(remainingMsOf(state, T0)).toBe(PLANNED_25_MIN);
  });

  it("does not let a backwards clock jump eat earlier accumulated time", () => {
    const state = runningState({ elapsedBeforeMs: 10 * MINUTE, startedAt: iso(T0) });
    /* Clock jumps 5 minutes backwards mid-run: segment clamps at 0, not −5. */
    expect(elapsedMsOf(state, T0 - 5 * MINUTE)).toBe(10 * MINUTE);
  });
});

describe("pause / resume", () => {
  it("pause freezes the elapsed time into elapsedBeforeMs", () => {
    const paused = pauseTimer(runningState(), T0 + 5 * MINUTE);
    expect(paused).toEqual({
      status: "paused",
      startedAt: iso(T0),
      elapsedBeforeMs: 5 * MINUTE,
      plannedDurationMs: PLANNED_25_MIN,
      taskId: null,
    });
  });

  it("pause on an already paused state is a no-op", () => {
    const paused = pauseTimer(runningState(), T0 + 5 * MINUTE);
    expect(pauseTimer(paused, T0 + 9 * MINUTE)).toBe(paused);
  });

  it("resume re-anchors startedAt to now and keeps the frozen elapsed time", () => {
    const paused = pauseTimer(runningState(), T0 + 5 * MINUTE);
    const resumed = resumeTimer(paused, T0 + 7 * MINUTE);
    expect(resumed).toEqual({
      status: "running",
      startedAt: iso(T0 + 7 * MINUTE),
      elapsedBeforeMs: 5 * MINUTE,
      plannedDurationMs: PLANNED_25_MIN,
      taskId: null,
    });
    expect(elapsedMsOf(resumed, T0 + 8 * MINUTE)).toBe(6 * MINUTE);
  });

  it("resume on an already running state is a no-op (would drop the segment)", () => {
    const state = runningState();
    expect(resumeTimer(state, T0 + 9 * MINUTE)).toBe(state);
  });

  it("start → tick → pause → resume keeps the remaining time consistent", () => {
    const started = startTimer(T0, PLANNED_25_MIN, null);
    const afterTenMinutes = tickTimer(started, T0 + 10 * MINUTE);
    expect(afterTenMinutes.completedSession).toBeUndefined();
    expect(afterTenMinutes.state).toBe(started);

    const paused = pauseTimer(started, T0 + 10 * MINUTE);
    expect(remainingMsOf(paused, T0 + 40 * MINUTE)).toBe(15 * MINUTE);

    const resumed = resumeTimer(paused, T0 + 41 * MINUTE);
    expect(remainingMsOf(resumed, T0 + 41 * MINUTE)).toBe(15 * MINUTE);
    expect(remainingMsOf(resumed, T0 + 56 * MINUTE)).toBe(0);
  });
});

describe("tickTimer", () => {
  it("returns the unchanged state and no session before the deadline", () => {
    const state = runningState();
    const result = tickTimer(state, T0 + 24 * MINUTE + 59_000);
    expect(result.state).toBe(state);
    expect(result.completedSession).toBeUndefined();
  });

  it("completes exactly at the deadline boundary", () => {
    const state = runningState();
    const result = tickTimer(state, T0 + PLANNED_25_MIN);
    expect(result.state).toBeNull();
    expect(result.completedSession).toEqual({
      startedAt: iso(T0),
      endedAt: iso(T0 + PLANNED_25_MIN),
      plannedDurationMs: PLANNED_25_MIN,
      actualDurationMs: PLANNED_25_MIN,
      completed: true,
      taskId: null,
    });
  });

  it("completes exactly once when the clock jumps an hour past the deadline (system sleep)", () => {
    const state = runningState({ taskId: 7 });
    const sleptTo = T0 + PLANNED_25_MIN + HOUR;
    const result = tickTimer(state, sleptTo);
    expect(result.state).toBeNull();
    expect(result.completedSession).toBeDefined();
    /* The extra hour was sleep, not focus: the plan is what was actually run. */
    expect(result.completedSession?.actualDurationMs).toBe(PLANNED_25_MIN);
    expect(result.completedSession?.plannedDurationMs).toBe(PLANNED_25_MIN);
    /* endedAt is the deadline instant (start + plan), NOT this tick's clock
       reading — detecting the completion an hour late must not rewrite
       history (T-014 review finding). */
    expect(result.completedSession?.endedAt).toBe(iso(T0 + PLANNED_25_MIN));
    expect(result.completedSession?.startedAt).toBe(iso(T0));
    expect(result.completedSession?.completed).toBe(true);
    expect(result.completedSession?.taskId).toBe(7);

    /* Idempotent: the follow-up tick runs over the cleared (null) state. */
    const second = tickTimer(result.state, sleptTo + HOUR);
    expect(second.state).toBeNull();
    expect(second.completedSession).toBeUndefined();
  });

  it("derives endedAt from the stored segments when pauses shifted the deadline", () => {
    /* Start T0, pause after 10 minutes, resume at T0 + 40: the remaining
       15 minutes run out at T0 + 55, no matter when the tick notices. */
    const state = runningState({
      startedAt: iso(T0 + 40 * MINUTE),
      elapsedBeforeMs: 10 * MINUTE,
    });
    const result = tickTimer(state, T0 + 62 * MINUTE);
    expect(result.completedSession?.endedAt).toBe(iso(T0 + 55 * MINUTE));
    expect(result.completedSession?.actualDurationMs).toBe(PLANNED_25_MIN);
  });

  it("clamps endedAt to the segment start when the plan was already banked", () => {
    /* Pause banked exactly the plan: the true deadline was inside an earlier
       segment and is not stored, so the segment start is the earliest
       instant consistent with the state (documented in completionDeadlineMs). */
    const state = runningState({
      startedAt: iso(T0 + 30 * MINUTE),
      elapsedBeforeMs: PLANNED_25_MIN,
    });
    const result = tickTimer(state, T0 + 31 * MINUTE);
    expect(result.completedSession?.endedAt).toBe(iso(T0 + 30 * MINUTE));
  });

  it("never completes a paused session, even far past the deadline", () => {
    const paused = pauseTimer(runningState(), T0 + 20 * MINUTE);
    const result = tickTimer(paused, T0 + 10 * HOUR);
    expect(result.state).toBe(paused);
    expect(result.completedSession).toBeUndefined();

    /* Even when the pause banked the entire plan (paused right at/after the
       deadline), the paused state must not complete until it resumes. */
    const banked = runningState({ status: "paused", elapsedBeforeMs: PLANNED_25_MIN });
    const bankedResult = tickTimer(banked, T0 + 10 * HOUR);
    expect(bankedResult.state).toBe(banked);
    expect(bankedResult.completedSession).toBeUndefined();
  });

  it("tick over a null state stays null and yields no session", () => {
    expect(tickTimer(null, T0 + HOUR)).toEqual({ state: null });
  });
});

describe("resetTimer", () => {
  it("returns null — the state is cleared and no history row is written", () => {
    expect(resetTimer(runningState())).toBeNull();
    expect(resetTimer(null)).toBeNull();
  });
});

describe("computeFocusProgress", () => {
  it("reports zeros for no active session", () => {
    expect(computeFocusProgress(null, T0)).toEqual({
      elapsedMs: 0,
      remainingMs: 0,
      progress: 0,
    });
  });

  it("computes elapsed, remaining and the 0–1 progress fraction while running", () => {
    const snapshot = computeFocusProgress(runningState(), T0 + 10 * MINUTE);
    expect(snapshot.elapsedMs).toBe(10 * MINUTE);
    expect(snapshot.remainingMs).toBe(15 * MINUTE);
    expect(snapshot.progress).toBeCloseTo(10 / 25, 10);
  });

  it("uses only elapsedBeforeMs while paused", () => {
    const paused = pauseTimer(runningState(), T0 + 5 * MINUTE);
    const snapshot = computeFocusProgress(paused, T0 + 3 * HOUR);
    expect(snapshot.elapsedMs).toBe(5 * MINUTE);
    expect(snapshot.remainingMs).toBe(20 * MINUTE);
    expect(snapshot.progress).toBeCloseTo(5 / 25, 10);
  });

  it("clamps remaining at 0 and progress at 1 when past the plan", () => {
    const snapshot = computeFocusProgress(runningState(), T0 + 30 * MINUTE);
    expect(snapshot.elapsedMs).toBe(30 * MINUTE); /* raw truth, unclamped */
    expect(snapshot.remainingMs).toBe(0);
    expect(snapshot.progress).toBe(1);
  });

  it("clamps a negative (clock-skewed) reading at zero", () => {
    const state = runningState({ startedAt: iso(T0 + HOUR) });
    const snapshot = computeFocusProgress(state, T0);
    expect(snapshot.elapsedMs).toBe(0);
    expect(snapshot.remainingMs).toBe(PLANNED_25_MIN);
    expect(snapshot.progress).toBe(0);
  });
});
