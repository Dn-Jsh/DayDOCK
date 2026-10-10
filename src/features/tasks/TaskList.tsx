import { useEffect, useRef, useState } from "react";
import { Pencil, SquareCheckBig, Trash2 } from "lucide-react";
import { useData } from "../../app/DataProvider";
import type { ProjectWithProgress, Task } from "../../data/contracts";
import { todayLocalDate } from "../../lib/date";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { EmptyState } from "../../components/ui/empty-state";
import { cn } from "../../components/ui/cn";
import { TaskDialog } from "./TaskDialog";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import { describeDueDate } from "./taskHelpers";

export interface TaskListProps {
  tasks: Task[];
  /** Called after any successful mutation so the parent can refetch. */
  onChanged: () => void;
  /** Show each task's project name. Off by default. */
  showProject?: boolean;
  /** Show the due date (including the overdue marker). On by default. */
  showDueDate?: boolean;
  /** Copy for the empty panel when `tasks` is empty. */
  emptyMessage?: string;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "The operation failed.";
}

/**
 * The task rows: complete/reopen checkbox, title, due date (with overdue
 * marker), priority badge, optional project name, plus the edit dialog and
 * delete confirmation this component owns end to end. Every control is a real
 * focusable element, icon-only buttons carry the task title in their
 * `aria-label`, and `onChanged()` fires after each successful mutation so the
 * owning page refetches from SQLite.
 */
export function TaskList({
  tasks,
  onChanged,
  showProject = false,
  showDueDate = true,
  emptyMessage,
}: TaskListProps) {
  const data = useData();
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const projectsRef = useRef<ProjectWithProgress[] | null>(null);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* Projects are needed twice: to render `showProject` names and to populate
     the edit dialog. Loaded once, then retried on demand if the first try
     failed (the retry error is reported when the user opens the dialog). */
  const ensureProjects = async (): Promise<ProjectWithProgress[]> => {
    if (projectsRef.current !== null) {
      return projectsRef.current;
    }
    const rows = await data.projects.list();
    projectsRef.current = rows;
    setProjects(rows);
    return rows;
  };

  useEffect(() => {
    /* Once per mount; a failure is retried (and reported) when the user
       opens the edit dialog, so an empty list is never an error here. */
    void ensureProjects().catch(() => undefined);
  }, []);

  const setBusy = (id: number, busy: boolean): void => {
    setBusyIds((current) =>
      busy ? [...current, id] : current.filter((busyId) => busyId !== id),
    );
  };

  const handleToggle = async (task: Task): Promise<void> => {
    const next = task.status === "completed" ? "pending" : "completed";
    setBusy(task.id, true);
    setError(null);
    try {
      await data.tasks.setStatus(task.id, next);
      onChanged();
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(task.id, false);
    }
  };

  const handleEdit = async (task: Task): Promise<void> => {
    setError(null);
    try {
      await ensureProjects();
      setEditing(task);
      setDialogOpen(true);
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  };

  /* Runs inside ConfirmDialog: on success the dialog closes itself; on
     failure we record the message here so the banner (role="alert") shows it
     once the dialog closes. Nothing the user typed exists on this path. */
  const handleDelete = async (): Promise<void> => {
    if (deleting === null) return;
    try {
      await data.tasks.remove(deleting.id);
      onChanged();
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  };

  const today = todayLocalDate();
  const projectName = (task: Task): string | null => {
    if (task.projectId === null) return null;
    return projects.find((project) => project.id === task.projectId)?.name ?? null;
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p
          role="alert"
          className="border border-border bg-card px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {tasks.length === 0 ? (
        <EmptyState icon={SquareCheckBig} title={emptyMessage ?? "No tasks yet"} />
      ) : (
        <ul className="border border-border bg-card">
          {tasks.map((task) => {
            const busy = busyIds.includes(task.id);
            const completed = task.status === "completed";
            const due = showDueDate ? describeDueDate(task.dueDate, task.status, today) : null;
            const project = showProject ? projectName(task) : null;

            return (
              <li
                key={task.id}
                className="flex items-start gap-3 border-b border-border px-3 py-2.5 transition-colors duration-150 last:border-b-0 hover:bg-secondary/60"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={completed}
                  disabled={busy}
                  aria-label={
                    completed
                      ? `Reopen "${task.title}"`
                      : `Mark "${task.title}" as complete`
                  }
                  onChange={() => void handleToggle(task)}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={cn(
                        "text-sm [overflow-wrap:anywhere]",
                        completed ? "text-muted-foreground line-through" : "text-foreground",
                      )}
                    >
                      {task.title}
                    </span>
                    <TaskPriorityBadge priority={task.priority} />
                    {project !== null ? (
                      <Badge variant="outline">{project}</Badge>
                    ) : null}
                  </div>

                  {task.description !== "" ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}

                  {due !== null && task.dueDate !== null ? (
                    <time
                      dateTime={task.dueDate}
                      className={cn(
                        "mt-1 block text-xs",
                        due.isOverdue ? "font-medium text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {due.text}
                    </time>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit "${task.title}"`}
                    disabled={busy}
                    onClick={() => void handleEdit(task)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    aria-label={`Delete "${task.title}"`}
                    disabled={busy}
                    onClick={() => {
                      setDeleting(task);
                      setConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        projects={projects}
        onSaved={() => onChanged()}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={deleting ? `Delete "${deleting.title}"?` : "Delete task?"}
        description={
          deleting
            ? `The task "${deleting.title}" will be permanently deleted from this device, including its description, due date and project assignment. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete task"
        onConfirm={handleDelete}
      />
    </div>
  );
}
