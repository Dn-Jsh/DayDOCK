import type { ReactNode } from "react";
import { cn } from "./cn";

export interface FieldErrorProps {
  /** Id referenced by the control's `aria-describedby` (with `aria-invalid`). */
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Inline validation message for a form field. `role="alert"` announces the
 * failure as soon as it renders; the caller wires the same `id` into the
 * control's `aria-describedby` so the text is also read when the field
 * receives focus (WCAG 3.3.1 / 4.1.3).
 */
export function FieldError({ id, className, children }: FieldErrorProps) {
  return (
    <p id={id} role="alert" className={cn("text-xs text-destructive", className)}>
      {children}
    </p>
  );
}
