/**
 * Application root. Owned by ticket T-003 (app shell, navigation, theme).
 * The placeholder below only exists so the foundation compiles before T-003 lands.
 */
export default function App() {
  return (
    <div className="flex h-full items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">DayDock</p>
    </div>
  );
}
