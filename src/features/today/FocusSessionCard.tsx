import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import type { FocusState } from "../../data/contracts";
import { formatClock } from "../../lib/date";
import { computeFocusProgress } from "../focus";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";

export interface FocusSessionCardProps {
  /** Persisted `focus_state`, or `null` when no session is active. */
  state: FocusState | null;
}

/** Re-render cadence for the countdown — the value is never accumulated. */
const TICK_MS = 500;

/**
 * Active focus session summary for the Today dashboard. The displayed time is
 * always re-derived from `computeFocusProgress(state, Date.now())` by the pure
 * helper; this component only re-renders every 500ms while a session exists.
 * With no session it collapses to a compact empty card linking to `#focus`.
 */
export function FocusSessionCard({ state }: FocusSessionCardProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (state === null) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [state]);

  if (state === null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-3 py-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">No active focus session</p>
            <p className="text-xs text-muted-foreground">
              Start the timer to track a focus block here.
            </p>
          </div>
        </div>
        <a
          href="#focus"
          className="text-xs font-medium text-foreground underline underline-offset-2 transition-colors duration-150 hover:text-muted-foreground"
        >
          Start a focus session
        </a>
      </div>
    );
  }

  const progress = computeFocusProgress(state, nowMs);
  const statusLabel = state.status === "running" ? "Running" : "Paused";

  return (
    <div className="flex flex-col gap-2 border border-border bg-card px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={state.status === "running" ? "strong" : "default"}>
            {statusLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {state.status === "running"
              ? "Focus session in progress"
              : "Focus session paused"}
          </span>
        </div>
        <a
          href="#focus"
          className="text-xs font-medium text-foreground underline underline-offset-2 transition-colors duration-150 hover:text-muted-foreground"
        >
          Open Focus page
        </a>
      </div>

      <p className="font-mono text-3xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
        <span className="sr-only">Remaining time: </span>
        {formatClock(progress.remainingMs)}
      </p>

      <Progress value={Math.round(progress.progress * 100)} label="Focus session progress" />
    </div>
  );
}
