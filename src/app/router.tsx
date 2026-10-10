import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from "react";
import { LoadingState } from "../components/ui/loading-state";

/** The six pages of DayDock. The hash router is limited to exactly these ids. */
export type PageId = "today" | "tasks" | "projects" | "notes" | "focus" | "settings";

const PAGE_IDS = ["today", "tasks", "projects", "notes", "focus", "settings"] as const;

export function isPageId(value: string): value is PageId {
  return (PAGE_IDS as readonly string[]).includes(value);
}

/** `#tasks` → `"tasks"`; anything unknown falls back to `"today"`. */
export function pageFromHash(hash: string): PageId {
  const id = hash.replace(/^#\/?/, "");
  return isPageId(id) ? id : "today";
}

export function hashForPage(page: PageId): string {
  return `#${page}`;
}

/**
 * Feature pages are code-split: each one is only fetched when first visited.
 * Every page module must default-export its React component.
 */
const PAGE_LOADERS: Record<PageId, () => Promise<{ default: ComponentType }>> = {
  today: () => import("../features/today/TodayPage"),
  tasks: () => import("../features/tasks/TasksPage"),
  projects: () => import("../features/projects/ProjectsPage"),
  notes: () => import("../features/notes/NotesPage"),
  focus: () => import("../features/focus/FocusPage"),
  settings: () => import("../features/settings/SettingsPage"),
};

const PAGE_COMPONENTS: Record<PageId, LazyExoticComponent<ComponentType>> = {
  today: lazy(PAGE_LOADERS.today),
  tasks: lazy(PAGE_LOADERS.tasks),
  projects: lazy(PAGE_LOADERS.projects),
  notes: lazy(PAGE_LOADERS.notes),
  focus: lazy(PAGE_LOADERS.focus),
  settings: lazy(PAGE_LOADERS.settings),
};

function readPageFromLocation(): PageId {
  return pageFromHash(window.location.hash);
}

/**
 * Hash-based routing: the active page lives in `location.hash` (`#tasks`) so a
 * reload keeps it, and `hashchange` keeps state in sync with back/forward and
 * sidebar clicks. Unknown hashes resolve to `"today"`.
 */
export function usePage(): { page: PageId; navigate: (page: PageId) => void } {
  const [page, setPage] = useState<PageId>(readPageFromLocation);

  useEffect(() => {
    const handleHashChange = () => setPage(readPageFromLocation());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = useCallback((next: PageId) => {
    const target = hashForPage(next);
    if (window.location.hash === target) {
      /* Already there — hashchange would not fire, so sync state directly. */
      setPage(next);
      return;
    }
    window.location.hash = target;
  }, []);

  return { page, navigate };
}

/** Renders the active lazy page; the Suspense fallback is the shared loader. */
export function PageView({ page }: { page: PageId }) {
  const Page = PAGE_COMPONENTS[page];
  return (
    <Suspense
      fallback={
        <div className="flex min-h-40 items-center justify-center">
          <LoadingState label="Loading page…" />
        </div>
      }
    >
      <Page />
    </Suspense>
  );
}
