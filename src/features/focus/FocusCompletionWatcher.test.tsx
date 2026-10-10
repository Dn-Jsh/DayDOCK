/**
 * App-global completion watcher tests (T-014).
 *
 * Verifies the mechanism behind "completion is app-global": the watcher runs
 * the shared helper once on mount (i.e. right after the data layer loads),
 * again on `hashchange`, on window `focus`, and on its interval — writing a
 * due session exactly once and announcing it through `FOCUS_COMPLETION_EVENT`
 * so pages holding cached `focus_state` (the Today card) can refresh.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayDockData, FocusSession, FocusSessionInput, FocusState } from "../../data/contracts";
import { FOCUS_COMPLETION_EVENT, FocusCompletionWatcher } from "./FocusCompletionWatcher";

/** Supply the data aggregate through the (mocked) `useData` hook. */
const dataHolder = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("../../app/DataProvider", () => ({
  useData: () => dataHolder.current,
}));

const MINUTE = 60_000;
const PLANNED_25_MIN = 25 * MINUTE;
/**
 * Wall-clock anchored: the watcher reads the real `Date.now()`, so the
 * session must genuinely be past its deadline whenever the suite runs —
 * started one hour ago, plan reached 35 minutes ago.
 */
const T0 = Date.now() - 60 * MINUTE;

function iso(nowMs: number): string {
  return new Date(nowMs).toISOString();
}

/** Due running session: its plan ended long before "now". */
function dueState(): FocusState {
  return {
    status: "running",
    startedAt: iso(T0),
    elapsedBeforeMs: 0,
    plannedDurationMs: PLANNED_25_MIN,
    taskId: null,
  };
}

interface Harness {
  data: DayDockData;
  getState: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  history: FocusSession[];
}

function makeHarness(state: FocusState | null): Harness {
  const history: FocusSession[] = [];
  let nextId = 1;
  const getState = vi.fn(async () => state);
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
    focusState: { get: getState, save: vi.fn(), clear },
    focusSessions: { list, create },
  } as unknown as DayDockData;
  dataHolder.current = data;
  return { data, getState, list, create, clear, history };
}

/** Lets the async trigger chains (get → list → create → clear) settle. */
async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  /* Only the watcher's interval is faked; `Date.now` must stay real. */
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("FocusCompletionWatcher", () => {
  it("runs once on mount, completes a due session, and dispatches the event", async () => {
    const harness = makeHarness(dueState());
    const received = vi.fn();
    window.addEventListener(FOCUS_COMPLETION_EVENT, received);

    render(<FocusCompletionWatcher />);
    await flush();

    expect(harness.getState).toHaveBeenCalledTimes(1);
    expect(harness.create).toHaveBeenCalledTimes(1);
    expect(harness.clear).toHaveBeenCalledTimes(1);
    expect(harness.history).toHaveLength(1);
    expect(received).toHaveBeenCalledTimes(1);

    window.removeEventListener(FOCUS_COMPLETION_EVENT, received);
  });

  it("records the deadline instant even when detected long after it passed", async () => {
    const harness = makeHarness(dueState());
    render(<FocusCompletionWatcher />);
    await flush();

    const input = harness.create.mock.calls[0][0] as FocusSessionInput;
    expect(input.endedAt).toBe(iso(T0 + PLANNED_25_MIN));
    expect(input.actualDurationMs).toBe(PLANNED_25_MIN);
  });

  it("re-checks on hashchange and window focus without writing a second row", async () => {
    const harness = makeHarness(dueState());
    render(<FocusCompletionWatcher />);
    await flush();
    expect(harness.create).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent(window, new Event("hashchange"));
    });
    await flush();
    await act(async () => {
      fireEvent(window, new Event("focus"));
    });
    await flush();

    expect(harness.getState).toHaveBeenCalledTimes(3);
    expect(harness.create).toHaveBeenCalledTimes(1); // deduped against history
    expect(harness.history).toHaveLength(1);
  });

  it("keeps polling on its interval", async () => {
    const harness = makeHarness(dueState());
    render(<FocusCompletionWatcher />);
    await flush();
    expect(harness.getState).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await flush();

    expect(harness.getState).toHaveBeenCalledTimes(2);
    expect(harness.create).toHaveBeenCalledTimes(1);
  });

  it("leaves a session that is not due untouched and dispatches nothing", async () => {
    const harness = makeHarness(null);
    const received = vi.fn();
    window.addEventListener(FOCUS_COMPLETION_EVENT, received);

    render(<FocusCompletionWatcher />);
    await flush();

    expect(harness.getState).toHaveBeenCalledTimes(1);
    expect(harness.create).not.toHaveBeenCalled();
    expect(harness.clear).not.toHaveBeenCalled();
    expect(received).not.toHaveBeenCalled();

    window.removeEventListener(FOCUS_COMPLETION_EVENT, received);
  });

  it("a failed write is retried on the next trigger instead of being cached", async () => {
    const harness = makeHarness(dueState());
    harness.create.mockRejectedValueOnce(new Error("write failed"));

    render(<FocusCompletionWatcher />);
    await flush();
    expect(harness.create).toHaveBeenCalledTimes(1);
    expect(harness.clear).not.toHaveBeenCalled(); // state kept for retry

    await act(async () => {
      fireEvent(window, new Event("focus"));
    });
    await flush();

    expect(harness.create).toHaveBeenCalledTimes(2);
    expect(harness.clear).toHaveBeenCalledTimes(1);
    expect(harness.history).toHaveLength(1);
  });
});
