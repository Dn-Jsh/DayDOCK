import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Single-line text field. Wire the label with `htmlFor`/`id`, and point
 * `aria-describedby` at the message rendered next to the field. When
 * `aria-invalid` is set the border turns to the destructive token.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-8 w-full min-w-0 rounded-none border border-input bg-background px-2.5 text-sm text-foreground",
        "placeholder:text-muted-foreground transition-colors duration-150 hover:border-ring",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
