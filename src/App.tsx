/**
 * Application root — ticket T-003 (app shell, navigation, theme).
 *
 * DataProvider owns the app-wide loading and error states: children mount only
 * once the SQLite data layer resolves, and a failed `getData()` renders the
 * shared ErrorState with a Retry button instead of an endless spinner.
 * ThemeProvider then restores the persisted theme before the shell draws, so
 * light-mode users never see a dark flash.
 */
import { DataProvider } from "./app/DataProvider";
import { ThemeProvider } from "./app/theme";
import { AppShell } from "./components/layout/AppShell";
/* Direct module import (not the `./features/focus` barrel) so FocusPage keeps
   its lazy route chunk — the barrel statically re-exports it. */
import { FocusCompletionWatcher } from "./features/focus/FocusCompletionWatcher";

export default function App() {
  return (
    <DataProvider>
      {/* Completes a focus session whose deadline passed off the Focus page
          (T-014): runs once the data layer loads and on navigation/focus/tick. */}
      <FocusCompletionWatcher />
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </DataProvider>
  );
}
