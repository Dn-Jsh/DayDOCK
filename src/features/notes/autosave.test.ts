import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_DELAY_MS, createAutoSaver, saveStatusLabel, type SaveStatus } from "./autosave";

/** Flushes the microtask queue so already-resolved save promises settle. */
async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createAutoSaver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces rapid schedules into a single write after the 500ms delay", async () => {
    const save = vi.fn(async () => {});
    const statuses: SaveStatus[] = [];
    const saver = createAutoSaver({
      save,
      onStatusChange: (status) => statuses.push(status),
    });

    saver.schedule();
    vi.advanceTimersByTime(200);
    saver.schedule();
    vi.advanceTimersByTime(200);
    saver.schedule();

    /* Still inside the debounce window — no write yet. */
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    await flushPromises();

    expect(statuses).toEqual(["pending", "saving", "saved"]);
    expect(saver.status).toBe("saved");
    expect(saver.hasPendingChanges()).toBe(false);
  });

  it("restarts the debounce window on every change", async () => {
    const save = vi.fn(async () => {});
    const saver = createAutoSaver({ save });

    saver.schedule();
    vi.advanceTimersByTime(400);
    saver.schedule(); /* pushes the write out by another 500ms */
    vi.advanceTimersByTime(400);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(save).toHaveBeenCalledTimes(1);
    await flushPromises();
  });

  it("runNow() bypasses the debounce and writes immediately", async () => {
    const save = vi.fn(async () => {});
    const saver = createAutoSaver({ save });

    saver.schedule();
    vi.advanceTimersByTime(100);
    saver.runNow();
    expect(save).toHaveBeenCalledTimes(1);
    await flushPromises();
    expect(saver.status).toBe("saved");

    /* The bypassed timer must not fire a second write. */
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("runNow() is a no-op when there is nothing to save or retry", () => {
    const save = vi.fn(async () => {});
    const saver = createAutoSaver({ save });

    saver.runNow();
    expect(save).not.toHaveBeenCalled();
    expect(saver.status).toBe("idle");
  });

  it("reports the error and retries successfully via runNow()", async () => {
    const save = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("disk unavailable"))
      .mockResolvedValueOnce(undefined);
    const errors: unknown[] = [];
    const statuses: SaveStatus[] = [];
    const saver = createAutoSaver({
      save,
      onStatusChange: (status) => statuses.push(status),
      onError: (error) => errors.push(error),
    });

    saver.schedule();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    await flushPromises();

    expect(saver.status).toBe("error");
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe("disk unavailable");

    saver.runNow();
    expect(save).toHaveBeenCalledTimes(2);
    await flushPromises();
    expect(saver.status).toBe("saved");
    expect(statuses).toEqual(["pending", "saving", "error", "saving", "saved"]);
  });

  it("keeps a change typed during an in-flight write and writes it again", async () => {
    let resolveFirst!: () => void;
    const save = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(undefined);
    const saver = createAutoSaver({ save });

    saver.schedule();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1); /* first write in flight */

    /* User keeps typing while the first write is running. */
    saver.schedule();
    expect(saver.hasPendingChanges()).toBe(true);

    resolveFirst();
    await flushPromises();
    /* The in-flight result must not claim "saved" — the newer change is pending. */
    expect(saver.status).toBe("pending");

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(2);
    await flushPromises();
    expect(saver.status).toBe("saved");
  });

  it("cancel() stops the pending write and detaches further reporting", async () => {
    const save = vi.fn(async () => {});
    const statuses: SaveStatus[] = [];
    const saver = createAutoSaver({
      save,
      onStatusChange: (status) => statuses.push(status),
    });

    saver.schedule();
    expect(saver.hasPendingChanges()).toBe(true);
    saver.cancel();
    expect(saver.hasPendingChanges()).toBe(false);

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    expect(save).not.toHaveBeenCalled();

    /* Scheduling after cancel is ignored — the UI is gone. */
    statuses.length = 0;
    saver.schedule();
    await flushPromises();
    expect(statuses).toEqual([]);
  });

  it("cancel() with an in-flight write and a newer change still persists the newest content", async () => {
    let resolveFirst!: () => void;
    const writeOrder: string[] = [];
    let content = "first";
    const save = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            writeOrder.push(content);
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(async () => {
        writeOrder.push(content);
      });

    const saver = createAutoSaver({ save });
    saver.schedule();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS); /* "first" is in flight */

    content = "second";
    saver.schedule(); /* newer change, timer armed */
    saver.cancel(); /* unmount before the timer fires */

    resolveFirst();
    await flushPromises();

    /* The queued final write ran with the newest content. */
    expect(writeOrder).toEqual(["first", "second"]);
    /* Detached: the status froze at its last reported value — no "saved" is
       announced to an unmounted editor. */
    expect(saver.status).toBe("pending");
  });

  it("hasPendingChanges() reflects the debounce window", async () => {
    const save = vi.fn(async () => {});
    const saver = createAutoSaver({ save });

    expect(saver.hasPendingChanges()).toBe(false);
    saver.schedule();
    expect(saver.hasPendingChanges()).toBe(true);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    await flushPromises();
    expect(saver.hasPendingChanges()).toBe(false);
  });
});

describe("saveStatusLabel", () => {
  it("maps every status to a stable label", () => {
    expect(saveStatusLabel("idle")).toBe("Saved");
    expect(saveStatusLabel("pending")).toBe("Saving…");
    expect(saveStatusLabel("saving")).toBe("Saving…");
    expect(saveStatusLabel("saved")).toBe("Saved");
    expect(saveStatusLabel("error")).toBe("Save failed");
  });
});
