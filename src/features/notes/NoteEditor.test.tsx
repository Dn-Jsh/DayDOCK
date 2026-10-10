import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../../data/contracts";
import { AUTOSAVE_DELAY_MS } from "./autosave";
import { NoteEditor, type NoteEditorProps } from "./NoteEditor";

const BASE_NOTE: Note = {
  id: 1,
  title: "Groceries",
  content: "milk",
  createdAt: "2026-10-10T08:00:00.000Z",
  updatedAt: "2026-10-10T09:00:00.000Z",
};

const OTHER_NOTE: Note = {
  id: 2,
  title: "Second note",
  content: "different content",
  createdAt: "2026-10-10T08:30:00.000Z",
  updatedAt: "2026-10-10T09:30:00.000Z",
};

interface Harness {
  onSave: NoteEditorProps["onSave"];
  onSaved: NoteEditorProps["onSaved"];
  onDelete: NoteEditorProps["onDelete"];
}

function createHarness(): Harness {
  return {
    onSave: vi.fn(async (patch) => ({ ...BASE_NOTE, ...patch })),
    onSaved: vi.fn(),
    onDelete: vi.fn(),
  };
}

function renderInStrictMode(note: Note, harness: Harness) {
  return render(
    <StrictMode>
      <NoteEditor
        key={note.id}
        note={note}
        onSave={harness.onSave}
        onSaved={harness.onSaved}
        onDelete={harness.onDelete}
      />
    </StrictMode>,
  );
}

/**
 * Regression coverage for T-013 Major #1: React StrictMode double-invokes the
 * mount effect (setup → cleanup → setup), and the cleanup used to cancel the
 * saver irreversibly — every editor was born detached, the UI claimed "Saved"
 * and nothing was ever written. The tests below mount the real editor under
 * `<StrictMode>` with fake timers and assert real writes.
 */
describe("NoteEditor auto-save under StrictMode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("saves typed content once the 500ms debounce elapses", async () => {
    const harness = createHarness();
    renderInStrictMode(BASE_NOTE, harness);

    fireEvent.change(screen.getByLabelText("Content"), {
      target: { value: "milk and bread" },
    });

    /* The saver must be armed: the status flips to the pending label. A
       detached saver would leave the label at "Saved" and never write. */
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });

    expect(harness.onSave).toHaveBeenCalledTimes(1);
    expect(harness.onSave).toHaveBeenCalledWith({
      title: "Groceries",
      content: "milk and bread",
    });
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("flushes a pending change when the editor unmounts", () => {
    const harness = createHarness();
    const { unmount } = renderInStrictMode(BASE_NOTE, harness);

    fireEvent.change(screen.getByLabelText("Content"), {
      target: { value: "typed just before closing" },
    });
    unmount();

    expect(harness.onSave).toHaveBeenCalledTimes(1);
    expect(harness.onSave).toHaveBeenCalledWith({
      title: "Groceries",
      content: "typed just before closing",
    });
  });

  it("flushes the previous note's pending change when the note switches", () => {
    const harness = createHarness();
    const view = renderInStrictMode(BASE_NOTE, harness);

    fireEvent.change(screen.getByLabelText("Content"), {
      target: { value: "edited draft" },
    });
    /* A different `key` remotes the editor exactly like NotesPage's
       `key={selectedNote.id}`: old instance unmounts, new one mounts. */
    view.rerender(
      <StrictMode>
        <NoteEditor
          key={OTHER_NOTE.id}
          note={OTHER_NOTE}
          onSave={harness.onSave}
          onSaved={harness.onSaved}
          onDelete={harness.onDelete}
        />
      </StrictMode>,
    );

    expect(harness.onSave).toHaveBeenCalledTimes(1);
    expect(harness.onSave).toHaveBeenCalledWith({
      title: "Groceries",
      content: "edited draft",
    });
    expect(screen.getByLabelText("Title")).toHaveValue("Second note");
  });
});
