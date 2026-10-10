import { describe, it, expect } from "vitest";
import { toErrorMessage } from "./errors";

describe("toErrorMessage", () => {
  it("returns the error's own message when present", () => {
    expect(toErrorMessage(new Error("Could not save."), "fallback")).toBe(
      "Could not save.",
    );
  });

  it("falls back for an Error with a blank message", () => {
    expect(toErrorMessage(new Error("   "), "fallback")).toBe("fallback");
  });

  it("falls back for non-Error values", () => {
    expect(toErrorMessage("boom", "fallback")).toBe("fallback");
    expect(toErrorMessage(null, "fallback")).toBe("fallback");
    expect(toErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(toErrorMessage({ message: 42 }, "fallback")).toBe("fallback");
  });
});
