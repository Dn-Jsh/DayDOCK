/**
 * Small helpers shared by every repository. No SQL lives here — each
 * repository owns its own statements.
 */
import { DataError, type Instant } from "../contracts";

/** `DataError` for operations that targeted a row which does not exist. */
export function notFoundError(entity: string): DataError {
  return new DataError(`${entity} not found.`);
}

/** The current instant as an ISO-8601 UTC string. */
export function nowInstant(): Instant {
  return new Date().toISOString();
}

/**
 * Wraps a user-supplied search term in a case-insensitive `LIKE` pattern,
 * escaping `%`, `_` and `\` so they are matched literally. Use together with
 * `ESCAPE '\'` in the SQL statement.
 */
export function likeContainsPattern(query: string): string {
  const escaped = query.toLowerCase().replace(/[\\%_]/g, (character) => `\\${character}`);
  return `%${escaped}%`;
}
