/**
 * Public surface of the notes feature (T-007).
 *
 * `NotesPage` stays the default export of `NotesPage.tsx` — the router imports
 * that file directly. The pure helpers are exported here too so tests and other
 * tickets can consume them without reaching into internals.
 */
export { default, default as NotesPage } from "./NotesPage";
export { NoteList, type NoteListProps } from "./NoteList";
export { NoteEditor, type NoteEditorProps } from "./NoteEditor";
export {
  AUTOSAVE_DELAY_MS,
  createAutoSaver,
  saveStatusLabel,
  type AutoSaver,
  type AutoSaverOptions,
  type SaveStatus,
} from "./autosave";
export {
  describeEmptyNotes,
  hasActiveQuery,
  normalizeQuery,
  noteCountLabel,
  type EmptyNotesCopy,
} from "./noteSearch";
export { formatFullUpdated, formatShortUpdated } from "./noteTime";
