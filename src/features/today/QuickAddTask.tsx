import { useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useData } from "../../app/DataProvider";
import { ValidationError } from "../../data/contracts";
import { todayLocalDate } from "../../lib/date";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { cn } from "../../components/ui/cn";

export interface QuickAddTaskProps {
  /** Called after a successful create so the page refetches from storage. */
  onCreated: () => void;
}

const INPUT_ID = "today-quick-add-input";
const ERROR_ID = `${INPUT_ID}-error`;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "The task could not be saved.";
}

/**
 * Quick-add field for the Today dashboard. Enter or the button submits; a
 * successful create clears the field, announces "Task added" politely and
 * hands control back to the page for a refetch. Validation failures keep
 * exactly what was typed and surface `fieldErrors.title` next to the input
 * (`aria-invalid` + `aria-describedby`). A blank/whitespace title never
 * reaches the data layer.
 */
export function QuickAddTask({ onCreated }: QuickAddTaskProps) {
  const data = useData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy) return;

    const title = value.trim();
    if (title === "") {
      setFieldError("Title is required");
      setFormError(null);
      setAnnouncement("");
      inputRef.current?.focus();
      return;
    }

    setBusy(true);
    setFieldError(null);
    setFormError(null);
    setAnnouncement("");
    try {
      await data.tasks.create({
        title,
        dueDate: todayLocalDate(),
        priority: "medium",
        projectId: null,
      });
      setValue("");
      setAnnouncement("Task added");
      onCreated();
    } catch (caught) {
      /* The typed value is deliberately untouched on every failure path. */
      if (caught instanceof ValidationError) {
        setFieldError(caught.fieldErrors.title ?? caught.message);
      } else {
        setFormError(toErrorMessage(caught));
      }
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor={INPUT_ID} className="sr-only">
            Add a task for today
          </label>
          <Input
            id={INPUT_ID}
            ref={inputRef}
            value={value}
            placeholder="Add a task for today…"
            aria-invalid={fieldError !== null}
            aria-describedby={fieldError !== null ? ERROR_ID : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              if (fieldError !== null) setFieldError(null);
            }}
          />
          {fieldError !== null ? (
            <p id={ERROR_ID} role="alert" className="text-xs text-destructive">
              {fieldError}
            </p>
          ) : null}
          {formError !== null ? (
            <p role="alert" className="text-xs text-destructive">
              {formError}
            </p>
          ) : null}
        </div>

        <Button type="submit" variant="primary" disabled={busy}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add task
        </Button>
      </div>

      {/* Persistent polite region: mounted before the text changes so screen
          readers announce "Task added" without interrupting the user. */}
      <p
        aria-live="polite"
        className={cn("text-xs text-muted-foreground", announcement === "" && "sr-only")}
      >
        {announcement}
      </p>
    </form>
  );
}
