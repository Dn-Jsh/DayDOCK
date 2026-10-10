import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, FolderKanban, Plus } from "lucide-react";
import { useData } from "../../app/DataProvider";
import type { ProjectWithProgress, Task } from "../../data/contracts";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { EmptyState } from "../../components/ui/empty-state";
import { ErrorState } from "../../components/ui/error-state";
import { LoadingState } from "../../components/ui/loading-state";
import { Progress } from "../../components/ui/progress";
import { toErrorMessage } from "../../lib/errors";
import { TaskList } from "../tasks";
import { ProjectCard } from "./ProjectCard";
import { ProjectDialog } from "./ProjectDialog";
import {
  formatProjectCount,
  formatTaskCount,
  summarizeProjectTasks,
} from "./projectHelpers";

type Phase = "loading" | "ready" | "error";

const LIST_LOAD_ERROR = "The local project list could not be loaded.";
const DETAIL_LOAD_ERROR = "This project's tasks could not be loaded.";
const DELETE_ERROR = "The project could not be deleted.";

/**
 * The Projects page (T-005). List view: every project from
 * `data.projects.list()` as a card with progress; detail view: the selected
 * project's tasks rendered by the shared `TaskList` (so complete/edit/delete
 * come from T-004, never rebuilt here). The selected project lives in local
 * state — the router is untouched. Every load resolves to ready or error
 * (Retry re-runs it), so no path leaves a spinner up forever.
 */
