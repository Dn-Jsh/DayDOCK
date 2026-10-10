import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ThemeMode } from "../data/contracts";
import { useData } from "./DataProvider";
import { LoadingState } from "../components/ui/loading-state";

export interface ThemeValue {
  theme: ThemeMode;
  /** Applies the theme immediately, then persists it; reverts and rejects if the write fails. */
  setTheme: (theme: ThemeMode) => Promise<void>;
  /** True once the stored theme has been read (or the read failed and dark is the fallback). */
  ready: boolean;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function applyThemeToDocument(theme: ThemeMode): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

/**
 * Restores the persisted theme from SQLite on mount (so it survives restart),
 * keeps `<html>`'s `dark` class and `color-scheme` in sync, and writes changes
 * through `data.settings.update({ theme })`. Children render only after the
 * stored value is applied, so light-mode users never see a dark flash.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const data = useData();
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await data.settings.get();
        if (cancelled) return;
        setThemeState(settings.theme);
        applyThemeToDocument(settings.theme);
      } catch (error) {
        /* Fall back to the dark default rather than blocking the app. */
        console.error("[DayDock] could not read the saved theme; using dark", error);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  const setTheme = useCallback(
    async (next: ThemeMode) => {
      const previous = theme;
      if (next === previous) return;
      /* Optimistic: the UI answers instantly, then storage confirms. */
      setThemeState(next);
      applyThemeToDocument(next);
      try {
        const updated = await data.settings.update({ theme: next });
        if (updated.theme !== next) {
          setThemeState(updated.theme);
          applyThemeToDocument(updated.theme);
        }
      } catch (error) {
        setThemeState(previous);
        applyThemeToDocument(previous);
        console.error("[DayDock] could not save the theme change", error);
        throw error;
      }
    },
    [data, theme],
  );

  const value = useMemo<ThemeValue>(
    () => ({ theme, setTheme, ready }),
    [theme, setTheme, ready],
  );

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-foreground">
        <LoadingState label="Loading settings…" />
      </div>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** `{ theme, setTheme, ready }` — the only theme API features should use. */
export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme() must be used inside a ThemeProvider.");
  }
  return value;
}
