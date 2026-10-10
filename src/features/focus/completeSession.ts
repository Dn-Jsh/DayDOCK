/**
 * App-global focus-session completion (T-014).
 *
 * The single implementation of "deadline reached → write the history row →
 * clear the running state", shared by `FocusPage` (live UI + error surface)
 * and `<FocusCompletionWatcher />` (the app-global safety net). A session
 * whose deadline passes on any page — or while the app is closed — is
 * persisted exactly once, with `endedAt` at the deadline instant.
 *
 * Exactly-once rules:
 *
 * 1. **Serialization.** The first call for a due session *leads* the write;
 *   concurrent calls get `null` ("another caller is handling it") until the
 *   attempt settles, so FocusPage's 500 ms clock and the watcher's interval
 *   can never run `create` in parallel.
 * 2. **Dedupe against storage, not memory.** The leader re-reads history and
 *   matches `startedAt + plannedDurationMs` before creating. A crash (or a
 *   failed `focusState.clear()`) after the row was written therefore
 *   re-completes on the next attempt — in this run or after a restart —
 *   by finding the existing row instead of writing a second one.
 * 3. **Order.** `create` first, `clear` second; the state is cleared only
 *   after the history row exists. A failed `create` leaves `focus_state`
 *   untouched, so Retry (or the next tick) finishes the job.
 */
import type { DayDockData, FocusSession, FocusState } from "../../data/contracts";
import { tickTimer } from "./timer";

/** Result of a completion attempt that this call performed. */
export interface FocusCompletionOutcome {
  /** The stored history row — created by this call, or found already present. */
  session: FocusSession;
  /** `true` when this call created the row; `false` on a crash-window retry. */
  created: boolean;
}

/**
 * The attempt currently in flight, if any. Module-scoped on purpose: FocusPage
 * and the app-global watcher are separate components that must share one gate.
 */
let completionInFlight: Promise<FocusCompletionOutcome> | null = null;

/**
 * Completes `state` when its deadline has passed at `nowMs`.
 *
 * Returns the outcome when *this* call performed the completion, or `null`
 * when there is nothing for the caller to do: the session is not due yet, is
 * paused (a paused session never auto-completes — the user controls it), or
 * another caller is already writing this completion. Rejects when the attempt
 * failed; `focus_state` is then still stored, so a retry can finish it.
 */
export async function completeFocusSessionIfDue(
  data: DayDockData,
  state: FocusState,
  nowMs: number,
): Promise<FocusCompletionOutcome | null> {
  const detected = tickTimer(state, nowMs);
  if (detected.completedSession === undefined) return null;
  /* Another caller is mid-write for this same completion; it owns the result. */
  if (completionInFlight !== null) return null;

  const completed = detected.completedSession;
  completionInFlight = (async (): Promise<FocusCompletionOutcome> => {
    try {
      /* Fresh read: the dedupe must see rows written before a crash, not just
         whatever the calling component happens to have in memory. */
      const history = await data.focusSessions.list();
      const existing = history.find(
        (row) =>
          row.startedAt === completed.startedAt &&
          row.plannedDurationMs === completed.plannedDurationMs,
      );
      const stored = existing ?? (await data.focusSessions.create(completed));
      /* Idempotent: a retry after a failed clear re-runs this safely. */
      await data.focusState.clear();
      return { session: stored, created: existing === undefined };
    } finally {
      /* Success or failure: release the gate so the next call re-attempts. */
      completionInFlight = null;
    }
  })();
  return completionInFlight;
}
