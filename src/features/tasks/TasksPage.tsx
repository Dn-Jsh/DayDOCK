import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search, SquareCheckBig } from "lucide-react";
import { useData } from "../../app/DataProvider";
import type { ProjectWithProgress, Task, TaskFilter } from "../../data/contracts";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { ErrorState } from "../../components/ui/error-state";
import { LoadingState } from "../../components/ui/loading-state";
import { TaskDialog } from "./TaskDialog";
import { TaskFilters } from "./TaskFilters";
import { TaskList } from "./TaskList";
import { defaultTaskFilter, formatResultCount } from "./taskHelpers";

type Phase = "loading" | "ready" | "error";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "The local task list could not be loaded.";
}

/**
 * The Tasks page (T-004). Owns the filter state and the single refetch
 * routine: every list request runs `data.tasks.list(filter)` (SQL lives in
 * the repository) plus the unfiltered total for the "12 of 40 tasks" count.
 * A request id guards against stale responses, so only the newest query can
 * update the screen — no flicker, no spinner left hanging.
 */
export default function TasksPage() {
  const data = useData();
  const [filter, setFilter] = useState<TaskFilter>(() => defaultTaskFilter());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  const load = useCallback(
    async (currentFilter: TaskFilter): Promise<void> => {
      const requestId = (requestRef.current += 1);
      setPending(true);
      try {
        const [allTasks, filteredTasks, projectRows] = await Promise.all([
          data.tasks.list(),
          data.tasks.list(currentFilter),
          data.projects.list(),
        ]);
        if (!mountedRef.current || requestId !== requestRef.current) return;
        setTasks(filteredTasks);
        setTotal(allTasks.length);
        setProjects(projectRows);
        setError(null);
        setPhase("ready");
      } catch (caught) {
        if (!mountedRef.current || requestId !== requestRef.current) return;
        setError(toErrorMessage(caught));
        setPhase("error");
      } finally {
        if (mountedRef.current && requestId === requestRef.current) {
          setPending(false);
        }
      }
    },
    [data],
  );

  useEffect(() => {
    mountedRef.current = true;
    void load(filter);
    return () => {
      mountedRef.current = false;
    };
  }, [load, filter]);

  const clearFilters = (): void => setFilter(defaultTaskFilter());
  const startCreate = (): void => setCreateOpen(true);
  const refresh = (): void => void load(filter);

  const resultCount = formatResultCount(tasks.length, total);
  const isEmpty = tasks.length === 0;

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Create, filter and finish your tasks."
        actions={
          <Button
            variant="primary"
            disabled={phase === "loading"}
            onClick={startCreate}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New task
          </Button>
        }
      />

      {phase === "loading" ? (
        <div className="flex min-h-40 items-center justify-center border border-border bg-card">
          <LoadingState label="Loading tasks…" />
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="flex justify-start">
          <ErrorState
            title="Tasks could not be loaded"
            message={error ?? "The local task list could not be loaded."}
            onRetry={refresh}
          />
        </div>
      ) : null}

      {phase === "ready" ? (
        <>
          <TaskFilters value={filter} onChange={setFilter} projects={projects} />

          <p aria-live="polite" className="mt-3 text-xs text-muted-foreground">
            {resultCount}
          </p>

          <div aria-busy={pending} className="mt-2">
            {isEmpty && pending ? (
              <div className="flex min-h-32 items-center justify-center border border-border bg-card">
                <LoadingState label="Updating…" />
              </div>
            ) : isEmpty && total === 0 ? (
              <EmptyState
                icon={SquareCheckBig}
                title="No tasks yet"
                description="Create your first task — a title is enough to start."
                action={
                  <Button variant="primary" onClick={startCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New task
                  </Button>
                }
              />
            ) : isEmpty ? (
              <EmptyState
                icon={Search}
                title="No tasks match your filters"
                description="Try a different search, or clear the filters to see every task."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <TaskList
                tasks={tasks}
                onChanged={refresh}
                showProject
                showDueDate
              />
            )}
          </div>
        </>
      ) : null}

      <TaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        task={null}
        projects={projects}
        onSaved={refresh}
      />
    </>
  );
}
