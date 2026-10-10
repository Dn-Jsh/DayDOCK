import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useData } from "../../app/DataProvider";
import { type Project, type ProjectWithProgress, ValidationError } from "../../data/contracts";
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
import { toErrorMessage } from "./projectHelpers";

export interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing project → rename mode; `null` → create mode. */
  project: ProjectWithProgress | null;
  /** Called with the persisted project right after a successful save. */
  onSaved: (project: Project) => void;
}

const SAVE_ERROR = "The project could not be saved.";

/**
 * The one create/rename dialog for projects: a single name field, validated
 * by the data layer (1–60 characters, trimmed — `validateProjectName`). A
 * `ValidationError` renders its `fieldErrors.name` inline next to the field,
 * moves focus back to it and never clears what the user typed; other failures
 * show a `role="alert"` banner in the same dialog. Radix traps focus, Escape
 * closes, and the title gives the dialog its accessible name.
 */
export function ProjectDialog({ open, onOpenChange, project, onSaved }: ProjectDialogProps) {
  const data = useData();
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const nameId = useId();
  const errorId = `${nameId}-error`;

  /* Re-seed each time the dialog opens: rename starts from the stored name,
     and a cancelled create leaves no residue behind. */
  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setFieldErrors({});
      setFormError(null);
      setSaving(false);
    }
  }, [open, project]);

  const nameError = fieldErrors.name;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (saving) return;
    setFieldErrors({});
    setFormError(null);
    setSaving(true);
    try {
      const saved =
        project === null
          ? await data.projects.create(name)
          : await data.projects.rename(project.id, name);
      onSaved(saved);
      onOpenChange(false);
    } catch (caught) {
      if (caught instanceof ValidationError) {
        setFieldErrors(caught.fieldErrors);
        if (caught.fieldErrors.name !== undefined) {
          nameRef.current?.focus();
        }
      } else {
        setFormError(toErrorMessage(caught, SAVE_ERROR));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel="Close project dialog">
        <form noValidate onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>{project === null ? "New project" : `Rename "${project.name}"`}</DialogTitle>
            <DialogDescription>
              {project === null
                ? "Projects group related tasks and track their completion."
                : "Choose a new name. The project's tasks are not affected."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 flex flex-col gap-1.5">
            <label htmlFor={nameId} className="text-xs font-medium text-foreground">
              Project name <span aria-hidden="true">*</span>
              <span className="sr-only"> (required)</span>
            </label>
            <Input
              id={nameId}
              ref={nameRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. School"
              aria-invalid={nameError !== undefined}
              aria-describedby={nameError !== undefined ? errorId : undefined}
              autoComplete="off"
            />
            {nameError !== undefined ? (
              <p id={errorId} className="text-xs text-destructive">
                {nameError}
              </p>
            ) : null}

            {formError !== null ? (
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
              {saving ? "Saving…" : project === null ? "Create project" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
