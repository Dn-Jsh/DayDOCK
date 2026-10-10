import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Visible label, bound to the input with `htmlFor`. Omit only when the caller supplies an `aria-label`. */
  label?: ReactNode;
  className?: string;
}

/**
 * Accessible native `<input type="checkbox">`. The `.dd-checkbox` class in
 * `src/index.css` gives it the sharp neutral look (appearance is stripped, the
 * checkmark is a data-URI SVG that flips colour with the theme) while keeping
 * native keyboard, form and screen-reader behaviour.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={cn(
          "dd-checkbox shrink-0",
          "transition-colors duration-150",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        {...props}
      />
      {label !== undefined ? (
        <label htmlFor={inputId} className="cursor-pointer select-none text-sm text-foreground">
          {label}
        </label>
      ) : null}
    </span>
  );
});
