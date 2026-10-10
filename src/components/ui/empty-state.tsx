import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Lucide icon shown in a small bordered square. Decorative only. */
  icon?: LucideIcon;
  /** Optional primary action (e.g. "New task"). */
  action?: ReactNode;
  className?: string;
}

/** Shared empty state — honest "nothing here yet" panel with consistent geometry. */
export function EmptyState({ title, description, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-none border border-border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="flex h-9 w-9 items-center justify-center border border-border text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-1 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
