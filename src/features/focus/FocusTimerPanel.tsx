import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import { formatClock } from "../../lib/date";

export type FocusTimerStatus = "running" | "paused" | null;

export interface FocusTimerPanelProps {
  status: FocusTimerStatus;
  /** Live remaining while a session runs; the planned duration while idle. */
  remainingMs: number;
  /** Milliseconds consumed so far (0 while idle). */
  elapsedMs: number;
  /** Planned session length in milliseconds. */
  plannedDurationMs: number;
  /** Completion fraction in `[0, 1]` for the active session. */
  progress: number;
  /**
   * Throttled live-region text: announced on state changes and at most once
   * per minute while running — never on every tick.
   */
  announcement: string;
  /** True while a persistence write is in flight (controls disabled). */
  busy: boolean;
  /** Title of the task linked to the *active* session, if any. */
  linkedTaskTitle: string | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

const DOMINANT_BUTTON_CLASS = "h-10 px-6 text-base";

/**
 * The timer card: monospace mm:ss clock, progress, primary action and the
 * polite live region. Presentation only — timing comes from `timer.ts` via the
 * page, and every control is a real focusable `<button>` with the global
 * `:focus-visible` ring.
 */
export function FocusTimerPanel({
  status,
  remainingMs,
  elapsedMs,
  plannedDurationMs,
  progress,
  announcement,
  busy,
  linkedTaskTitle,
  onStart,
  onPause,
  onResume,
  onReset,
}: FocusTimerPanelProps) {
  const isActive = status !== null;
  const statusLabel =
    status === "running" ? "Running" : status === "paused" ? "Paused" : "Ready";
  const statusVariant =
    status === "running" ? "strong" : status === "paused" ? "default" : "outline";

  return (
    <section aria-label="Focus timer" className="rounded-none border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">Focus timer</h2>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>

      <p className="mt-4 font-mono text-6xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
        <span className="sr-only">Remaining time: </span>
        {formatClock(remainingMs)}
      </p>

      <p className="mt-2 text-sm text-muted-foreground">
        {isActive
          ? `${formatClock(elapsedMs)} elapsed of ${formatClock(plannedDurationMs)} planned`
          : `${formatClock(plannedDurationMs)} planned`}
      </p>

      {isActive ? (
        <Progress
          className="mt-3"
          value={Math.round(progress * 100)}
          label="Focus session progress"
          showValue
        />
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {status === null ? (
          <Button
            variant="primary"
            className={DOMINANT_BUTTON_CLASS}
            onClick={onStart}
            disabled={busy}
          >
            Start
          </Button>
        ) : null}
        {status === "running" ? (
          <Button
            variant="primary"
            className={DOMINANT_BUTTON_CLASS}
            onClick={onPause}
            disabled={busy}
          >
            Pause
          </Button>
        ) : null}
        {status === "paused" ? (
          <Button
            variant="primary"
            className={DOMINANT_BUTTON_CLASS}
            onClick={onResume}
            disabled={busy}
          >
            Resume
          </Button>
        ) : null}
        <Button
          variant="secondary"
          className="h-10 px-4"
          onClick={onReset}
          disabled={busy || !isActive}
        >
          Reset
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Reset discards the current session — no entry is added to history.
      </p>

      {linkedTaskTitle !== null ? (
        <p className="mt-3 truncate text-sm text-foreground">
          Linked task: <span className="font-medium">{linkedTaskTitle}</span>
        </p>
      ) : null}

      <p
        role="status"
        aria-live="polite"
        className="mt-3 min-h-5 text-sm text-muted-foreground"
      >
        {announcement}
      </p>
    </section>
  );
}
