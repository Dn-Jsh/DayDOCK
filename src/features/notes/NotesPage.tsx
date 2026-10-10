import { useCallback, useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { useData } from "../../app/DataProvider";
import type { Note } from "../../data/contracts";
import { toErrorMessage } from "../../lib/errors";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { EmptyState } from "../../components/ui/empty-state";
import { ErrorState } from "../../components/ui/error-state";
import { NoteEditor } from "./NoteEditor";
import { NoteList } from "./NoteList";

/** Fallback copy when a failure carries no user-safe message of its own. */
const DATABASE_ERROR = "The local database could not be reached.";

/**
 * Quick notes (T-007): a two-pane list + auto-saving editor over the notes
 * repository. All matching and persistence live in `src/data/**`; this page
 * only orchestrates load, selection, create and delete-with-confirmation.
 */
export default function NotesPage() {
  const data = useData();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  /* Set right after "New note" so the fresh editor focuses its title field. */
  const focusTitleRef = useRef(false);
  /* Guards against a stale list response clobbering a newer one. */
  const requestIdRef = useRef(0);

  const refresh = useCallback(async (searchQuery: string) => {
    const requestId = (requestIdRef.current += 1);
    try {
      const rows = await data.notes.list(searchQuery);
      if (requestId !== requestIdRef.current) return; /* superseded */
      setNotes(rows);
      setLoadError(null);
      setSelectedId((current) => {
        if (current !== null && rows.some((note) => note.id === current)) return current;
        /* Selection is gone (deleted, or filtered out): fall to the newest match. */
        return rows[0]?.id ?? null;
      });
    } catch (error: unknown) {
      if (requestId !== requestIdRef.current) return;
      setLoadError(toErrorMessage(error, DATABASE_ERROR));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [data]);

  /* Re-run the repository search whenever the query changes. Matching itself
     happens in `notes.list` — never duplicated here. */
  useEffect(() => {
    void refresh(query);
  }, [query, refresh]);

  const handleNewNote = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const note = await data.notes.create({ title: "Untitled note" });
      /* Show the new note immediately even before the list refresh lands. */
      setNotes((current) => [note, ...current.filter((existing) => existing.id !== note.id)]);
      setSelectedId(note.id);
      focusTitleRef.current = true;
      setLoadError(null);
    } catch (error: unknown) {
      setLoadError(toErrorMessage(error, DATABASE_ERROR));
    } finally {
      setCreating(false);
    }
  }, [creating, data]);

  const selectedNote = notes.find((note) => note.id === selectedId) ?? null;

  useEffect(() => {
    if (focusTitleRef.current && selectedNote !== null) {
      focusTitleRef.current = false;
      titleInputRef.current?.focus();
    }
  }, [selectedNote]);

  const handleSave = useCallback(
    (patch: { title?: string; content?: string }) => {
      if (selectedId === null) {
        return Promise.reject(new Error("No note is selected."));
      }
      return data.notes.update(selectedId, patch);
    },
    [data, selectedId],
  );

  const handleSaved = useCallback(() => {
    /* Re-read through the repository so ordering and updatedAt stay truthful. */
    void refresh(query);
  }, [query, refresh]);

  const confirmDelete = useCallback(async () => {
    const id = pendingDeleteId;
    if (id === null) return;
    try {
      await data.notes.remove(id);
      setPendingDeleteId(null);
      setDeleteError(null);
      await refresh(query);
    } catch (error: unknown) {
      /* Re-throw so ConfirmDialog keeps itself open (its contract: the dialog
         only closes after onConfirm resolves) and record the message for the
         alert rendered next to it. */
      setDeleteError(toErrorMessage(error, DATABASE_ERROR));
      throw error;
    }
  }, [data, pendingDeleteId, query, refresh]);

  const pendingDeleteNote = notes.find((note) => note.id === pendingDeleteId) ?? null;

  return (
    <>
      <PageHeader title="Notes" subtitle="Quick plain-text notes with auto-save." />

      {/* A refresh failure while notes are already on screen must not be
          silent: keep the last good list and offer a retry (TodayPage pattern). */}
      {loadError !== null && notes.length > 0 ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-3 py-2"
        >
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="secondary" size="sm" onClick={() => void refresh(query)}>
            Retry
          </Button>
        </div>
      ) : null}

      {loadError !== null && selectedNote === null && notes.length === 0 ? (
        <ErrorState message={loadError} title="Notes could not be loaded" onRetry={() => void refresh(query)} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <NoteList
            notes={notes}
            selectedId={selectedId}
            query={query}
            loading={loading}
            creating={creating}
            onQueryChange={setQuery}
            onSelect={setSelectedId}
            onNewNote={() => void handleNewNote()}
            onClearSearch={() => setQuery("")}
          />

          {selectedNote !== null ? (
            <NoteEditor
              key={selectedNote.id}
              note={selectedNote}
              onSave={handleSave}
              onSaved={handleSaved}
              onDelete={() => {
                setDeleteError(null);
                setPendingDeleteId(selectedNote.id);
              }}
              titleInputRef={titleInputRef}
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="Select a note"
              description="Choose a note from the list, or create a new one to get started."
            />
          )}
        </div>
      )}

      {/* Failed delete: ConfirmDialog stays open (confirmDelete re-throws),
          and the message is surfaced above the dialog layer where the user
          can actually see it — not stranded at the bottom of the page. */}
      {deleteError !== null ? (
        <div
          role="alert"
          className="fixed left-1/2 top-6 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 border border-border bg-card px-3 py-2 text-sm text-destructive shadow-2xl"
        >
          {deleteError}
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingDeleteNote !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteId(null);
            setDeleteError(null);
          }
        }}
        title={pendingDeleteNote !== null ? `Delete “${pendingDeleteNote.title}”?` : "Delete note?"}
        description={
          pendingDeleteNote !== null
            ? `“${pendingDeleteNote.title}” will be permanently deleted. This note cannot be recovered.`
            : "This note cannot be recovered."
        }
        confirmLabel="Delete note"
        onConfirm={confirmDelete}
      />
    </>
  );
}
