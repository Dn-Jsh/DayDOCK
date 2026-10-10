/**
 * Retry recovery for the data layer (T-014, review finding: the rejected
 * promise was cached, so the app-wide error screen's Retry re-awaited the
 * same failure forever).
 *
 * Each test starts from a fresh module registry (`vi.resetModules`) because
 * `db.ts` / `index.ts` cache their promises at module scope — the regression
 * here is precisely about what those caches hold after a failure.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const driver = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: driver.load } }));

/** Stand-in connection handed out by a successful `Database.load`. */
const fakeDatabase = { select: vi.fn(), execute: vi.fn() };

beforeEach(() => {
  vi.resetModules();
  driver.load.mockReset();
  fakeDatabase.select.mockReset();
  fakeDatabase.execute.mockReset();
});

async function freshDb() {
  return import("./db");
}

async function freshIndex() {
  return import("./index");
}

async function freshContracts() {
  return import("./contracts");
}

/** Awaits a promise expected to reject and returns the rejection value. */
async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error("Expected the operation to reject, but it resolved.");
}

describe("getDatabase()", () => {
  it("does not cache a failed load: the next call re-attempts and can succeed", async () => {
    const { getDatabase } = await freshDb();
    const { DataError } = await freshContracts();
    driver.load
      .mockRejectedValueOnce(new Error("plugin unavailable"))
      .mockResolvedValueOnce(fakeDatabase);

    const firstError = await rejectionOf(getDatabase());
    expect(firstError).toBeInstanceOf(DataError);
    expect(firstError.message).toBe("Could not open the local database.");
    expect(firstError.message).not.toContain("plugin unavailable");
    expect(driver.load).toHaveBeenCalledTimes(1);

    /* The regression: this second call must hit `Database.load` again,
       not re-await the cached rejection. */
    await expect(getDatabase()).resolves.toBe(fakeDatabase);
    expect(driver.load).toHaveBeenCalledTimes(2);

    /* Once recovered, the successful connection IS cached. */
    await expect(getDatabase()).resolves.toBe(fakeDatabase);
    expect(driver.load).toHaveBeenCalledTimes(2);
  });
});

describe("getData()", () => {
  it("does not cache a failed load: the second getData() recovers with repositories", async () => {
    const { getData } = await freshIndex();
    const { DataError } = await freshContracts();
    driver.load
      .mockRejectedValueOnce(new Error("plugin unavailable"))
      .mockResolvedValueOnce(fakeDatabase);

    const firstError = await rejectionOf(getData());
    expect(firstError).toBeInstanceOf(DataError);
    expect(driver.load).toHaveBeenCalledTimes(1);

    const data = await getData();
    expect(data.tasks).toBeDefined();
    expect(data.projects).toBeDefined();
    expect(data.notes).toBeDefined();
    expect(data.focusSessions).toBeDefined();
    expect(data.focusState).toBeDefined();
    expect(data.settings).toBeDefined();
    expect(driver.load).toHaveBeenCalledTimes(2);

    /* The recovered aggregate is cached: no third load. */
    await getData();
    expect(driver.load).toHaveBeenCalledTimes(2);
  });

  it("propagates the data layer's DataError unchanged on failure", async () => {
    const { getData } = await freshIndex();
    const { DataError } = await freshContracts();
    driver.load.mockRejectedValueOnce(new Error("plugin unavailable"));

    const error = await rejectionOf(getData());
    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe("Could not open the local database.");
  });
});

describe("select() / execute()", () => {
  it("wraps driver read failures in DataError without leaking driver text", async () => {
    const { select } = await freshDb();
    driver.load.mockResolvedValue(fakeDatabase);
    fakeDatabase.select.mockRejectedValueOnce(new Error("SQLITE_CORRUPT: table notes"));

    const error = await rejectionOf(select("SELECT content FROM notes"));
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DataError");
    expect(error.message).toBe("Could not read data from local storage.");
    expect(error.message).not.toContain("SQLITE_CORRUPT");
    expect(error.message).not.toContain("notes");
  });

  it("wraps driver write failures in DataError without leaking driver text", async () => {
    const { execute } = await freshDb();
    driver.load.mockResolvedValue(fakeDatabase);
    fakeDatabase.execute.mockRejectedValueOnce(new Error("SQLITE_BUSY: locked"));

    const error = await rejectionOf(execute("DELETE FROM focus_state WHERE id = ?", [1]));
    expect(error.name).toBe("DataError");
    expect(error.message).toBe("Could not save data to local storage.");
    expect(error.message).not.toContain("SQLITE_BUSY");
  });
});
