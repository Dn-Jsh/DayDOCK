import type { ReactNode } from "react";
import { cn } from "../ui/cn";

export interface PageHeaderProps {
  /** The page's single `<h1>`. */
  title: string;
  subtitle?: string;
  /** Right-aligned actions (buttons, filters). */
  actions?: ReactNode;
  className?: string;
}

/**
 * The one heading pattern every feature page uses: `h1` + optional subtitle,
 * optional action row, separated from the body by a hairline border.
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
