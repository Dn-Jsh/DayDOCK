/**
 * Public surface of the tasks feature (T-004).
 *
 * Other feature tickets (project view, Today dashboard) consume these
 * exports — the names are a contract and must not be renamed.
 */
export { TaskList, type TaskListProps } from "./TaskList";
export { TaskFilters, type TaskFiltersProps } from "./TaskFilters";
export { TaskDialog, type TaskDialogProps } from "./TaskDialog";
export { TaskPriorityBadge, type TaskPriorityBadgeProps } from "./TaskPriorityBadge";
