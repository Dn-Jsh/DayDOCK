import { describe, expect, it } from "vitest";
import { describeEmptyNotes, hasActiveQuery, normalizeQuery, noteCountLabel } from "./noteSearch";

describe("normalizeQuery", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeQuery("  meeting  ")).toBe("meeting");
  });

  it("keeps interior spacing and case", () => {
    expect(normalizeQuery("Weekly  Review")).toBe("Weekly  Review");
  });

  it("normalizes whitespace-only input to an empty string", () => {
    expect(normalizeQuery("   \t ")).toBe("");
  });
});

describe("hasActiveQuery", () => {
  it("is false for empty and whitespace-only queries", () => {
    expect(hasActiveQuery("")).toBe(false);
    expect(hasActiveQuery("   ")).toBe(false);
  });

  it("is true when any non-space character is present", () => {
    expect(hasActiveQuery("a")).toBe(true);
    expect(hasActiveQuery(" a ")).toBe(true);
  });
});

describe("noteCountLabel", () => {
  it("pluralizes the browsing label", () => {
    expect(noteCountLabel(0, "")).toBe("0 notes");
    expect(noteCountLabel(1, "")).toBe("1 note");
    expect(noteCountLabel(5, "")).toBe("5 notes");
  });

  it("reports match count and the trimmed query while searching", () => {
    expect(noteCountLabel(1, "meeting")).toBe('1 match for “meeting”');
    expect(noteCountLabel(3, "  meeting  ")).toBe('3 matches for “meeting”');
    expect(noteCountLabel(0, "meeting")).toBe('0 matches for “meeting”');
  });
});

describe("describeEmptyNotes", () => {
  it("offers creation when no notes exist yet", () => {
    const copy = describeEmptyNotes("");
    expect(copy.title).toBe("No notes yet");
    expect(copy.description).toContain("Create a note");
  });

  it("distinguishes a search with no matches", () => {
    const copy = describeEmptyNotes("  meeting ");
    expect(copy.title).toBe("No notes match “meeting”");
    expect(copy.description).toContain("clear the search");
  });
});
