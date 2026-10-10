# DayDock — ticket source

Owner of this file: coordinator (Rob). Status values: `To do`, `In progress`, `Review`,
`Testing`, `Done`, `Blocked`. A ticket only moves to `Done` when every acceptance
criterion has verification evidence recorded in its section below.

Milestones: **M1** foundation · **M2** database + tasks · **M3** projects + Today
dashboard · **M4** notes + focus timer · **M5** settings + backup export ·
**M6** testing, fixes, release verification.

Lanes: `Standard` = normal verification. `Gold` = strongest verification; requires
architecture/data-boundary review plus independent Juan and Laura approval of the same
final candidate.

## Ticket board

| ID | Milestone | Task | Owner | Risk | Lane | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-001 | M1 | Repository and Tauri/React foundation | Rob (coordinator) | Low | Standard | Done |
| T-002 | M2 | SQLite schema, migrations and typed data layer | Josh (`mimo-v2.6-flash-free`*) | High | Gold | Review |
| T-003 | M1 | App shell, design system, navigation and theme | Maya (`mimo-v2.6-flash-free`*) | Medium | Standard | Review |
| T-004 | M2 | Task management (CRUD, filters, search) | Maya (`gpt-6-luna`) | Medium | Gold | To do |
| T-005 | M3 | Project organization | Maya (`gpt-6-luna`) | Medium | Standard | To do |
| T-006 | M3 | Today dashboard | Maya (`gpt-6-luna`) | Medium | Standard | To do |
| T-007 | M4 | Quick notes | Maya (`gpt-6-luna`) | Low | Standard | To do |
| T-008 | M4 | Focus timer and session history | Josh (`gpt-6.1-sol`) | High | Gold | To do |
| T-009 | M5 | Settings and JSON backup export | Josh (`gpt-6.1-sol`) | Medium | Gold | To do |
| T-010 | M6 | Independent review, accessibility and test gaps | Laura (`gpt-6.1-sol`) | Medium | Standard | To do |
| T-011 | M6 | Architecture review of gold data boundaries | Juan (`gpt-6-luna`) | Medium | Gold | To do |
| T-012 | M6 | Build, packaging and release verification | Rob (coordinator) | Medium | Standard | To do |

Dependency chain: T-001 → (T-002 ∥ T-003) → T-004 → (T-005 ∥ T-006) → T-007 ∥ T-008 →
T-009 → (T-010 ∥ T-011) → T-012. No ticket starts while blocked.

---

## T-001 — Repository and Tauri/React foundation

- **Description:** Initialize the Git repository, add `AGENTS.md`, `PROJECT-BRIEF.md`,
  `.gitignore`, and scaffold Tauri 2 + React 19 + TypeScript + Vite + Tailwind v4 with
  build/test/typecheck scripts. Register the SQLite and dialog plugins.
- **Owner:** Rob (coordinator)
- **Dependencies:** none
- **Risk:** Low · **Lane:** Standard · **Status:** In progress

**Acceptance criteria**

1. Git repository initialized; `AGENTS.md`, `PROJECT-BRIEF.md`, `.gitignore` present.
2. `npm run typecheck` and `npm run build` succeed.
3. `cargo check` in `src-tauri` succeeds.
4. SQLite (`sqlite:daydock.db`, preloaded) and dialog plugins registered with
   least-privilege capabilities (`sql:default` + `sql:allow-execute`, `dialog:default`).
5. Dark-by-default design tokens exist in `src/index.css` and the app renders.

**Verification evidence** (2026-10-10, coordinator)

- `npm install` → `added 167 packages in 34s`.
- `npm run build` → `tsc && vite build` ✓ `dist/assets/index-*.js 219.79 kB`, built in 170ms.
- `cargo check` (src-tauri) → `EXIT=0`; single warning `unused import: MigrationKind`
  from the empty migrations stub, consumed by T-002.
- Capabilities verified against https://v2.tauri.app/plugin/sql/ :
  `sql:default` covers load/select/close, `sql:allow-execute` added for writes.
- Status: **Done** (pending final integration re-run in T-012).

---

## T-002 — SQLite schema, migrations and typed data layer

