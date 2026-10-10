import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Check, LoaderCircle, Trash2, TriangleAlert } from "lucide-react";
import { ValidationError, type Note } from "../../data/contracts";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../components/ui/cn";
import { createAutoSaver, saveStatusLabel, type AutoSaver, type SaveStatus } from "./autosave";
import { formatFullUpdated } from "./noteTime";

export interface NoteEditorProps {
  note: Note;
  /** The page owns the write so the editor stays free of data-layer imports. */
  onSave: (patch: { title?: string; content?: string }) => Promise<Note>;
  /** Called after every successful write so the page can refresh the list/timestamps. */
  onSaved: () => void;
  /** Opens the delete confirmation dialog for this note. */
  onDelete: () => void;
  /** Lets the page focus the title field after "New note". */
  titleInputRef?: RefObject<HTMLInputElement | null>;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") return error.message;
  return "The note could not be saved.";
}

/**
 * Right pane: title + plain-text content with debounced auto-save. The typed
 * draft is the source of truth for the inputs; the saver reads it at write time,
 * so rapid typing coalesces into a single `notes.update` and nothing is lost
 * between keystrokes. On unmount any pending change is flushed before the
 * timers are cancelled.
 */
export function NoteEditor({ note, onSave, onSaved, onDelete, titleInputRef }: NoteEditorProps) {
  const [draft, setDraft] = useState(() => ({ title: note.title, content: note.content }));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  /* The saver reads the freshest draft at write time, not the render-time copy. */
  const draftRef = useRef(draft);
  draftRef.current = draft;
  /* Same for callbacks whose identity may change between renders. */
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const saverRef = useRef<AutoSaver | null>(null);
  if (saverRef.current === null) {
    saverRef.current = createAutoSaver({
      save: async () => {
        const { title, content } = draftRef.current;
        await onSaveRef.current({ title, content });
        onSavedRef.current();
      },
      onStatusChange: setStatus,
      onError: (error: unknown) => {
        if (error instanceof ValidationError) {
          /* Show the message inline; the typed draft stays untouched. */
          setFieldErrors(error.fieldErrors);
        } else {
          setSaveError(toErrorMessage(error));
        }
      },
    });
  }
  const saver = saverRef.current;

  /* Switching notes must never silently drop typing: flush, then detach. */
  useEffect(() => {
    return () => {
      saver.runNow();
      saver.cancel();
    };
  }, [saver]);

  const scheduleSave = useCallback(() => {
    /* A new edit supersedes the previous validation complaint. */
    setFieldErrors({});
    setSaveError(null);
    saver.schedule();
  }, [saver]);

  const handleTitleChange = (value: string) => {
    setDraft((current) => ({ ...current, title: value }));
    scheduleSave();
  };

  const handleContentChange = (value: string) => {
    setDraft((current) => ({ ...current, content: value }));
    scheduleSave();
  };

  const retrySave = useCallback(() => {
    setFieldErrors({});
    setSaveError(null);
    saver.runNow();
  }, [saver]);

  const titleError = fieldErrors.title;
  const contentError = fieldErrors.content;

  return (
    <section
      aria-label={`Editing ${note.title}`}
      className="flex min-h-0 min-w-0 flex-col border border-border bg-card"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2">
        {/* Persistent, polite save status: "Saving…", "Saved" or failure + Retry. */}
        <span
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-1.5 text-xs",
            status === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {status === "saving" || status === "pending" ? (
            <LoaderCircle className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />
          ) : status === "error" ? (
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {saveStatusLabel(status)}
          {status === "error" ? (
            <Button variant="secondary" size="sm" onClick={retrySave} className="ml-1">
              Retry
            </Button>
          ) : null}
        </span>

        <span className="ml-auto text-xs text-muted-foreground">
          Last updated {formatFullUpdated(note.updatedAt)}
        </span>

        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          aria-label={`Delete note “${note.title}”`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:max-h-[calc(100vh-14rem)]">
        <div>
          <label htmlFor="note-title" className="mb-1 block text-xs font-medium text-foreground">
            Title
          </label>
          <Input
            id="note-title"
            ref={titleInputRef}
            value={draft.title}
            onChange={(event) => handleTitleChange(event.target.value)}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? "note-title-error" : undefined}
          />
          {titleError ? (
            <p id="note-title-error" className="mt-1 text-xs text-destructive">
              {titleError}
            </p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <label htmlFor="note-content" className="mb-1 block text-xs font-medium text-foreground">
            Content
          </label>
          <Textarea
            id="note-content"
            value={draft.content}
            onChange={(event) => handleContentChange(event.target.value)}
            aria-invalid={contentError ? true : undefined}
            aria-describedby={contentError ? "note-content-error" : undefined}
            className="min-h-64 flex-1 resize-y"
          />
          {contentError ? (
            <p id="note-content-error" className="mt-1 text-xs text-destructive">
              {contentError}
            </p>
          ) : null}
        </div>

        {saveError ? (
          <p role="alert" className="text-xs text-destructive">
            {saveError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
