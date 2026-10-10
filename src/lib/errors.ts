/**
 * Error → user-safe message (T-013/T-014: single source after the review
 * found 12 duplicated copies).
 *
 * Data-layer errors (`DataError`, `ValidationError`) already carry a message
 * that is safe to show; anything else falls back to the caller's
 * feature-specific copy. Never log or display raw driver errors.
 */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
}
