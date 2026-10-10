import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  FileText,
  FolderKanban,
  Moon,
  Settings,
  SquareCheckBig,
  Sun,
  Timer,
} from "lucide-react";
import type { ThemeMode } from "../../data/contracts";
import { useTheme } from "../../app/theme";
import { hashForPage, type PageId } from "../../app/router";
import { cn } from "../ui/cn";

interface NavItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
}

/** Order mirrors the brief: Today, Tasks, Projects, Notes, Focus, Settings. */
const NAV_ITEMS: readonly NavItem[] = [
  { id: "today", label: "Today", icon: CalendarDays },
  { id: "tasks", label: "Tasks", icon: SquareCheckBig },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "settings", label: "Settings", icon: Settings },
];

export interface SidebarProps {
  /** Active page — drives `aria-current` and the indicator bar. */
  page: PageId;
}

/**
 * Compact 208px navigation column: wordmark, primary nav (a `nav` landmark),
 * and the theme toggle pinned to the bottom. Entries are plain hash anchors,
 * so mouse and keyboard navigation use the native link behaviour.
 */
export function Sidebar({ page }: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  const handleToggleTheme = () => {
    /* ThemeProvider already logs and reverts on a failed write. */
    setTheme(nextTheme).catch(() => undefined);
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
        <span className="text-[15px] font-semibold tracking-tight text-foreground">DayDock</span>
      </div>

      <nav
        aria-label="Primary"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === page;
          const Icon = item.icon;
          return (
            <a
              key={item.id}
              href={hashForPage(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex cursor-pointer items-center gap-2 rounded-none px-3 py-2 text-sm",
                "transition-colors duration-150",
                isActive
                  ? "bg-sidebar-active font-medium text-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground",
              )}
            >
              {isActive ? (
                /* 2px active indicator pinned to the sidebar edge. */
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-foreground" />
              ) : null}
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center justify-end border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={handleToggleTheme}
          aria-label={`Switch to ${nextTheme} theme`}
          title={`Switch to ${nextTheme} theme`}
          className={cn(
            "flex h-8 w-8 cursor-pointer items-center justify-center rounded-none border border-transparent",
            "text-sidebar-foreground transition-colors duration-150",
            "hover:border-sidebar-border hover:bg-sidebar-hover hover:text-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          <ThemeIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
