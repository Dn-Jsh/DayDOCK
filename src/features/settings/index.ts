/**
 * Public surface of the settings feature (T-009).
 *
 * `SettingsPage` stays the default export of `SettingsPage.tsx` — the router
 * imports that file directly and the name is a route contract.
 */
export { default, default as SettingsPage } from "./SettingsPage";
export {
  FOCUS_DURATION_PRESETS,
  MAX_FOCUS_MINUTES,
  MIN_FOCUS_MINUTES,
  parseFocusMinutesInput,
} from "./focusDuration";
export {
  ABOUT_OFFLINE_LINE,
  ABOUT_PLATFORM_LINE,
  EXPORT_INCLUDES_LINE,
  RESTORE_LIMITATION_LINE,
  STORAGE_LOCATION_LINE,
} from "./settingsCopy";