- **Description:** Implement the initial schema as migration v1 in
  `src-tauri/src/migrations.rs`, plus the typed frontend data layer:
  `src/data/db.ts`, `src/data/types.ts`, `src/data/validation.ts`,
  `src/data/repositories/{tasks,projects,notes,focusSessions,settings}.ts`.
  Business logic stays out of React components.
- **Owner:** Josh · **Dependencies:** T-001 · **Risk:** High · **Lane:** Gold
- **Status:** To do

**Owned files:** `src-tauri/src/migrations.rs`, `src/data/**` (nothing else).

**Acceptance criteria**

1. Migration v1 creates `projects`, `tasks`, `notes`, `focus_sessions`,
   `focus_state`, `settings` with the columns, constraints and indexes listed in the
   data contract, and is safe to re-run.
2. Every repository exposes the operations listed in the data contract and maps rows
   to camelCase domain types; no SQL string appears outside `src/data/**`.
3. All user input passes through `src/data/validation.ts` (title 1–200 chars, project
   name 1–60, note title 1–200, focus duration 1–180 minutes, due date `YYYY-MM-DD`);
   violations throw `ValidationError` with per-field messages.
4. Database failures surface as `DataError` with a safe message; no error path logs
   note content or any secret.
5. Vitest unit tests cover validation rules, row mapping and date/clock helpers
   (`npm test` green).
6. `cargo check` and `npm run typecheck` green.

**Verification evidence**

- Worker (Josh): `npm run typecheck` exit 0; `npm test` → 3 files / **64 tests passed**;
  `cargo check` → EXIT=0, no warnings. Files: `src-tauri/src/migrations.rs`,
  `src/data/{db,validation,index,contracts}.ts`, `src/data/repositories/*`,
  `src/lib/date.ts` + 3 test files.
- Coordinator re-run on the integrated candidate (2026-10-10): `npm run typecheck` exit 0,
  `npm test` → **64/64 passed**, `npm run build` exit 0, `cargo check` → `EXIT=0`.
- Deviation accepted: `DataError` attaches `cause` via `Object.assign` instead of
  `super(message, options)` (project targets ES2020 lib) — export shape unchanged.
- Gold-lane independent approvals: pending (T-011 Juan architecture/data-boundary,
  T-010 Laura behavior).

**Status: Review**

---

## T-003 — App shell, design system, navigation and theme

- **Description:** Build the desktop shell: compact sidebar navigation (Today, Tasks,
  Projects, Notes, Focus, Settings), page routing with lazy-loaded feature pages,
  shadcn-style UI primitives (`button`, `input`, `textarea`, `select`, `dialog`,
  `badge`, `checkbox`, empty/loading/error states), theme provider persisting
  dark/light to settings, and keyboard-accessible layout that responds to resizing.
- **Owner:** Maya · **Dependencies:** T-001 · **Risk:** Medium · **Lane:** Standard
- **Status:** To do

**Owned files:** `src/App.tsx`, `src/app/**`, `src/components/**`, `src/index.css`,
placeholder `src/features/<name>/<Name>Page.tsx` files.

**Acceptance criteria**

1. Sidebar shows the six pages with active state; navigation works by mouse and by
   keyboard (Tab/Enter, visible focus ring, `aria-current`).
2. Theme defaults to dark, toggles to light and persists across restart via the
   settings repository; `<html>` class and `color-scheme` follow the stored value.
3. UI primitives follow the design brief: sharp corners, neutral palette, subtle
   hover/transition, no gradients, consistent spacing, 14px body type.
4. Shell handles window resizing down to 940×600 without overflow; content scrolls.
5. Loading, empty and error state components exist and are reused by feature pages.
6. `npm run typecheck` and `npm run build` green.

**Verification evidence**

- Worker (Maya): final `tsc --noEmit` → EXIT=0, zero errors (the only mid-session error
  was the tolerated not-yet-landed `../data/index` module). Worker additionally drove the
  shell in a browser via computer-use: hash routing + reload persistence, skip-link as
  first tab stop, `aria-current="page"`, single `h1`, `main` has no horizontal scroll at
  900px, theme toggle verified both directions (`html.class` + `color-scheme`), dialog
  labelled by title + Escape closes, `Progress` requires a label.
