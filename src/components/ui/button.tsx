import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
  secondary:
    "border-border bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground",
  destructive:
    "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-xs",
  md: "h-8 gap-2 px-3.5 text-sm",
};

/**
 * The one button in DayDock. Sharp corners, neutral tokens, 150ms colour
 * transitions and a visible focus ring from the global `:focus-visible` rule.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      /* Explicit submit so a button inside a form never guesses. */
      type={type ?? "button"}
      className={cn(
        "inline-flex cursor-pointer select-none items-center justify-center rounded-none border font-medium",
        "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
});
