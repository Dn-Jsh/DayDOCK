# DayDock — backlog (post-MVP)

Items here are intentionally out of the MVP. Nothing in this file is scheduled work.

- Backup **restore/import** with schema validation and merge/replace choice.
- Rich text / Markdown notes, tags and pinning.
- Recurring tasks, subtasks, task ordering and drag-and-drop.
- Calendar view and deadline notifications/reminders.
- Focus sessions linked to a selected task from the timer UI; break timer + long break.
- Multiple workspaces, theming accents, custom sidebar density.
- Keyboard shortcut reference sheet and command palette.
- Data import from other tools (CSV).
- Automatic rolling backups of `daydock.db`.
- Code signing and Windows installer branding (custom icons).
- Telemetry: none. Ever, unless explicitly requested.

## Accepted review follow-ups (round-2 findings, non-blocking)

Recorded from the round-2 reviews that APPROVED candidate `79b23ba`
(tickets.md, final section). Both reviewers explicitly rated these as not
blocking; they are known-defect follow-ups, not MVP features:

- **Chunk coupling (Juan, Minor):** `FocusSessionCard.tsx` imports
  `computeFocusProgress` from the `../focus` barrel, which statically
  re-exports `FocusPage` — Today's chunk therefore statically imports the
  FocusPage chunk (~10.6 KB) in the built output. Fix = import from
  `../focus/timer` directly or move the helper to a neutral module. Same
  coupling class already fixed twice (App.tsx/TodayPage direct imports).
- **Test gaps for repaired wiring (Laura, Minor):** no component test for the
  `FOCUS_COMPLETION_EVENT` listener in `TodayPage` (event → reload → card
  gone) or the NotesPage delete/refresh failure paths (dialog stays open +
  `role="alert"` banner). Behavior currently proven by code reading + the
  coordinator's live native probe.
- **`role="alert"` carry-over (Laura, Nit):** the focus-duration field error
  in `SettingsPage` is the only inline field error still missing it (wired
  via `aria-invalid`/`aria-describedby`, so 3.3.1 is met; nothing announces
  on render). One-word fix; fell outside T-013's "tasks/projects forms" scope.
- **Duplicated duration range (Juan, Nit):** `FocusPage` hardcodes 1/180
  instead of importing `LIMITS` from `src/data/validation.ts` (values match
  today; drift risk only).
- **Stale comment (Laura, Nit):** `SettingsPage` comment about `value=""` is
  contradicted by `SelectField`'s placeholder normalization (no runtime
  effect).
- **Observed, no action (Juan, Nit):** a pause landing inside the watcher's
  ≤1 s window after the deadline is superseded by completion — intended
  behavior, sub-second window.
