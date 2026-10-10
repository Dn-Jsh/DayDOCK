/**
 * Public surface of the Today dashboard (T-006).
 *
 * `TodayPage` stays the default export of `TodayPage.tsx` — the router
 * imports that file directly and the name is a route contract. The selectors
 * are exported so other tickets and tests can reuse the dashboard's
 * classification rules without reaching into components.
 */
export { default, default as TodayPage } from "./TodayPage";
export {
  formatLongDate,
  pluralizeCount,
  selectCompletedToday,
  selectDueToday,
  selectOverdue,
  selectPriorityTasks,
} from "./dashboardModel";
export { QuickAddTask, type QuickAddTaskProps } from "./QuickAddTask";
export { StatTile, type StatTileProps } from "./StatTile";
export { FocusSessionCard, type FocusSessionCardProps } from "./FocusSessionCard";
