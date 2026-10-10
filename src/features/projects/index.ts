/**
 * Public surface of the projects feature (T-005).
 *
 * `ProjectsPage` stays the default export of `ProjectsPage.tsx` — the router
 * imports that file directly. The pure helpers are exported too so tests and
 * other tickets can consume them without reaching into internals.
 */
export { default, default as ProjectsPage } from "./ProjectsPage";
export { ProjectCard, type ProjectCardProps } from "./ProjectCard";
export { ProjectDialog, type ProjectDialogProps } from "./ProjectDialog";
export {
  describeCreatedAt,
  formatProjectCount,
  formatTaskCount,
  projectPercent,
  summarizeProjectTasks,
  toErrorMessage,
  type CreatedDateInfo,
  type ProjectProgressSummary,
} from "./projectHelpers";
