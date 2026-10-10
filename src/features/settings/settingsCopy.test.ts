/**
 * Pins the honesty-critical Settings copy (T-009): the export section must
 * state exactly what is included and must plainly say that restoring a
 * backup is not available in this version. PROJECT-BRIEF.md forbids implying
 * that restore exists, so these strings are test-protected.
 */
import { describe, expect, it } from "vitest";
import {
  ABOUT_OFFLINE_LINE,
  ABOUT_PLATFORM_LINE,
  EXPORT_INCLUDES_LINE,
  RESTORE_LIMITATION_LINE,
  STORAGE_LOCATION_LINE,
} from "./settingsCopy";

describe("settings copy", () => {
  it("states the restore limitation plainly", () => {
    expect(RESTORE_LIMITATION_LINE).toBe(
      "Export only — restoring a backup is not available in this version.",
    );
    expect(RESTORE_LIMITATION_LINE).not.toMatch(/import/i);
  });

  it("lists every supported table in the export description", () => {
    for (const word of ["project", "task", "note", "focus session", "settings"]) {
      expect(EXPORT_INCLUDES_LINE.toLowerCase()).toContain(word);
    }
  });

  it("describes the storage location without fabricating an absolute path", () => {
    expect(STORAGE_LOCATION_LINE).toContain("daydock.db");
    expect(STORAGE_LOCATION_LINE).toContain("application-data");
    /* No fabricated drive path (e.g. C:\...) may appear in the copy. */
    expect(STORAGE_LOCATION_LINE).not.toMatch(/[A-Za-z]:\\/);
    expect(STORAGE_LOCATION_LINE).not.toMatch(/^\//);
  });

  it("keeps the About facts accurate", () => {
    expect(ABOUT_OFFLINE_LINE).toBe("Works fully offline — no account, no cloud.");
    expect(ABOUT_PLATFORM_LINE).toContain("Windows");
    expect(ABOUT_PLATFORM_LINE).toContain("Tauri 2");
  });
});
