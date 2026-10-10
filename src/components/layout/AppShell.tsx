import { useCallback, type MouseEvent } from "react";
import { PageView, usePage } from "../../app/router";
import { Sidebar } from "./Sidebar";

/**
 * Desktop frame: fixed 208px sidebar + scrolling main column, sized to the
 * viewport (`h-screen`, `overflow-hidden` on the frame so only `main` scrolls).
 * `minmax(0, 1fr)` keeps wide children from forcing horizontal overflow down to
 * 940×600.
 *
 * The skip link is the first focusable element; it moves focus into `<main>`
 * without touching `location.hash`, so the routed page never changes.
 */
export function AppShell() {
  const { page } = usePage();

  const handleSkipClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById("main-content")?.focus();
  }, []);

  return (
    <div className="relative grid h-screen grid-cols-[208px_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        onClick={handleSkipClick}
        className="absolute -top-20 left-3 z-50 rounded-none border border-border bg-popover px-3 py-2 text-sm font-medium text-popover-foreground transition-[top] duration-150 focus:top-3 focus:outline-2 focus:outline-offset-2 focus:outline-ring"
      >
        Skip to content
      </a>

      <Sidebar page={page} />

      <main id="main-content" tabIndex={-1} className="min-w-0 overflow-y-auto px-8 py-6">
        <PageView page={page} />
      </main>
    </div>
  );
}
