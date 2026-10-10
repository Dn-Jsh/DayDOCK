import { describe, expect, it } from "vitest";
import { ValidationError } from "../../data/contracts";
import { LIMITS } from "../../data/validation";
import { FOCUS_DURATION_PRESETS, parseFocusMinutesInput } from "./focusDuration";

describe("parseFocusMinutesInput", () => {
  it("accepts whole minutes inside the 1–180 range", () => {
    expect(parseFocusMinutesInput("25")).toBe(25);
    expect(parseFocusMinutesInput("1")).toBe(LIMITS.focusMinutesMin);
    expect(parseFocusMinutesInput("180")).toBe(LIMITS.focusMinutesMax);
    expect(parseFocusMinutesInput(" 45 ")).toBe(45);
  });

  it("throws a ValidationError keyed on focusDurationMinutes for empty input", () => {
    expect.assertions(2);
    try {
      parseFocusMinutesInput("   ");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fieldErrors.focusDurationMinutes).toBeTruthy();
    }
  });

  it("rejects non-numeric, fractional and out-of-range values", () => {
    for (const raw of ["abc", "25.5", "0", "-10", "181", "1e300"]) {
      expect(() => parseFocusMinutesInput(raw), `expected "${raw}" to be rejected`).toThrow(
        ValidationError,
      );
    }
  });

  it("offers presets that are all valid durations", () => {
    for (const minutes of FOCUS_DURATION_PRESETS) {
      expect(parseFocusMinutesInput(String(minutes))).toBe(minutes);
    }
  });
});
