import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useData } from "../../app/DataProvider";
import type { FocusState, Task } from "../../data/contracts";
import { todayLocalDate } from "../../lib/date";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/button";
import { ErrorState } from "../../components/ui/error-state";
import { LoadingState } from "../../components/ui/loading-state";
import { TaskList } from "../tasks";
import { FocusSessionCard } from "./FocusSessionCard";
import { QuickAddTask } from "./QuickAddTask";
import { StatTile } from "./StatTile";
import {
  formatLongDate,
  pluralizeCount,
  selectCompletedToday,
  selectDueToday,
  selectOverdue,
  selectPriorityTasks,
} from "./dashboardModel";

type Phase = "loading" | "ready" | "error";

/** A session left open past midnight rolls over without a reload. */
const DATE_REFRESH_MS = 60_000;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "The dashboard could not be loaded.";
}

interface TodaySectionProps {
  headingId: string;
  title: string;
  /** Row count shown (and announced) next to the heading. */
  count: number;
  children: ReactNode;
}

/**
 * One task block: `section` + `h2` + row count, plus a link into the Tasks
 * feature. The rows themselves come from the shared `TaskList`.
 */
function TodaySection({ headingId, title, count, children }: TodaySectionProps) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="text-sm font-medium text-foreground">
          {title}
        </h2>
        <div className="flex items-baseline gap-3">
          <span className="text-xs tabular-nums text-muted-foreground">
            {pluralizeCount(count, "task")}
          </span>
          <a
            href="#tasks"
            className="text-xs text-muted-foreground underline underline-offset-2 transition-colors duration-150 hover:text-foreground"
          >
            View in Tasks
          </a>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * The Today dashboard (T-006). Every figure is derived from stored rows:
 * the page fetches all tasks plus the persisted focus state once, then the
 * pure selectors in `dashboardModel.ts` classify them against the current
 * local date. The date itself is recomputed on mount, on window focus and
 * every 60 seconds so a session left open past midnight rolls over.
 */
export default function TodayPage() {
  const data = useData();
  const [today, setToday] = useState(() => todayLocalDate());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [focusState, setFocusState] = useState<FocusState | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadError, setReloadError] = useState<string | null>(null);

  /* Guards against stale promise results: StrictMode double-invokes effects
     and a Retry supersedes any in-flight request. */
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const loadedRef = useRef(false);

  const load = useCallback(async (): Promise<void> => {
    const requestId = (requestRef.current += 1);
    try {
      const [taskRows, activeFocus] = await Promise.all([
        data.tasks.list(),
        data.focusState.get(),
      ]);
      if (!mountedRef.current || requestId !== requestRef.current) return;
      loadedRef.current = true;
      setTasks(taskRows);
      setFocusState(activeFocus);
      setReloadError(null);
      setLoadError(null);
      setPhase("ready");
    } catch (caught) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      const message = toErrorMessage(caught);
      if (loadedRef.current) {
        /* Background refetch failed: keep the last good data and show a
           retryable banner rather than blanking a working page. */
        setReloadError(message);
      } else {
        setLoadError(message);
        setPhase("error");
      }
    }
  }, [data]);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  const retry = useCallback(() => {
    setPhase("loading");
    setLoadError(null);
    void load();
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  /* Real local date: recomputed on mount, on window focus and every minute. */
  useEffect(() => {
    const refreshToday = () => setToday(todayLocalDate());
    refreshToday();
    window.addEventListener("focus", refreshToday);
    const intervalId = window.setInterval(refreshToday, DATE_REFRESH_MS);
    return () => {
      window.removeEventListener("focus", refreshToday);
      window.clearInterval(intervalId);
    };
  }, []);

  const dueToday = selectDueToday(tasks, today);
  const overdue = selectOverdue(tasks, today);
  const completedToday = selectCompletedToday(tasks, today);
  const priorityTasks = selectPriorityTasks(tasks);

  return (
    <>
      <PageHeader title="Today" subtitle={formatLongDate(today)} />

      {phase === "loading" ? (
        <div className="flex min-h-40 items-center justify-center border border-border bg-card">
          <LoadingState label="Loading today…" />
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="flex justify-start">
          <ErrorState
            title="Today could not be loaded"
            message={loadError ?? "The dashboard could not be loaded."}
            onRetry={retry}
          />
        </div>
      ) : null}

      {phase === "ready" ? (
        <div className="flex flex-col gap-6">
          {reloadError !== null ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-3 py-2"
            >
              <p className="text-sm text-destructive">{reloadError}</p>
              <Button variant="secondary" size="sm" onClick={reload}>
                Retry
              </Button>
            </div>
          ) : null}

          <section
            aria-labelledby="today-quick-add-heading"
            className="flex flex-col gap-2"
          >
            <h2
              id="today-quick-add-heading"
              className="text-sm font-medium text-foreground"
            >
              Quick add
            </h2>
            <QuickAddTask onCreated={reload} />
          </section>

          <section
            aria-labelledby="today-stats-heading"
            className="flex flex-col gap-2"
          >
            <h2
              id="today-stats-heading"
              className="text-sm font-medium text-foreground"
            >
              At a glance
            </h2>
            <div aria-live="polite" className="grid grid-cols-3 gap-3">
              <StatTile value={completedToday.length} label="Completed today" />
              <StatTile value={overdue.length} label="Overdue" />
              <StatTile value={priorityTasks.length} label="High priority" />
            </div>
          </section>

          <TodaySection
            headingId="today-due-heading"
            title="Due today"
            count={dueToday.length}
          >
            <TaskList
              tasks={dueToday}
              onChanged={reload}
              showDueDate
              showProject
              emptyMessage="Nothing due today"
            />
          </TodaySection>

          <TodaySection
            headingId="today-overdue-heading"
            title="Overdue"
            count={overdue.length}
          >
            <TaskList
              tasks={overdue}
              onChanged={reload}
              showDueDate
              showProject
              emptyMessage="No overdue tasks"
            />
          </TodaySection>

          <TodaySection
            headingId="today-priority-heading"
            title="High priority"
            count={priorityTasks.length}
          >
            <TaskList
              tasks={priorityTasks}
              onChanged={reload}
              showDueDate
              showProject
              emptyMessage="No high-priority tasks"
            />
          </TodaySection>

          <section
            aria-labelledby="today-focus-heading"
            className="flex flex-col gap-2"
          >
            <h2
              id="today-focus-heading"
              className="text-sm font-medium text-foreground"
            >
              Focus session
            </h2>
            <FocusSessionCard state={focusState} />
          </section>
        </div>
      ) : null}
    </>
  );
}
