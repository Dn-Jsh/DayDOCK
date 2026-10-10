import { Timer } from "lucide-react";
import type { FocusSession } from "../../data/contracts";
import { formatClock } from "../../lib/date";
import { Badge } from "../../components/ui/badge";
import { EmptyState } from "../../components/ui/empty-state";
import { formatSessionStart } from "./sessionTime";

export interface FocusSessionListProps {
  /** Stored history rows, newest first (`focusSessions.list()` order). */
  sessions: FocusSession[];
  /** Current clock reading, injected so day labels stay pure and testable. */
  nowMs: number;
}

const GRID = "grid grid-cols-[minmax(0,1fr)_5.5rem_6rem] items-center gap-3";

/**
 * Session history: stored `focus_sessions` rows, newest first. A running
 * session never appears here — it lives in `focus_state` and is shown by the
 * timer panel as the active session until it completes.
 */
export function FocusSessionList({ sessions, nowMs }: FocusSessionListProps) {
  return (
    <section aria-label="Session history" className="rounded-none border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-foreground">Session history</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Completed focus sessions, newest first.
        </p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={Timer}
          title="No focus sessions yet"
          description="Finish a session and it will be stored here, newest first."
          className="border-0"
        />
      ) : (
        <>
          <div
            className={`${GRID} border-b border-border bg-secondary/50 px-4 py-1.5 text-xs font-medium text-muted-foreground`}
          >
            <span>Started</span>
            <span className="text-right">Duration</span>
            <span className="text-right">Status</span>
          </div>
          <ul className="divide-y divide-border">
            {sessions.map((session) => (
              <li
                key={session.id}
                className={`${GRID} px-4 py-2.5 text-sm text-foreground`}
              >
                <span className="truncate tabular-nums">
                  {formatSessionStart(session.startedAt, nowMs)}
                </span>
                <span className="text-right tabular-nums text-muted-foreground">
                  {formatClock(session.actualDurationMs)}
                </span>
                <span className="flex justify-end">
                  <Badge variant={session.completed ? "outline" : "default"}>
                    {session.completed ? "Completed" : "Ended early"}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
