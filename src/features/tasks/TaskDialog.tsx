import { useEffect, useId, useState, type FormEvent } from "react";
import { useData } from "../../app/DataProvider";
import {
  type Priority,
  type ProjectWithProgress,
  type Task,
  type TaskInput,
  ValidationError,
} from "../../data/contracts";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { SelectField } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";

export interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing task → edit mode; `undefined`/`null` → create mode. */
  task?: Task | null;
  projects: ProjectWithProgress[];
  /** Called with the persisted task right after a successful save. */
  onSaved: (task: Task) => void;
}

/** Uncontrolled-looking form state; the user's input is never reset on error. */
interface TaskFormState {
  title: string;
  description: string;
  priority: Priority;
  /** `YYYY-MM-DD` or `""` when the task has no due date. */
  dueDate: string;
  /** Project id as a string, or `"none"` for no project. */
  projectId: string;
}

const NO_PROJECT = "none";

/** Focus order used when picking the first field to focus after a failure. */
const FIELD_ORDER = ["title", "description", "dueDate", "priority", "projectId"] as const;
type FieldName = (typeof FIELD_ORDER)[number];

function formFromTask(task: Task | null | undefined): TaskFormState {
  if (!task) {
    return { title: "", description: "", priority: "medium", dueDate: "", projectId: NO_PROJECT };
  }
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate ?? "",
    projectId: task.projectId === null ? NO_PROJECT : String(task.projectId),
  };
}

function toTaskInput(form: TaskFormState): TaskInput {
  return {
    title: form.title,
    description: form.description,
    priority: form.priority,
    dueDate: form.dueDate === "" ? null : form.dueDate,
    projectId: form.projectId === NO_PROJECT ? null : Number(form.projectId),
  };
}

/** Select value → priority; the dialog only offers the three valid options. */
function priorityFrom(value: string): Priority {
  return value === "low" || value === "high" ? value : "medium";
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "The task could not be saved.";
}

/**
 * The one create/edit dialog for tasks (title + optional description,
 * priority, due date, project). Radix traps focus, Escape closes, the dialog
 * is labelled by its title, and the title input is the first focusable field.
 * Validation failures from the data layer render inline (`aria-invalid` +
 * `aria-describedby`) and move focus to the first offending field without
 * clearing anything the user typed.
 */
export function TaskDialog({ open, onOpenChange, task, projects, onSaved }: TaskDialogProps) {
  const data = useData();
  const [form, setForm] = useState<TaskFormState>(() => formFromTask(task));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const titleId = useId();
  const descriptionId = useId();
  const dueDateId = useId();
  const priorityId = useId();
  const projectIdValue = useId();
  const fieldIds: Record<FieldName, string> = {
    title: titleId,
    description: descriptionId,
    dueDate: dueDateId,
    priority: priorityId,
    projectId: projectIdValue,
  };

  /* Re-seed the form each time the dialog opens so edits start from stored
     values and a cancelled create leaves no residue behind. */
  useEffect(() => {
    if (open) {
      setForm(formFromTask(task));
      setFieldErrors({});
      setFormError(null);
      setSaving(false);
    }
  }, [open, task]);

  const errorId = (field: FieldName): string => `${fieldIds[field]}-error`;
  const describedBy = (field: FieldName): string | undefined =>
    fieldErrors[field] ? errorId(field) : undefined;
  const invalid = (field: FieldName): boolean => fieldErrors[field] !== undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (saving) return;
    setFieldErrors({});
    setFormError(null);
    setSaving(true);
    try {
      const input = toTaskInput(form);
      const saved = task ? await data.tasks.update(task.id, input) : await data.tasks.create(input);
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ValidationError) {
        setFieldErrors(error.fieldErrors);
        const firstInvalid = FIELD_ORDER.find((field) => error.fieldErrors[field] !== undefined);
        if (firstInvalid) {
          document.getElementById(fieldIds[firstInvalid])?.focus();
        }
      } else {
        setFormError(toErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  };

  const priorityOptions: Array<{ value: string; label: string }> = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ];
  const projectOptions: Array<{ value: string; label: string }> = [
    { value: NO_PROJECT, label: "No project" },
    ...projects.map((project) => ({ value: String(project.id), label: project.name })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel="Close task dialog">
        <form noValidate onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
            <DialogDescription>
              {task
                ? "Update the task details. Changes are saved to this device."
                : "Only the title is required — priority defaults to Medium."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={titleId} className="text-xs font-medium text-foreground">
                Title <span aria-hidden="true">*</span>
                <span className="sr-only"> (required)</span>
              </label>
              <Input
                id={titleId}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="e.g. Draft project proposal"
                aria-invalid={invalid("title")}
                aria-describedby={describedBy("title")}
                autoComplete="off"
              />
              {fieldErrors.title ? (
                <p id={errorId("title")} className="text-xs text-destructive">
                  {fieldErrors.title}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={descriptionId} className="text-xs font-medium text-foreground">
                Description
              </label>
              <Textarea
                id={descriptionId}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Optional details"
                rows={3}
                aria-invalid={invalid("description")}
                aria-describedby={describedBy("description")}
              />
              {fieldErrors.description ? (
                <p id={errorId("description")} className="text-xs text-destructive">
                  {fieldErrors.description}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={dueDateId} className="text-xs font-medium text-foreground">
                  Due date
                </label>
                <Input
                  id={dueDateId}
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                  aria-invalid={invalid("dueDate")}
                  aria-describedby={describedBy("dueDate")}
                />
                {fieldErrors.dueDate ? (
                  <p id={errorId("dueDate")} className="text-xs text-destructive">
                    {fieldErrors.dueDate}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <SelectField
                  id={priorityId}
                  label="Priority"
                  value={form.priority}
                  onValueChange={(value) => setForm({ ...form, priority: priorityFrom(value) })}
                  options={priorityOptions}
                  describedBy={describedBy("priority")}
                  invalid={invalid("priority")}
                />
                {fieldErrors.priority ? (
                  <p id={errorId("priority")} className="text-xs text-destructive">
                    {fieldErrors.priority}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <SelectField
                id={projectIdValue}
                label="Project"
                value={form.projectId}
                onValueChange={(value) => setForm({ ...form, projectId: value })}
                options={projectOptions}
                describedBy={describedBy("projectId")}
                invalid={invalid("projectId")}
              />
              {fieldErrors.projectId ? (
                <p id={errorId("projectId")} className="text-xs text-destructive">
                  {fieldErrors.projectId}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p role="alert" className="border border-border bg-card px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : task ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
