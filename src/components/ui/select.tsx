import { useId } from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  /** Visible label, associated with the trigger through `htmlFor`. */
  label: string;
  /** `null` selects nothing and shows the placeholder (normalized below). */
  value: string | null;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  /** Id of helper/error text rendered next to the field. */
  describedBy?: string;
  invalid?: boolean;
  className?: string;
}

/**
 * Radix Select wrapper with a real `<label>` bound to the trigger.
 * The trigger stays a focusable button, so Tab/Enter/Space/arrows/Escape all
 * work through Radix's keyboard model.
 */
export function SelectField({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  id,
  disabled = false,
  describedBy,
  invalid = false,
  className,
}: SelectFieldProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;

  /* "Nothing selected" is expressed as `null` at our API, but this Radix
     version only shows the placeholder for `""`/`undefined`
     (`shouldShowPlaceholder`), and `undefined` would make the root
     uncontrolled — so normalize to the controlled empty string. */
  const radixValue = value ?? "";

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor={triggerId}
        className="text-xs font-medium text-foreground"
      >
        {label}
      </label>
      <RadixSelect.Root value={radixValue} onValueChange={onValueChange}>
        <RadixSelect.Trigger
          id={triggerId}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex h-8 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-none border",
            "border-input bg-background px-2.5 text-left text-sm text-foreground",
            "transition-colors duration-150 hover:border-ring",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "data-[placeholder]:text-muted-foreground aria-invalid:border-destructive",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon asChild>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            align="start"
            sideOffset={4}
            className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-none border border-border bg-popover text-popover-foreground shadow-lg"
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center px-2.5 py-1.5 text-sm",
                    "transition-colors duration-150 outline-none",
                    "data-[highlighted]:bg-secondary data-[highlighted]:text-secondary-foreground",
                    "data-[state=checked]:font-medium",
                  )}
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="absolute right-2 flex items-center">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
}
