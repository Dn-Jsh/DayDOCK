import { cn } from "./cn";

export interface ProgressProps {
  /** Current value, clamped into `[0, max]`. */
  value: number;
  max?: number;
  /** Accessible name — required because the bar has no visible text. */
  label: string;
  /** Show the rounded percentage next to the bar. */
  showValue?: boolean;
  className?: string;
}

/** Thin, token-based progress bar (project completion). */
export function Progress({ value, max = 100, label, showValue = false, className }: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = Math.round((clamped / safeMax) * 100);

  return (
    <div className={cn("flex w-full min-w-0 items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-valuetext={`${percent}%`}
        className="h-1 w-full min-w-0 overflow-hidden bg-secondary"
      >
        <div
          className="h-full bg-primary transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
      {showValue ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{percent}%</span>
      ) : null}
    </div>
  );
}
