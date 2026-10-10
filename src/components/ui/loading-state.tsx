import { LoaderCircle } from "lucide-react";
import { cn } from "./cn";

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

/** Shared loading indicator. Announced politely; the spinner honours reduced-motion. */
export function LoadingState({ label = "Loading…", className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}
    >
      <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
