/**
 * Pure helpers around the note search box (T-007).
 *
 * The actual matching is implemented once, in `src/data/repositories/notes.ts`
 * (case-insensitive `LIKE` over title and content). This module only shapes what
 * the UI says about the query — normalization for display, the result count,
 * and which empty state applies — so none of that logic lives in a component
 * and all of it is unit-testable.
 */

/** A trimmed query; empty string means "no filter, list everything". */
export function normalizeQuery(raw: string): string {
  return raw.trim();
}

/** True when the query should filter the list. */
export function hasActiveQuery(raw: string): boolean {
  return normalizeQuery(raw).length > 0;
}

/** Result-count line: "3 notes" while browsing, `2 matches for "meeting"` while searching. */
export function noteCountLabel(count: number, rawQuery: string): string {
  const query = normalizeQuery(rawQuery);
  if (query.length === 0) {
    return `${count} ${count === 1 ? "note" : "notes"}`;
  }
  return `${count} ${count === 1 ? "match" : "matches"} for “${query}”`;
}

export interface EmptyNotesCopy {
  title: string;
  description: string;
}

/**
 * Distinguishes the two empty situations: no notes exist at all versus the
 * current search matched nothing.
 */
export function describeEmptyNotes(rawQuery: string): EmptyNotesCopy {
  const query = normalizeQuery(rawQuery);
  if (query.length === 0) {
    return {
      title: "No notes yet",
      description: "Create a note to capture anything you want to remember.",
    };
  }
  return {
    title: `No notes match “${query}”`,
    description: "Try a different search term, or clear the search to see every note.",
  };
}