- Coordinator re-run (2026-10-10): `npm run typecheck` exit 0; `npm run build` exit 0
  with lazy per-page chunks (`TodayPage`, `TasksPage`, … emitted separately).
- Not verifiable in this session: theme persistence across a real Tauri restart (needs
  T-012 native run); a literal 940×600 window (browser check ran at 900px width).
- Known leftover: one orphan `DayDock` browser tab opened by the worker's manual check;
  server stopped, tab is inert. No repo temp files left (verified by worker `grep`).

**Status: Review**

---

## T-004 — Task management

- **Description:** Full task feature: create (quick-add on Today plus a form),
  edit, complete/reopen, delete with confirmation, due date, priority, project
  assignment, filters (status/priority/project), and text search.
- **Owner:** Maya · **Dependencies:** T-002, T-003 · **Risk:** Medium · **Lane:** Gold
- **Status:** To do

**Owned files:** `src/features/tasks/**`.

**Acceptance criteria**

1. Every action in the description works against SQLite and survives restart.
2. Validation errors are shown inline, next to the offending field, without losing
   typed input.
3. Delete requires confirmation and states what will be removed.
4. Filters and search combine (AND) and show a clear empty state; result count shown.
5. Rows are keyboard operable; dialogs trap focus and close with Escape.
6. Unit tests for filter/search/pure task logic are green.

**Verification evidence:** (pending)

---

## T-005 — Project organization

- **Description:** Project list with create/rename/delete (confirm dialog that states
  tasks are kept and unassigned), project detail view listing that project's tasks,
  and a progress bar (completed/total).
- **Owner:** Maya · **Dependencies:** T-004 · **Risk:** Medium · **Lane:** Standard
- **Status:** To do

**Acceptance criteria**

1. Create, rename and delete work and persist; deleting a project never deletes tasks.
2. Project page lists only that project's tasks and shows accurate progress
   (completed/total, percentage).
3. Task→project assignment appears immediately in the project view.
4. Empty and error states covered; keyboard accessible.
5. `npm run typecheck` green.

**Verification evidence:** (pending)

---

## T-006 — Today dashboard

- **Description:** Dashboard with current date, today's tasks, overdue tasks,
  completed-today count, priority (high) tasks, active focus session card, and a
   quick-add task input. All figures derive from stored data.
- **Owner:** Maya · **Dependencies:** T-004 · **Risk:** Medium · **Lane:** Standard
- **Status:** To do

**Owned files:** `src/features/today/**`.

**Acceptance criteria**

1. Date shown is the real local date and updates on day change (re-render on focus).
2. Today = tasks with `due_date = today`; overdue = `due_date < today` and not
   completed; completed count = tasks completed today; priority = high priority and
   not completed. Each list shows real rows and links into the task feature.
3. Quick-add creates a real task with default priority/medium, no project, due today,
   and appears in the list immediately.
4. Active focus session card shows remaining time while a session runs.
5. Empty states for no tasks; all figures re-read from storage after changes.

**Verification evidence:** (pending)

---

## T-007 — Quick notes

- **Description:** Note list with search, create, delete with confirmation, and an
   auto-saving plain-text editor with title, content and visible "saved / saving"
   state plus updated timestamp.
- **Owner:** Maya · **Dependencies:** T-003, T-002 · **Risk:** Low · **Lane:** Standard
- **Status:** To do

**Owned files:** `src/features/notes/**`.

**Acceptance criteria**

1. Create/edit/delete persist across restart; search matches title and content.
2. Auto-save debounces (~500ms), shows saving/saved state, updates the timestamp, and
   never loses content on rapid typing.
3. Delete requires confirmation; empty states and keyboard navigation covered.
4. Unit tests for the debounce/search helpers are green.

**Verification evidence:** (pending)

---

## T-008 — Focus timer and session history

- **Description:** Configurable focus duration, start/pause/resume/reset, remaining
  time display, completed sessions saved to history, session history list. Elapsed
  time is computed from wall-clock timestamps so sleep/suspension and window blur are
  accurate; the active session survives restart.
- **Owner:** Josh · **Dependencies:** T-002, T-003 · **Risk:** High · **Lane:** Gold
- **Status:** To do

