import { TriangleAlert } from "lucide-react";
import { Button } from "./button";
import { cn } from "./cn";

export interface ErrorStateProps {
  /** User-safe message — never include note content, SQL or secrets. */
  message: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * Shared failure panel. Announced with `role="alert"`; the optional Retry
 * button re-runs the failed operation supplied by the caller.
 */
export function ErrorState({
  message,
  title = "Something went wrong",
  onRetry,
  retryLabel = "Retry",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex w-full max-w-md flex-col items-start gap-3 rounded-none border border-border bg-card p-6",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <TriangleAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
