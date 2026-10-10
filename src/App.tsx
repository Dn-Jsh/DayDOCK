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

export default function App() {
  return (
    <DataProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </DataProvider>
  );
}
