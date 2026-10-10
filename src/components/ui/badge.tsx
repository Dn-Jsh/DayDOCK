import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BadgeVariant = "default" | "outline" | "strong";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  /* Quiet chip: priority "low", neutral statuses. */
  default: "border-transparent bg-secondary text-secondary-foreground",
  /* De-emphasised: completed/secondary information. */
  outline: "border-border bg-transparent text-muted-foreground",
  /* Emphasised: priority "high", active state. */
  strong: "border-transparent bg-primary text-primary-foreground",
};

/** Neutral status/priority chip — sharp corners, no colour beyond the tokens. */
export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-none border px-1.5 text-xs font-medium",
        "leading-none transition-colors duration-150",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