export default function ProjectsPage() {
  const data = useData();

  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [listPhase, setListPhase] = useState<Phase>("loading");
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailProject, setDetailProject] = useState<ProjectWithProgress | null>(null);
  const [detailTasks, setDetailTasks] = useState<Task[]>([]);
  const [detailPhase, setDetailPhase] = useState<Phase>("loading");
  const [detailError, setDetailError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProject, setDialogProject] = useState<ProjectWithProgress | null>(null);
  const [deleting, setDeleting] = useState<ProjectWithProgress | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mountedRef = useRef(true);
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const detailHeadingId = useId();

  /* Request ids drop stale responses, so only the newest load can touch the
     screen (StrictMode double-invokes effects and refreshes can overlap). */
  const loadList = useCallback(async (): Promise<void> => {
    const requestId = (listRequestRef.current += 1);
    try {
      const rows = await data.projects.list();
      if (!mountedRef.current || requestId !== listRequestRef.current) return;
      setProjects(rows);
      setListError(null);
      setListPhase("ready");
    } catch (caught) {
      if (!mountedRef.current || requestId !== listRequestRef.current) return;
      setListError(toErrorMessage(caught, LIST_LOAD_ERROR));
      setListPhase("error");
    }
  }, [data]);

  const loadDetail = useCallback(
    async (projectId: number, showLoading = true): Promise<void> => {
      const requestId = (detailRequestRef.current += 1);
      if (showLoading) {
        setDetailPhase("loading");
        setDetailProject(null);
        setDetailTasks([]);
      }
      setDetailError(null);
      try {
        const [project, tasks] = await Promise.all([
          data.projects.get(projectId),
          data.tasks.list({ projectId }),
        ]);
        if (!mountedRef.current || requestId !== detailRequestRef.current) return;
        if (project === null) {
          /* The project vanished (deleted elsewhere): fall back to a
             refreshed list instead of leaving a broken detail view. */
          setSelectedId(null);
          setDetailPhase("ready");
          setActionError("That project no longer exists. The project list has been refreshed.");
          void loadList();
          return;
        }
        setDetailProject(project);
        setDetailTasks(tasks);
        setDetailPhase("ready");
      } catch (caught) {
        if (!mountedRef.current || requestId !== detailRequestRef.current) return;
        setDetailError(toErrorMessage(caught, DETAIL_LOAD_ERROR));
        setDetailPhase("error");
      }
    },
    [data, loadList],
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadList();
    return () => {
      mountedRef.current = false;
    };
  }, [loadList]);

  /* Used after every mutation: refreshes the list, and the open detail view
     so its header counts always match the rendered task rows. */
  const refresh = (): void => {
    void loadList();
    if (selectedId !== null) {
      void loadDetail(selectedId, false);
    }
  };

  const openProject = (project: ProjectWithProgress): void => {
    setActionError(null);
    setSelectedId(project.id);
    void loadDetail(project.id);
  };

  const showList = (): void => {
    setSelectedId(null);
  };

  const startCreate = (): void => {
    setActionError(null);
    setDialogProject(null);
    setDialogOpen(true);
  };

  const startRename = (project: ProjectWithProgress): void => {
    setActionError(null);
    setDialogProject(project);
    setDialogOpen(true);
  };

  const startDelete = (project: ProjectWithProgress): void => {
    setActionError(null);
    setDeleting(project);
    setConfirmOpen(true);
  };

  /* Runs inside ConfirmDialog: on success the dialog closes itself after the
     list reloads; on failure it resolves anyway so the dialog closes and the
     `role="alert"` banner below the header reports the message. Nothing the
     user typed exists on this path. */
  const handleDeleteConfirm = async (): Promise<void> => {
    if (deleting === null) return;
    try {
      await data.projects.remove(deleting.id);
      setActionError(null);
      if (selectedId === deleting.id) {
        setSelectedId(null);
      }
      await loadList();
    } catch (caught) {
      setActionError(toErrorMessage(caught, DELETE_ERROR));
    }
  };

  /* Header figures come from the task rows rendered below, so the count,
     percentage and progress bar can never disagree with the list. */
  const detailSummary = summarizeProjectTasks(detailTasks);

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Group related tasks and track their progress."
        actions={
          <Button
            variant="primary"
            disabled={listPhase === "loading"}
            onClick={startCreate}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New project
          </Button>
        }
      />

      {actionError !== null ? (
        <p
          role="alert"
          className="mb-4 border border-border bg-card px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      {selectedId === null ? (
        listPhase === "loading" ? (
          <div className="flex min-h-40 items-center justify-center border border-border bg-card">
            <LoadingState label="Loading projects…" />
          </div>
        ) : listPhase === "error" ? (
          <div className="flex justify-start">
            <ErrorState
              title="Projects could not be loaded"
              message={listError ?? LIST_LOAD_ERROR}
              onRetry={() => void loadList()}
            />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project — School, Programming, Personal, Business — to group related tasks and track their progress."
            action={
              <Button variant="primary" onClick={startCreate}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New project
              </Button>
            }
          />
        ) : (
          <>
            <p aria-live="polite" className="mb-2 text-xs text-muted-foreground">
              {formatProjectCount(projects.length)}
            </p>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={openProject}
                  onRename={startRename}
                  onDelete={startDelete}
                />
              ))}
            </ul>
          </>
        )
      ) : detailPhase === "loading" ? (
        <div className="flex min-h-40 items-center justify-center border border-border bg-card">
          <LoadingState label="Loading project…" />
        </div>
      ) : detailPhase === "error" || detailProject === null ? (
        <div className="flex justify-start">
          <ErrorState
            title="Project could not be loaded"
            message={detailError ?? DETAIL_LOAD_ERROR}
            onRetry={() => void loadDetail(selectedId)}
          />
        </div>
      ) : (
        <section aria-labelledby={detailHeadingId} className="flex flex-col gap-4">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2">
              <li>
                <Button variant="ghost" size="sm" onClick={showList}>
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back to projects
                </Button>
              </li>
              <li
                id={detailHeadingId}
                aria-current="page"
                className="truncate text-sm font-medium text-foreground"
              >
                {detailProject.name}
              </li>
            </ol>
          </nav>

          <div className="flex flex-col gap-2 border border-border bg-card px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="tabular-nums text-muted-foreground">
                {formatTaskCount(detailSummary.completed, detailSummary.total)}
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {detailSummary.percent}% complete
              </span>
            </div>
            <Progress
              value={detailSummary.completed}
              max={detailSummary.total}
              label={`${detailProject.name} progress`}
            />
          </div>

          <TaskList
            tasks={detailTasks}
            onChanged={refresh}
            showDueDate
            emptyMessage="No tasks in this project yet"
          />
        </section>
      )}

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={dialogProject}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={deleting ? `Delete "${deleting.name}"?` : "Delete project?"}
        description={
          deleting
            ? `The project "${deleting.name}" will be permanently deleted from this device. Its tasks are kept — they are not deleted — but they become unassigned and no longer belong to any project. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete project"
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
