import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task, TaskFilter } from "../../data/contracts";
import TasksPage, { TASK_SEARCH_DEBOUNCE_MS } from "./TasksPage";

const { listTasks, listProjects, mockData } = vi.hoisted(() => {
  const listTasks = vi.fn();
  const listProjects = vi.fn();
  return {
    listTasks,
    listProjects,
    /* One stable object: the real provider hands out the same data layer on
       every render (a new identity per render would churn every effect). */
    mockData: { tasks: { list: listTasks }, projects: { list: listProjects } },
  };
});

vi.mock("../../app/DataProvider", () => ({
  useData: () => mockData,
}));

/** `data.tasks.list()` calls that carried a filter (one per committed query). */
function filteredCalls(): TaskFilter[] {
  return listTasks.mock.calls
    .filter((args) => args.length > 0)
    .map((args) => args[0] as TaskFilter);
}

function queries(): (string | undefined)[] {
  return filteredCalls().map((filter) => filter.query);
}

function taskWithId(id: number, title: string): Task {
  return {
    id,
    title,
    description: "",
    status: "pending",
    priority: "medium",
    dueDate: null,
    projectId: null,
    createdAt: "2026-10-10T09:00:00.000Z",
    updatedAt: "2026-10-10T09:00:00.000Z",
    completedAt: null,
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    /* Flushes pending save/load microtasks without touching the clock. */
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe("TasksPage search debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    listTasks.mockReset();
    listTasks.mockResolvedValue([]);
    listProjects.mockReset();
    listProjects.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("queries once per pause, not once per keystroke", async () => {
    render(<TasksPage />);
    await settle();
    expect(queries()).toEqual([""]); /* initial load only */

    const search = screen.getByLabelText("Search");
    fireEvent.change(search, { target: { value: "a" } });
    fireEvent.change(search, { target: { value: "ab" } });
    fireEvent.change(search, { target: { value: "abc" } });

    /* The draft feeds the input immediately — no typing lag. */
    expect(search).toHaveValue("abc");

    await advance(TASK_SEARCH_DEBOUNCE_MS - 1);
    expect(queries()).toEqual([""]); /* still inside the debounce window */

    await advance(1);
    await settle();
    expect(queries()).toEqual(["", "abc"]); /* one query for all three keystrokes */
    expect(search).toHaveValue("abc");
  });

  it("keeps every committed update in order (no lost keystrokes)", async () => {
    render(<TasksPage />);
    await settle();

    const search = screen.getByLabelText("Search");
    fireEvent.change(search, { target: { value: "ab" } });
    await advance(TASK_SEARCH_DEBOUNCE_MS);
    await settle();

    fireEvent.change(search, { target: { value: "abc" } });
    await advance(TASK_SEARCH_DEBOUNCE_MS);
    await settle();

    expect(queries()).toEqual(["", "ab", "abc"]);
    const committed = filteredCalls();
    expect(committed[committed.length - 1]).toMatchObject({ query: "abc" });
  });

  it("drops the pending query when filters are cleared mid-debounce", async () => {
    render(<TasksPage />);
    await settle();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Search")).toHaveValue("");

    await advance(TASK_SEARCH_DEBOUNCE_MS * 3);
    await settle();

    /* The cancelled debounce must not resurrect "abc" after the clear. */
    expect(queries()).not.toContain("abc");
  });

  it("drops the pending query when the page unmounts before it commits", async () => {
    const view = render(<TasksPage />);
    await settle();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "abc" } });
    view.unmount();

    await advance(TASK_SEARCH_DEBOUNCE_MS * 3);
    expect(queries()).toEqual([""]); /* only the initial load ever ran */
  });

  it("ignores a stale response when two committed loads overlap", async () => {
    let releaseSlow!: () => void;
    const slowGate = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    listTasks.mockImplementation(async (filter?: TaskFilter) => {
      if (filter?.query === "slow") {
        await slowGate;
        return [taskWithId(1, "stale result")];
      }
      if (filter?.query === "fast") {
        return [taskWithId(2, "fresh result")];
      }
      return [];
    });

    render(<TasksPage />);
    await settle();

    const search = screen.getByLabelText("Search");
    fireEvent.change(search, { target: { value: "slow" } });
    await advance(TASK_SEARCH_DEBOUNCE_MS); /* load 1 starts, hangs on the gate */

    fireEvent.change(search, { target: { value: "fast" } });
    await advance(TASK_SEARCH_DEBOUNCE_MS); /* load 2 starts and resolves */
    await settle();
    expect(screen.getByText("fresh result")).toBeInTheDocument();

    /* The older response lands last and must not clobber the newer one. */
    releaseSlow();
    await settle();
    expect(screen.queryByText("stale result")).not.toBeInTheDocument();
    expect(screen.getByText("fresh result")).toBeInTheDocument();
  });
});
