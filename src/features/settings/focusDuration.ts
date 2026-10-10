/**
 * Pure helpers for the focus-duration control on the Settings page (T-009).
 *
 * The validation rules themselves live in the data layer
 * (`validateFocusDurationMinutes` in `src/data/validation.ts`); this module
 * only adapts the input field's raw text to that single source of truth, so
 * the Settings page and the repositories can never disagree about the range.
 */
import { ValidationError } from "../../data/contracts";
import { LIMITS, validateFocusDurationMinutes } from "../../data/validation";

export const MIN_FOCUS_MINUTES = LIMITS.focusMinutesMin;
export const MAX_FOCUS_MINUTES = LIMITS.focusMinutesMax;

/** Preset durations offered next to the free numeric input (all within 1–180). */
export const FOCUS_DURATION_PRESETS = [15, 25, 30, 45, 60, 90, 120, 180] as const;

/**
 * Converts the number input's raw text to validated minutes.
 * Throws `ValidationError` keyed on `focusDurationMinutes` for empty,
 * non-integer or out-of-range values; the caller keeps the typed text and
 * renders the message inline.
 */
export function parseFocusMinutesInput(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new ValidationError({
      focusDurationMinutes: `Enter a focus duration between ${MIN_FOCUS_MINUTES} and ${MAX_FOCUS_MINUTES} minutes`,
    });
  }
  return validateFocusDurationMinutes(Number(trimmed));
}
