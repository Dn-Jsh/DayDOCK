/**
 * Single access point to the local SQLite database.
 *
 * `Database.load` is called lazily; a successful load is cached so every
 * repository shares one connection and one migration run, while a failed load
 * is *not* cached (Retry must genuinely re-attempt). Driver failures are
 * converted to `DataError` with a fixed, user-safe message — SQL text, bind
 * parameters and row content never appear in an error message.
 */
import Database from "@tauri-apps/plugin-sql";
import { DataError } from "./contracts";

const DATABASE_URL = "sqlite:daydock.db";

let databasePromise: Promise<Database> | null = null;

/**
 * Opens (or returns the already-opening) database connection. A successful
 * load is cached for the app run so every repository shares one connection;
 * a failure is converted to `DataError` and the cache slot is cleared inside
 * the rejection handler, so the next call (the app-wide Retry button)
 * genuinely re-attempts instead of re-awaiting the same rejection forever.
 */
export function getDatabase(): Promise<Database> {
  if (databasePromise === null) {
    databasePromise = Database.load(DATABASE_URL).catch((error: unknown) => {
      /* Never cache a rejected promise: clear the slot before rethrowing so
         Retry re-runs `Database.load` rather than re-awaiting this failure. */
      databasePromise = null;
      throw new DataError("Could not open the local database.", { cause: error });
    });
  }
  return databasePromise;
}

/**
 * Runs a read query and returns its rows. On failure a `DataError` with a
 * fixed message is thrown; the original driver error is only attached as
 * `cause`, never interpolated into the message.
 */
export async function select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const database = await getDatabase();
  try {
    return await database.select<T[]>(sql, params);
  } catch (error) {
    throw new DataError("Could not read data from local storage.", { cause: error });
  }
}

/** Result of a write statement. */
export interface WriteResult {
  rowsAffected: number;
  lastInsertId: number | undefined;
}

/**
 * Runs a write statement. On failure a `DataError` with a fixed message is
 * thrown; the original driver error is only attached as `cause`.
 */
export async function execute(sql: string, params: unknown[] = []): Promise<WriteResult> {
  const database = await getDatabase();
  try {
    const result = await database.execute(sql, params);
    return {
      rowsAffected: result.rowsAffected,
      lastInsertId: result.lastInsertId,
    };
  } catch (error) {
    throw new DataError("Could not save data to local storage.", { cause: error });
  }
}
