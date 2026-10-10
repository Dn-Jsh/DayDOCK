/**
 * Public surface of the focus feature (T-008).
 *
 * `FocusPage` stays the default export of `FocusPage.tsx` — the router imports
 * that file directly and the name is a route contract. `computeFocusProgress`
 * is consumed by the Today dashboard (T-006) to render the active session, so
 * its name and shape must not change. The pure timing rules are exported too
 * so tests and other tickets can use them without reaching into internals.
 */
export { default, default as FocusPage } from "./FocusPage";
export { FocusTimerPanel, type FocusTimerPanelProps, type FocusTimerStatus } from "./FocusTimerPanel";
export { FocusSessionList, type FocusSessionListProps } from "./FocusSessionList";
export {
  computeFocusProgress,
  elapsedMsOf,
  remainingMsOf,
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  tickTimer,
  type FocusProgress,
  type FocusTickResult,
} from "./timer";
export { formatSessionStart, sessionDayLabel } from "./sessionTime";
