import { Pencil, Trash2 } from "lucide-react";
import type { ProjectWithProgress } from "../../data/contracts";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import { cn } from "../../components/ui/cn";
import { describeCreatedAt, formatTaskCount } from "./projectHelpers";

export interface ProjectCardProps {
  project: ProjectWithProgress;
  /** Opens the project's detail view. */
  onOpen: (project: ProjectWithProgress) => void;
  onRename: (project: ProjectWithProgress) => void;
  onDelete: (project: ProjectWithProgress) => void;
}

/**
 * One project in the list: name, "8/12 tasks" count, a thin labelled progress
 * bar and the created date.
 *
 * The whole card is clickable via a transparent open target stretched over the
 * `<li>`; the visible content sits above it with pointer events passed
 * through. That keeps the count/progress/date readable as ordinary text (they
 * are not swallowed by a button label) and avoids nesting a `<div>`-based
 * progress bar inside a `<button>`. Rename/delete are separate icon-only
 * buttons — each carrying the project name in its `aria-label` — so no
 * interactive control is ever nested inside another.
 */
export function ProjectCard({ project, onOpen, onRename, onDelete }: ProjectCardProps) {
  const created = describeCreatedAt(project.createdAt);

  return (
    <li className="relative flex flex-col border border-border bg-card">
      {/* Full-card open target: transparent, keyboard focusable, focus ring
          comes from the global `:focus-visible` rule. */}
      <button
        type="button"
        onClick={() => onOpen(project)}
        aria-label={`Open project "${project.name}"`}
        className={cn(
          "absolute inset-0 z-10 cursor-pointer rounded-none",
          "transition-colors duration-150 hover:bg-secondary/60",
        )}
      />

      <div className="pointer-events-none relative z-20 flex flex-1 flex-col gap-2 px-3 py-3">
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {project.name}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatTaskCount(project.completedCount, project.taskCount)}
          </span>
        </span>

        <Progress
          value={project.completedCount}
          max={project.taskCount}
          label={`${project.name} progress`}
        />

        <span className="text-xs text-muted-foreground">
          Created <time dateTime={created.iso ?? undefined}>{created.label}</time>
        </span>
      </div>

      <div className="relative z-20 flex items-center justify-end gap-1 border-t border-border px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Rename "${project.name}"`}
          onClick={() => onRename(project)}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          variant="destructive"
          size="sm"
          aria-label={`Delete "${project.name}"`}
          onClick={() => onDelete(project)}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
