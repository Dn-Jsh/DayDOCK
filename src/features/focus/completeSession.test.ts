/**
 * Focus completion bookkeeping tests (T-014, review finding: the completion
 * flow lived in `FocusPage` and was untested).
 *
 * The shared helper is driven against an in-memory `DayDockData` double, so
 * exactly-once behavior is proven at the same boundary the app uses:
 * dedupe against freshly listed history, create-then-clear ordering, and
 * rejection propagation that leaves the running state in place for Retry.
 */
import { describe, expect, it, vi } from "vitest";
import type {
  DayDockData,
  FocusSession,
  FocusSessionInput,
  FocusState,
} from "../../data/contracts";
import { completeFocusSessionIfDue } from "./completeSession";

const MINUTE = 60_000;
const PLANNED_25_MIN = 25 * MINUTE;
/* Fixed epoch — the helper never reads the clock; `nowMs` is injected. */
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

interface Harness {
  data: DayDockData;
  history: FocusSession[];
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
}

/** In-memory data double: `list` reads the shared history the `create` writes. */
function makeHarness(): Harness {
  const history: FocusSession[] = [];
  let nextId = 1;
  const list = vi.fn(async (): Promise<FocusSession[]> => [...history]);
  const create = vi.fn(async (input: FocusSessionInput): Promise<FocusSession> => {
    const row: FocusSession = {
      id: nextId++,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      plannedDurationMs: input.plannedDurationMs,
      actualDurationMs: input.actualDurationMs,
      completed: input.completed,
      taskId: input.taskId ?? null,
    };
    history.push(row);
    return row;
  });
  const clear = vi.fn(async (): Promise<void> => undefined);
  const data = {
    focusSessions: { list, create },
    focusState: { get: vi.fn(), save: vi.fn(), clear },
  } as unknown as DayDockData;
  return { data, history, list, create, clear };
}

const DUE_MS = T0 + PLANNED_25_MIN + 5 * MINUTE;

describe("completeFocusSessionIfDue", () => {
  it("does nothing before the deadline (no I/O at all)", async () => {
    const harness = makeHarness();
    /* One ms before T0 + planned — genuinely pre-deadline (DUE_MS - 1 is
       already five minutes past it, since DUE_MS is a detection time). */
    const outcome = await completeFocusSessionIfDue(
      harness.data,
      runningState(),
      T0 + PLANNED_25_MIN - 1,
    );
    expect(outcome).toBeNull();
    expect(harness.list).not.toHaveBeenCalled();
    expect(harness.create).not.toHaveBeenCalled();
    expect(harness.clear).not.toHaveBeenCalled();
  });

  it("never completes a paused session, even far past its plan", async () => {
    const harness = makeHarness();
    const paused = runningState({
      status: "paused",
      elapsedBeforeMs: PLANNED_25_MIN,
    });
    const outcome = await completeFocusSessionIfDue(harness.data, paused, DUE_MS);
    expect(outcome).toBeNull();
    expect(harness.create).not.toHaveBeenCalled();
  });

  it("repeated ticks after a completion write exactly once", async () => {
    const harness = makeHarness();
    const state = runningState();

    const first = await completeFocusSessionIfDue(harness.data, state, DUE_MS);
    expect(first?.created).toBe(true);

    /* Later ticks that still hold the stale state (as FocusPage does between
       renders) must find the stored row instead of writing a second one. */
    const second = await completeFocusSessionIfDue(harness.data, state, DUE_MS);
    expect(second?.created).toBe(false);
    const third = await completeFocusSessionIfDue(harness.data, state, DUE_MS + MINUTE);
    expect(third?.created).toBe(false);

    expect(harness.create).toHaveBeenCalledTimes(1);
    expect(harness.history).toHaveLength(1);
    expect(harness.clear).toHaveBeenCalledTimes(3); // idempotent DELETE each time
  });

  it("concurrent callers are serialized: one write, follower gets null", async () => {
    const harness = makeHarness();
    const state = runningState();
    const [leader, follower] = await Promise.all([
      completeFocusSessionIfDue(harness.data, state, DUE_MS),
      completeFocusSessionIfDue(harness.data, state, DUE_MS),
    ]);
    expect(leader?.created).toBe(true);
    expect(follower).toBeNull();
    expect(harness.create).toHaveBeenCalledTimes(1);
    expect(harness.history).toHaveLength(1);
  });

  it("crash window: create succeeds, clear fails → retry re-completes without a duplicate", async () => {
    const harness = makeHarness();
    const state = runningState();
    harness.clear
      .mockRejectedValueOnce(new Error("write failed"))
      .mockResolvedValue(undefined);

    await expect(completeFocusSessionIfDue(harness.data, state, DUE_MS)).rejects.toThrow(
      "write failed",
    );
    /* The history row was already written; only the state clear failed. */
    expect(harness.history).toHaveLength(1);
    expect(harness.create).toHaveBeenCalledTimes(1);

    const retry = await completeFocusSessionIfDue(harness.data, state, DUE_MS);
    expect(retry).not.toBeNull();
    expect(retry?.created).toBe(false); // found the existing row — no duplicate
    expect(harness.create).toHaveBeenCalledTimes(1);
    expect(harness.history).toHaveLength(1);
    expect(harness.clear).toHaveBeenCalledTimes(2);
  });

  it("failed create keeps the running state so Retry can finish later", async () => {
    const harness = makeHarness();
    const state = runningState();
    harness.create.mockRejectedValueOnce(new Error("insert failed"));

    await expect(completeFocusSessionIfDue(harness.data, state, DUE_MS)).rejects.toThrow(
      "insert failed",
    );
    /* State untouched: nothing cleared the running session, so Retry — or the
       next tick, or the watcher — gets another chance. */
    expect(harness.clear).not.toHaveBeenCalled();
    expect(harness.history).toHaveLength(0);

    const retry = await completeFocusSessionIfDue(harness.data, state, DUE_MS);
    expect(retry?.created).toBe(true);
    expect(harness.clear).toHaveBeenCalledTimes(1);
    expect(harness.history).toHaveLength(1);
  });

  it("writes endedAt at the deadline instant, not at detection time", async () => {
    const harness = makeHarness();
    /* Detected an hour late (system slept past the deadline). */
    await completeFocusSessionIfDue(harness.data, runningState(), DUE_MS + 60 * MINUTE);

    const input = harness.create.mock.calls[0][0] as FocusSessionInput;
    expect(input).toMatchObject({
      startedAt: iso(T0),
      endedAt: iso(T0 + PLANNED_25_MIN),
      plannedDurationMs: PLANNED_25_MIN,
      actualDurationMs: PLANNED_25_MIN,
      completed: true,
    });
    expect(harness.history[0].endedAt).toBe(iso(T0 + PLANNED_25_MIN));
  });

  it("derives the deadline across a pause: start + banked time + running segment", async () => {
    const harness = makeHarness();
    /* Banked 10 minutes, resumed at T0 + 40 → plan reached at T0 + 55. */
    const state = runningState({
      startedAt: iso(T0 + 40 * MINUTE),
      elapsedBeforeMs: 10 * MINUTE,
    });
    await completeFocusSessionIfDue(harness.data, state, T0 + 62 * MINUTE);

    const input = harness.create.mock.calls[0][0] as FocusSessionInput;
    expect(input.endedAt).toBe(iso(T0 + 55 * MINUTE));
    expect(input.actualDurationMs).toBe(PLANNED_25_MIN);
  });
});
