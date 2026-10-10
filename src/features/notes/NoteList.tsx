import { Plus, Search } from "lucide-react";
import type { Note } from "../../data/contracts";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { Input } from "../../components/ui/input";
import { LoadingState } from "../../components/ui/loading-state";
import { cn } from "../../components/ui/cn";
import { describeEmptyNotes, noteCountLabel } from "./noteSearch";
import { formatShortUpdated } from "./noteTime";

export interface NoteListProps {
  notes: Note[];
  selectedId: number | null;
  /** Raw contents of the search box; trimming/normalizing happens in helpers. */
  query: string;
  /** True while a `notes.list(query)` request is in flight. */
  loading: boolean;
  creating: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (id: number) => void;
  onNewNote: () => void;
  onClearSearch: () => void;
}

/**
 * Left pane of the notes page: search box, "New note" button, result count and
 * the scrollable note list. Selection is communicated with `aria-current` plus
 * a solid left border, never by background colour alone. The list body scrolls
 * on its own so the pane height stays bounded inside the shell's main column.
 */
export function NoteList({
  notes,
  selectedId,
  query,
  loading,
  creating,
  onQueryChange,
  onSelect,
  onNewNote,
  onClearSearch,
}: NoteListProps) {
  const showNoNotesYet = notes.length === 0 && query.trim() === "";
  const showNoMatches = notes.length === 0 && query.trim() !== "";
  const emptyCopy = describeEmptyNotes(query);

  return (
    <section
      aria-label="Note list"
      className="flex min-h-0 min-w-0 flex-col border border-border bg-card"
    >
      <div className="flex items-center gap-2 border-b border-border p-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search title and content…"
            aria-label="Search notes"
            className="pl-8"
          />
        </div>
        <Button variant="primary" size="sm" onClick={onNewNote} disabled={creating}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New note
        </Button>
      </div>

      <p className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        {loading && notes.length === 0 ? "Loading notes…" : noteCountLabel(notes.length, query)}
      </p>

      {notes.length > 0 ? (
        <ul className="min-h-0 flex-1 overflow-y-auto lg:max-h-[calc(100vh-14rem)]">
          {notes.map((note) => {
            const selected = note.id === selectedId;
            return (
              <li key={note.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => onSelect(note.id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-none border-l-2 px-3 py-2 text-left",
                    "transition-colors duration-150",
                    selected
                      ? "border-l-primary bg-secondary"
                      : "border-l-transparent hover:bg-secondary/60",
                  )}
                >
                  <span className="block truncate text-sm font-medium text-foreground">
                    {note.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatShortUpdated(note.updatedAt)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : loading ? (
        <div className="flex min-h-40 items-center justify-center p-4">
          <LoadingState label="Loading notes…" />
        </div>
      ) : (
        <div className="p-3">
          <EmptyState
            icon={Search}
            title={emptyCopy.title}
            description={emptyCopy.description}
            action={
              showNoMatches ? (
                <Button variant="secondary" size="sm" onClick={onClearSearch}>
                  Clear search
                </Button>
              ) : showNoNotesYet ? (
                <Button variant="primary" size="sm" onClick={onNewNote} disabled={creating}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  New note
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
    </section>
  );
}
