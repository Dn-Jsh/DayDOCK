import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Multi-line text field. Same token wiring and focus behaviour as `Input`. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows ?? 4}
      className={cn(
        "w-full min-w-0 resize-y rounded-none border border-input bg-background px-2.5 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground transition-colors duration-150 hover:border-ring",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
