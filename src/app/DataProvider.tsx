import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getData } from "../data/index";
import type { DayDockData } from "../data/contracts";
import { ErrorState } from "../components/ui/error-state";
import { LoadingState } from "../components/ui/loading-state";

export interface DataStatus {
  loading: boolean;
  error: string | null;
  data: DayDockData | null;
}

const DataStatusContext = createContext<DataStatus | null>(null);

/** DataError/ValidationError already carry user-safe messages; fall back anyway. */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "The local database could not be opened.";
}

/**
 * Loads the data layer exactly once for the whole app and owns the app-wide
 * loading / failure screens. Children mount only after `getData()` resolves,
 * so `useData()` can never hand out a null data layer. If `getData()` rejects,
 * an ErrorState with a Retry button re-runs it — there is no path that can
 * leave a spinner up forever.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DataStatus>({
    loading: true,
    error: null,
    data: null,
  });
  /* Distinguishes the latest attempt from stale promise callbacks (StrictMode
     double-invokes effects, and Retry supersedes any in-flight attempt). */
  const attemptRef = useRef(0);
  const dataPromiseRef = useRef<Promise<DayDockData> | null>(null);

  const run = useCallback(() => {
    const attempt = (attemptRef.current += 1);
    /* Explicit annotations keep this narrowing-safe even while `../data/index`
       is still being written by the data-layer ticket. */
    let dataPromise: Promise<DayDockData> | null = dataPromiseRef.current;
    if (!dataPromise) {
      const freshPromise: Promise<DayDockData> = getData();
      dataPromiseRef.current = freshPromise;
      dataPromise = freshPromise;
    }
    dataPromise.then(
      (data) => {
        if (attemptRef.current === attempt) {
          setStatus({ loading: false, error: null, data });
        }
      },
      (error: unknown) => {
        if (attemptRef.current === attempt) {
          setStatus({ loading: false, error: toErrorMessage(error), data: null });
        }
      },
    );
  }, []);

  const retry = useCallback(() => {
    dataPromiseRef.current = null;
    run();
  }, [run]);

  useEffect(() => {
    run();
  }, [run]);

  if (status.loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-foreground">
        <LoadingState label="Starting DayDock…" />
      </div>
    );
  }

  if (status.error !== null) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-6 text-foreground">
        <ErrorState message={status.error} onRetry={retry} />
      </div>
    );
  }

  return <DataStatusContext.Provider value={status}>{children}</DataStatusContext.Provider>;
}

/** Full data access for feature code. Throws outside a loaded DataProvider. */
export function useData(): DayDockData {
  const status = useContext(DataStatusContext);
  if (!status?.data) {
    throw new Error("useData() must be used inside a DataProvider whose data layer has loaded.");
  }
  return status.data;
}

/** Non-throwing view of the load state (useful for app-level status text). */
export function useDataStatus(): DataStatus {
  const status = useContext(DataStatusContext);
  if (!status) {
    throw new Error("useDataStatus() must be used inside a DataProvider.");
  }
  return status;
}