**Owned files:** `src/features/focus/**`.

**Acceptance criteria**

1. Start/pause/resume/reset all work; remaining time shown as mm:ss with `aria-live`
   announcement policy that does not spam screen readers.
2. Elapsed time derives from stored timestamps (`elapsed = elapsedBeforeMs + now −
   startedAt`), so system sleep, app suspension and pause are all accounted for.
3. A completed session is written to `focus_sessions` exactly once with the real
   duration; history lists stored sessions newest first and survives restart.
4. Active session state is persisted in `focus_state` and restored after restart.
5. Pure timing logic is unit-tested (fake timers, injected clock) and green.
6. `npm run typecheck` green.

**Verification evidence:** (pending)

---

## T-009 — Settings and JSON backup export

- **Description:** Settings page (theme, focus duration, app information) and local
  data export: writes a JSON backup of projects, tasks, notes, focus sessions and
  settings through the native save dialog.
- **Owner:** Josh · **Dependencies:** T-002, T-003, T-008 (focus duration setting
  consumed by the timer) · **Risk:** Medium · **Lane:** Gold · **Status:** To do

**Owned files:** `src/features/settings/**`, `src/data/export.ts`.

**Acceptance criteria**

1. Theme and focus duration edits persist to SQLite and take effect immediately.
2. Export opens a native save dialog (default name `daydock-backup-YYYY-MM-DD.json`)
   and writes valid JSON containing `app`, `exportedAt`, `version`, `projects`,
   `tasks`, `notes`, `focusSessions`, `settings`.
3. Exported payload round-trips through `JSON.parse` in a unit test and includes every
   stored row (count verified against the repositories).
4. The UI states plainly that export is a backup and that **restore/import is not
   available** in the MVP.
5. App information shows name, version and storage location.

**Verification evidence:** (pending)

---

## T-010 — Independent review, accessibility and test gaps

- **Description:** Laura independently verifies behavior of the integrated candidate:
  code review, security review, WCAG keyboard/contrast review, and fills meaningful
  test gaps. Fixes are applied by the owning implementer, not the reviewer.
- **Owner:** Laura · **Dependencies:** T-004…T-009 · **Risk:** Medium · **Lane:** Standard
- **Status:** To do

**Acceptance criteria**

1. Findings recorded per file with severity; each finding is fixed or rebutted with
   evidence before the ticket closes.
2. Keyboard-only walkthrough of all six pages verified (no traps, visible focus,
   labelled controls, dialog focus trap + Escape).
3. `npm test`, `npm run typecheck`, `npm run build` all green after fixes.
4. No secrets, note contents or credentials in logs/errors; export contains only the
   documented tables.

**Verification evidence:** (pending)

---

## T-011 — Architecture review of gold data boundaries

- **Description:** Juan reviews maintainability of the data layer, module boundaries,
  absence of duplicated business logic, and unnecessary abstraction, then approves or
  requests changes on the same candidate Laura reviews.
- **Owner:** Juan · **Dependencies:** T-009 · **Risk:** Medium · **Lane:** Gold
- **Status:** To do

**Acceptance criteria**

1. Written findings with file references; approval recorded or changes implemented.
2. Confirms SQL exists only in `src/data/**`, React components contain no business
   rules, and no duplicated logic exists between features.

**Verification evidence:** (pending)

---

## T-012 — Build, packaging and release verification

- **Description:** Coordinator runs the full verification suite, attempts a Windows
  build (`npm run tauri build`), records what could and could not be verified in this
  environment, and writes `README.md`.
- **Owner:** Rob (coordinator) · **Dependencies:** T-010, T-011 · **Risk:** Medium
- **Lane:** Standard · **Status:** To do

**Acceptance criteria**

1. `npm test`, `npm run typecheck`, `npm run build` green on the final candidate.
2. `cargo build --release` / `npm run tauri build` attempted; result (bundle path or
   blocker) recorded honestly.
3. `README.md` covers prerequisites, install, dev, test, Windows build, features and
   known limitations.
4. Acceptance tests from `PROJECT-BRIEF.md` mapped to recorded evidence.

**Verification evidence:** (pending)
