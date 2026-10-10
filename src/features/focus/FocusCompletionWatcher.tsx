import { useEffect } from "react";
import { useData } from "../../app/DataProvider";
import { completeFocusSessionIfDue } from "./completeSession";

/**
 * App-global completion watcher (T-014, review finding: focus completion is
 * not app-global). Mount ONCE inside `DataProvider` — children of the
 * provider only render after the data layer loads, which is exactly the
 * "run once after the data layer loads" trigger:
 *
 *   <DataProvider>
 *     <FocusCompletionWatcher />
 *     …
 *
 * On every trigger it reads the stored running state and hands it to the
 * shared `completeFocusSessionIfDue` helper, so a deadline that passes while
 * the user is on another page (or before the Focus page ever mounts) writes
 * its history row exactly once and clears `focus_state` — the Today card's
 * phantom "running" session disappears with it. Triggers: mount, `hashchange`
 * (navigation), window `focus` (wake from sleep/blur) and a modest interval.
 */
const COMPLETION_POLL_MS = 1_000;

/**
 * Dispatched on `window` after this watcher successfully completes a session.
 * Pages that cache `focus_state` (the Today dashboard) can listen for it to
 * re-read in real time instead of showing a stale card until their next
 * reload. Safe to ignore: no listener means nothing more than the old
 * refresh behavior.
 */
export const FOCUS_COMPLETION_EVENT = "daydock:focus-session-completed";

/** Renders nothing; owns only the completion triggers described above. */
export function FocusCompletionWatcher() {
  const data = useData();

  useEffect(() => {
    let disposed = false;

    const runCompletionCheck = async (): Promise<void> => {
      try {
        const state = await data.focusState.get();
        if (disposed || state === null) return;
        const outcome = await completeFocusSessionIfDue(data, state, Date.now());
        if (disposed || outcome === null) return;
        window.dispatchEvent(new CustomEvent(FOCUS_COMPLETION_EVENT));
      } catch {
        /* Deliberately silent: a failed attempt leaves `focus_state` stored,
           so the next trigger retries; when the Focus page is open it shows
           its own Retry UI. Never log driver errors (safe messages only). */
      }
    };

    void runCompletionCheck();
    const handleTrigger = () => void runCompletionCheck();
    window.addEventListener("hashchange", handleTrigger);
    window.addEventListener("focus", handleTrigger);
    const intervalId = window.setInterval(handleTrigger, COMPLETION_POLL_MS);

    return () => {
      disposed = true;
      window.removeEventListener("hashchange", handleTrigger);
      window.removeEventListener("focus", handleTrigger);
      window.clearInterval(intervalId);
    };
  }, [data]);

  return null;
}
