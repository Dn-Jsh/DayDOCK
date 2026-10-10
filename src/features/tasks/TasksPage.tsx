import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search, SquareCheckBig } from "lucide-react";
import { useData } from "../../app/DataProvider";
import type { ProjectWithProgress, Task, TaskFilter } from "../../data/contracts";
import { toErrorMessage } from "../../lib/errors";
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

/** Fallback copy when a failure carries no user-safe message of its own. */
const LIST_ERROR = "The local task list could not be loaded.";

/**
 * Debounce window for the search box: keystrokes render immediately, storage
 * is queried once per pause instead of once per keystroke (T-013 nit).
 */
export const TASK_SEARCH_DEBOUNCE_MS = 250;

/**
 * The Tasks page (T-004). Owns the filter state and the single refetch
 * routine: every list request runs `data.tasks.list(filter)` (SQL lives in
 * the repository) plus the unfiltered total for the "12 of 40 tasks" count.
 * A request id guards against stale responses, so only the newest query can
 * update the screen — no flicker, no spinner left hanging. Search keystrokes
 * are debounced (`TASK_SEARCH_DEBOUNCE_MS`) before they become part of
 * `filter`; selects and clears apply immediately.
 */
export default function TasksPage() {
  const data = useData();
  const [filter, setFilter] = useState<TaskFilter>(() => defaultTaskFilter());
  /* What the search box shows right now; `filter.query` only gets it once the
     debounce elapses, so typing is instant without a query per keystroke. */
  const [queryDraft, setQueryDraft] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const queryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingQuery = useCallback((): void => {
    if (queryTimerRef.current !== null) {
      clearTimeout(queryTimerRef.current);
      queryTimerRef.current = null;
    }
  }, []);

  /* Every non-search change (selects, clears) applies at once and adopts the
     typed-but-uncommitted query, so no keystroke is ever dropped. */
  const applyFilter = useCallback(
    (next: TaskFilter): void => {
      cancelPendingQuery();
      setQueryDraft(next.query ?? "");
      setFilter(next);
    },
    [cancelPendingQuery],
  );

  /* Search text renders immediately (the draft feeds the input) and joins
     `filter` after TASK_SEARCH_DEBOUNCE_MS of quiet — one query per pause. */
  const handleQueryChange = useCallback(
    (query: string): void => {
      setQueryDraft(query);
      cancelPendingQuery();
      queryTimerRef.current = setTimeout(() => {
        queryTimerRef.current = null;
        setFilter((current) => ({ ...current, query }));
      }, TASK_SEARCH_DEBOUNCE_MS);
    },
    [cancelPendingQuery],
  );

  /* On unmount a still-pending query is dropped: it is input state, not data. */
  useEffect(() => cancelPendingQuery, [cancelPendingQuery]);

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
        setError(toErrorMessage(caught, LIST_ERROR));
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

  const clearFilters = (): void => applyFilter(defaultTaskFilter());
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
            message={error ?? LIST_ERROR}
            onRetry={refresh}
          />
        </div>
      ) : null}

      {phase === "ready" ? (
        <>
          <TaskFilters
            value={{ ...filter, query: queryDraft }}
            onChange={applyFilter}
            onQueryChange={handleQueryChange}
            projects={projects}
          />

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
