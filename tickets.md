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
| T-002 | M2 | SQLite schema, migrations and typed data layer | Josh (`mimo-v2.6-flash-free`*) | High | Gold | Done |
| T-003 | M1 | App shell, design system, navigation and theme | Maya (`mimo-v2.6-flash-free`*) | Medium | Standard | Done |
| T-004 | M2 | Task management (CRUD, filters, search) | Maya (`mimo-v2.6-flash-free`*) | Medium | Gold | Done |
| T-005 | M3 | Project organization | Maya (`mimo-v2.6-flash-free`*) | Medium | Standard | Done |
| T-006 | M3 | Today dashboard | Maya (`mimo-v2.6-flash-free`*) | Medium | Standard | Done |
| T-007 | M4 | Quick notes | Maya (`mimo-v2.6-flash-free`*) | Low | Standard | Done |
| T-008 | M4 | Focus timer and session history | Josh (`mimo-v2.6-flash-free`*) | High | Gold | Done |
| T-009 | M5 | Settings and JSON backup export | Josh (`mimo-v2.6-flash-free`*) | Medium | Gold | Done |
| T-010 | M6 | Independent review, accessibility and test gaps | Laura (`mimo-v2.6-flash-free`*) | Medium | Standard | Done (round-2 APPROVE `79b23ba`) |
| T-011 | M6 | Architecture review of gold data boundaries | Juan (`mimo-v2.6-flash-free`*) | Medium | Gold | Done (round-2 APPROVE `79b23ba`) |
| T-012 | M6 | Build, packaging and release verification | Rob (coordinator) | Medium | Standard | Done |
| T-013 | M6 | Frontend repair batch from review findings | Maya (`mimo-v2.6-flash-free`*) | Medium | Standard | Done (round-2 APPROVE `79b23ba`) |
| T-014 | M6 | Data/focus repair batch from review findings | Josh (`mimo-v2.6-flash-free`*) | High | Gold | Done (round-2 APPROVE `79b23ba`) |

\* Model deviation, recorded per AGENTS.md "Report unavailable settings": the preferred
`gpt-6.1-sol` / `gpt-6-luna` failed at launch with **"Insufficient account funds"**, so all
specialists run on the free model `opencode/mimo-v2.6-flash-free`. The requested effort
settings (`medium`/`high`/`max`) are **not exposed by this harness** — effort is
unverified/default for every worker. Role skills named in AGENTS.md
(`ticket-table`, `clean-code-typescript`, `db-migration-discipline`, `code-review`,
`accessibility-wcag`, …) are not installed here; every worker reported applying their
stated practices manually instead.

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
- Gold-lane independent approvals: **both delivered on `79b23ba`** — Juan
  (T-011, architecture/data-boundary) APPROVE, Laura (T-010, behavior)
  APPROVE; see the final section of this file.

**Status: Done**

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

**Status: Done**

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

**Verification evidence**

- Worker (Maya): `npm run typecheck` → exit 0 (zero errors, whole tree);
  `npx vitest run src/features/tasks` → **15/15 passed**.
- Delivered: `taskHelpers.ts` (+15 tests), `TaskDialog`, `TaskList`, `TaskFilters`,
  `TaskPriorityBadge`, `TasksPage`, `index.ts` barrel with the required stable exports.
- Filter/search semantics live only in `src/data/repositories/tasks.ts` (component passes
  `TaskFilter` straight through) — no duplicated filtering logic.
- Coordinator re-run (2026-10-10): `npm run typecheck` exit 0; `npm test` →
  **107/107 passed (7 files)**; `npm run build` exit 0 (`TasksPage` code-split, 67 kB).
- Not yet verified: in-app interaction and restart persistence (needs native run → T-012);
  screen-reader output (→ T-010).

**Status: Done**

---

## T-005 — Project organization

- **Description:** Project list with create/rename/delete (confirm dialog that states
  tasks are kept and unassigned), project detail view listing that project's tasks,
  and a progress bar (completed/total).
- **Owner:** Maya · **Dependencies:** T-004 · **Risk:** Medium · **Lane:** Standard
- **Status:** Review

**Acceptance criteria**

1. Create, rename and delete work and persist; deleting a project never deletes tasks.
2. Project page lists only that project's tasks and shows accurate progress
   (completed/total, percentage).
3. Task→project assignment appears immediately in the project view.
4. Empty and error states covered; keyboard accessible.
5. `npm run typecheck` green.

**Verification evidence**

- Worker (Maya): `npm run typecheck` exit 0; `npx vitest run src/features/projects` →
  **12/12 passed**; files confined to `src/features/projects/**` (helpers + test,
  `ProjectCard`, `ProjectDialog`, `ProjectsPage`, barrel).
- Delete confirmation copy states tasks are kept and only unassigned; progress is computed
  from the exact rendered rows (`summarizeProjectTasks`), 0-task project → 0% (no NaN,
  unit-tested). Project detail reuses the `TaskList` export — no duplicated task rendering.
- Coordinator re-run (2026-10-10): `npm run typecheck` exit 0; `npm test` →
  **147/147 passed (10 files)**; `npm run build` exit 0.
- Not yet verified: live dialog/keyboard walkthrough (→ T-010), restart persistence (→ T-012).

**Status: Done**

---

## T-006 — Today dashboard

- **Description:** Dashboard with current date, today's tasks, overdue tasks,
  completed-today count, priority (high) tasks, active focus session card, and a
   quick-add task input. All figures derive from stored data.
- **Owner:** Maya · **Dependencies:** T-004 · **Risk:** Medium · **Lane:** Standard
- **Status:** Review

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

**Verification evidence**

- Worker (Maya): `npm run typecheck` exit 0; `npx vitest run src/features/today` →
  **18/18 passed**; files confined to `src/features/today/**` (7 files).
- All four derivation rules live only in `dashboardModel.ts` (pure, `today` injected) and are
  unit-tested with fixtures (due today/tomorrow, overdue by a day, completed today vs
  yesterday, high-priority-but-completed excluded, null due dates). Quick-add short-circuits
  whitespace before the data layer and preserves typed input on `ValidationError`.
- Focus card renders `computeFocusProgress(state, Date.now())` (500ms re-render) — the pure
  helper remains the only clock source; date refreshed on mount/focus/60s.
- Coordinator re-run (2026-10-10): `npm run typecheck` exit 0; `npm test` →
  **188/188 passed (14 files)**; `npm run build` exit 0; `cargo check` → EXIT=0.
- Not yet verified: live dashboard against a populated database (→ T-010/T-012 native run).

**Status: Done**

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

**Verification evidence**

- Worker (Maya): `npm run typecheck` → exit 0; `npx vitest run src/features/notes` →
  first run 26/28 (2 genuine bugs found by tests: pending-state after `cancel()`,
  and a rolling-hour timestamp bug) → fixed at the root → **28/28 passed**.
- Delivered: `autosave.ts` (500ms debounce, cancel/flush/retry, tested with fake timers),
  `noteSearch.ts`, `noteTime.ts`, `NoteList`, `NoteEditor`, `NotesPage`, `index.ts`,
  3 test files.
- Search delegates to `data.notes.list(query)` (SQL `LIKE` over title+content) — not
  duplicated in the UI.
- Coordinator re-run (2026-10-10): full `npm test` → **107/107 passed**; typecheck exit 0;
  `npm run build` exit 0 (`NotesPage` code-split).
- Not yet verified: live auto-save in a running app and restart persistence (→ T-012).

**Status: Done**

---

## T-008 — Focus timer and session history

- **Description:** Configurable focus duration, start/pause/resume/reset, remaining
  time display, completed sessions saved to history, session history list. Elapsed
  time is computed from wall-clock timestamps so sleep/suspension and window blur are
  accurate; the active session survives restart.
- **Owner:** Josh · **Dependencies:** T-002, T-003 · **Risk:** High · **Lane:** Gold
- **Status:** Review

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

**Verification evidence**

- Worker (Josh): `npm run typecheck` exit 0; `npx vitest run src/features/focus` →
  **28/28 passed (2 files, 22 timing tests)**; files confined to `src/features/focus/**`.
- Timing is wall-clock derived (`elapsed = elapsedBeforeMs + (running ? now − startedAt : 0)`);
  `grep` confirms no `Date.now()` inside the pure model. Tests cover pause freezing elapsed
  while the clock advances 30 min, a **simulated 1-hour sleep during a 25-minute session**
  completing exactly once with `actualDurationMs = planned`, idempotent re-tick,
  backwards-clock clamps, `resetTimer → null`, and `computeFocusProgress` math.
- State persisted on every transition (`focusState.save/clear` runs before the UI update) and
  restored on mount; completion write guarded against duplicates (bookkeeping ref + history
  dedupe).
- Coordinator re-run (2026-10-10): full `npm test` → **147/147**; typecheck exit 0; build exit 0.
- **Known gap flagged for T-010:** a session reaching its deadline while the user is on a
  different page (or an app closed exactly at completion) writes its history row when the
  Focus page next mounts — deferred, not lost, but completion is not app-global yet.
- Not yet verified: real system sleep/suspension and restart persistence (→ T-012),
  screen-reader output (→ T-010).

**Status: Done**

---

## T-009 — Settings and JSON backup export

- **Description:** Settings page (theme, focus duration, app information) and local
  data export: writes a JSON backup of projects, tasks, notes, focus sessions and
  settings through the native save dialog.
- **Owner:** Josh · **Dependencies:** T-002, T-003, T-008 (focus duration setting
  consumed by the timer) · **Risk:** Medium · **Lane:** Gold · **Status:** Review

**Owned files:** `src/features/settings/**`, `src/data/export.ts`.

**Acceptance criteria**

1. Theme and focus duration edits persist to SQLite and take effect immediately.
2. Export opens a native save dialog (default name `daydock-backup-YYYY-MM-DD.json`)
   and writes valid JSON containing `app { name, version, schema }`, `exportedAt`,
   `projects`, `tasks`, `notes`, `focusSessions`, `settings`. (Amended 2026-10-10
   per T-010 finding #6: the original text listed a top-level `version` key; the
   implemented and test-pinned shape carries the version at `app.version`.)
3. Exported payload round-trips through `JSON.parse` in a unit test and includes every
   stored row (count verified against the repositories).
4. The UI states plainly that export is a backup and that **restore/import is not
   available** in the MVP.
5. App information shows name, version and storage location.

**Verification evidence**

- Worker (Josh): `npm run typecheck` exit 0; `npx vitest run src/data/export.test.ts
  src/features/settings` → **3 files, 23/23 passed**.
- Tests prove: serialized backup round-trips through `JSON.parse`; payload table counts equal
  the injected aggregate's fixture counts (3/5/2/4); `app.schema === 1` + `exportedAt`
  present; exact-key shape assertion fails on a deleted `exportedAt`, an injected extra key,
  or a view-only `taskCount` leaking into a project row; dialog cancel → `null` with `invoke`
  never called; write path asserts `save_backup_file` args and UTF-8 byte count.
- Honesty copy ("Export only — restoring a backup is not available in this version.") is
  test-pinned in `settingsCopy.test.ts`.
- `APP_VERSION` constant mirrors `package.json` (a `package.json` import failed typecheck in
  this TS config) — a unit test reads `package.json` from disk and **fails if they diverge**.
- Coordinator gate (2026-10-10): full `npm test` → **188/188**; typecheck exit 0; build exit 0;
  `cargo check` → EXIT=0 with the new `save_backup_file` command (restricts writes to
  `.json` targets, 100MB cap, never touches the database file).
- **Blocked here:** the native save dialog + real file write cannot run without a Tauri
  runtime — assigned to T-012's native verification.

**Status: Done**

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

**Verification evidence**

- Review delivered 2026-10-10 (Laura, candidate `1e10d02`/clean tree): verdict
  **REQUEST CHANGES** — 3 Major, 4 Minor, 5 Nit findings; security/privacy section
  clean (SQL confinement, no network/eval, no secrets, least-privilege capabilities,
  export payload exact-key verified); data-loss pass except Major #1.
- Major findings (repaired under T-013/T-014):
  1. **Note auto-save dead under StrictMode** — cleanup-only effect
     (`NoteEditor.tsx:72-77`) calls `saver.cancel()` which sets `detached = true`
     irreversibly; React 19 StrictMode dev double-invokes effects, so every editor
     is born detached, `schedule()`/`runNow()` no-op, status stays `idle` → UI shows
     **"Saved"** while nothing is written (empirically probe-verified by reviewer AND
     coordinator: typed content is absent from `daydock.db` after auto-save claimed
     success — `notes.content` empty, `updated_at` = create time).
  2. **Focus completion not app-global** — a session whose deadline passes off the
     Focus page is written only on next Focus mount; `endedAt` stamped at detection
     time; Today card shows a phantom running session meanwhile.
  3. **Focus ring contrast below WCAG AA** — measured 2.44–2.56:1 (needs ≥3:1);
     `--ring` tokens in `src/index.css`.
- Minors: rejected-promise cache makes Retry inert (`db.ts`/`data/index.ts`);
  NotesPage delete-failure closes the dialog + silent refresh errors; T-009 AC2
  `version`-key wording mismatch; light `--muted-foreground` on `--secondary`
  measures 4.40:1 (needs ≥4.5:1).
- Nits: project delete non-transactional + FK pragma inert; `Custom…` Select
  placeholder unverified; missing `role="alert"` on some field errors; CSP lacks
  `form-action`; task search fires 3 queries per keystroke (no debounce).
- Reviewer ran: typecheck (exit 0), 37 targeted tests, SQL/network/secret greps,
  WCAG contrast script, and 2 StrictMode probe tests in a temp dir (no repo files
  touched). Full suite/build/cargo/native run deliberately left to coordinator.
- Coordinator independently confirmed Major #1 (live DB probe on the running app:
  content never persisted despite "Saved" status) and Juan's T-011 Blocker
  (`focusSessions.ts` INSERT binds 6 params into 7 placeholders) by code reading.

**Status: Done** (round 2: Laura APPROVE `79b23ba`; every finding fixed or
rebutted — see final section)

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

**Verification evidence**

- Review delivered 2026-10-10 (Juan, candidate `1e10d02`/clean tree): verdict
  **REQUEST CHANGES** — 1 Blocker, 4 Major, plus Minors/Nits.
- **Blocker (coordinator-confirmed by code reading):**
  `src/data/repositories/focusSessions.ts:94-105` — INSERT lists 7 columns
  (incl. `id`) with 7 placeholders but binds only 6 params, so every completed
  focus session write fails at runtime. Repaired under T-014.
- Majors: `toErrorMessage` duplicated 12× across features (repair: one shared
  helper in `src/lib/errors.ts`, T-013/T-014); FocusPage completion bookkeeping
  untested (T-014); rejected-promise cache makes DataProvider Retry unable to
  recover (T-014, overlaps Laura Minor #4); no repository integration test
  covering SQL/param shape (T-014).
- Minors/Nits: `projects.remove` not transactional + `foreign_keys` pragma inert;
  validation drift between `validation.ts` and contracts; non-atomic backup file
  write in `save_backup_file`; unused `useDataStatus` export.
- Reviewer also confirmed: SQL confined to `src/data/**`, no business rules in
  components, parameterized statements only, DataError messages safe.
- Coordinator independently confirmed the Blocker (see T-010 evidence) before
  dispatching repairs.

**Status: Done** (round 2: Juan APPROVE `79b23ba` — gold gate for
T-002/T-004/T-008/T-009; every finding fixed or soundly rebutted)

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

**Verification evidence** (2026-10-10/11, coordinator, candidate `79b23ba`)

- **AC1 — final gates (rerun on the final candidate):** `npm run typecheck`
  → exit 0; `npx vitest run` → **261/261 passed (21 files), exit 0**;
  `npm run build` → exit 0 (no warnings; per-page lazy chunks intact). An
  earlier vitest attempt failed with a worker-timeout while the release build
  was saturating the machine — that run was discarded, not counted; the clean
  rerun above stands. Rust is covered by the successful release compile
  below.
- **AC2 — Windows build: VERIFIED (not merely attempted).** `npm run tauri
  build` (with `CARGO_BUILD_JOBS=2` to avoid the OOM seen on full-parallel
  rustc) → exit 0: release profile compiled in 3m16s, then two bundles
  produced with hash-verified toolchain downloads (WiX 3.14, NSIS 3.11 +
  tauri-utils):
  - `src-tauri/target/release/bundle/msi/DayDock_0.1.0_x64_en-US.msi` (3.21 MiB)
  - `src-tauri/target/release/bundle/nsis/DayDock_0.1.0_x64-setup.exe` (2.33 MiB)
  - Smoke test: the release `daydock.exe` launched, opened its "DayDock"
    window against the same preloaded SQLite DB (migrations re-ran
    idempotently), and was closed cleanly after inspection.
- **AC3 — README:** `README.md` covers Prerequisites, Installation,
  Development, Tests and checks, Windows build, Where your data lives,
  Features, Architecture, Known limitations (including export-only — no
  restore), Permissions and safety.
- **AC4 — PROJECT-BRIEF "How I will know it works" mapped to evidence:**
  1. *Create task → complete → restart → still completed* — live: task
     "Verify DayDock persistence" completed `06:49:30Z`, still `completed`
     after multiple real restarts (latest probe after the relaunch cycle).
  2. *Projects + assignment + progress correct* — live: project create/delete,
     task assignment via the edit dialog (`project_id=3` verified in DB),
     `1/1 task` progress chip; project detail page logic covered by 12/12
     feature tests + both reviews (not separately walked live this session).
  3. *Today dashboard reflects real data + running focus* — live probes:
     completed/overdue/high figures match the DB; focus card showed Running
     47 %/70 %/24:06 with math matching stored timestamps exactly.
  4. *Notes create/edit/search persist across restart* — live: content in
     SQLite, search verified both directions, notes survived the restarts.
  5. *Focus start/pause/resume/reset; history rows* — live, twice, with a DB
     probe at every transition (full anchor reproduction in the final
     tickets section); Reset verified to write no history row.
  6. *Dark/light themes* — live both directions + persisted across restart.
  7. *Valid JSON export with every table* — live through the native dialog:
     1,452-byte file, payload parsed and counted (1/1/1/2 + settings).
  8. *Keyboard-operable core flows* — live coordinator spot-checks (dialogs,
     Radix selects via arrows/Enter, inputs, search) + Laura's round-1
     walkthrough findings (all fixed) and round-2 a11y re-spotchecks; a
     full six-page keyboard-only native audit was not rerun in round 2.
  9. *`npm test` + Windows build succeed* — both green (AC1/AC2).
- **Gold-lane brief items:** (1) task persistence across restart ✓ live;
  (2) valid JSON export ✓ live; (3) focus accuracy across pause/resume ✓
  live with millisecond-exact probes — system *suspension* is covered by the
  unit test simulating a 1-hour sleep (completes exactly once with
  `actualDurationMs = planned`); a real OS sleep could not be provoked on
  demand in this environment (honestly recorded).
- **Constraints honored:** offline-only (no network calls at runtime; the
  only downloads were build-time toolchain fetches by Tauri), export-only
  (no restore anywhere, copy test-pinned), plain-text notes, database never
  committed to Git (checked: `target/`, DB and bundles are ignored).

**Status: Done**

---

## T-013 — Frontend repair batch from review findings (Maya)

- **Description:** Fix the frontend-owned findings from T-010/T-011: StrictMode
  auto-save death (Major), focus-ring and muted-text contrast (Major/Minor),
  NotesPage delete/refresh error handling (Minor), missing `role="alert"` on
  field errors (Nit), task-search debounce (Nit), and replace the local
  `toErrorMessage` copies in `src/features/**` + `src/app/**` with the shared
  `src/lib/errors.ts` helper.
- **Owner:** Maya · **Dependencies:** T-010, T-011 · **Risk:** Medium
- **Lane:** Standard · **Status:** In progress

**Owned files:** `src/lib/errors.ts` (new, created by coordinator first),
`src/features/notes/**`, `src/features/today/**`, `src/features/tasks/**`,
`src/features/projects/projectHelpers.ts` (+ its call sites in projects),
`src/app/DataProvider.tsx`, `src/index.css`. Nothing in `src/data/**`,
`src/features/focus/**`, `src/features/settings/**`, or `src-tauri/**`.

**Acceptance criteria**

1. Note auto-save writes to SQLite in the StrictMode dev runtime: a regression
   test mounts the editor's saver lifecycle under `<StrictMode>` and asserts a
   write happens after `schedule()`; the unmount flush and note-switch flush also
   write.
2. Focus ring meets ≥3:1 contrast on every surface in both themes; light
   `--muted-foreground` on `--secondary` meets ≥4.5:1 (values re-measured with a
   contrast script and recorded).
3. A failed note delete keeps the confirmation dialog open and shows the error
   next to the dialog; a failed list refresh with existing notes shows a visible
   error banner (TodayPage pattern).
4. All inline field errors use `role="alert"` (or one shared `FieldError`
   component) across tasks/projects forms.
5. Task search input is debounced (~250 ms) with stale-response guard preserved.
6. `toErrorMessage` exists once in `src/lib/errors.ts`; the feature/app copies are
   gone; behavior (data-layer message or feature fallback) unchanged.
7. `npm run typecheck` and `npx vitest run src/features src/app src/lib` green.

**Verification evidence** (2026-10-10)

- Worker (Maya) report: all 8 findings fixed. Wrote the StrictMode regression
  tests FIRST — they failed on the old code (`onSave called 0 times`,
  status stuck at "Saving…"), empirically reproducing the Major, then passed
  after the fix. Delivered `AutoSaver.reset()` (re-attaches after StrictMode's
  phantom cleanup; `cancel()` no longer bumps `generation` so an in-flight
  write's status isn't frozen), effect-setup reset in `NoteEditor`, new
  `NoteEditor.test.tsx` (3 StrictMode tests: debounce-save, unmount flush,
  note-switch flush) + 4 `reset()` unit tests; contrast tokens re-measured with
  a WCAG script — light ring `#52525b` 7.03–7.73:1, dark ring `#71717a`
  3.24–4.10:1 (all ≥3:1), light muted `#6b6b73` 4.81:1 on secondary (≥4.5:1);
  `confirmDelete` re-throws so the dialog stays open with a visible
  `role="alert"` error layered above the overlay + refresh-failure banner;
  shared `FieldError` component applied to task/project/note forms; 250 ms task
  search debounce with 5 new TasksPage tests incl. stale-response ordering;
  `toErrorMessage` reduced to the single `src/lib/errors.ts` source (grep:
  exactly one definition); unused `useDataStatus` removed.
- Coordinator integration on top of the batch: mounted
  `<FocusCompletionWatcher />` in `App.tsx` (direct module import, not the
  focus barrel — first attempt through the barrel triggered Rollup's
  `INEFFECTIVE_DYNAMIC_IMPORT` and pulled FocusPage into the main chunk;
  reverted to the direct import, FocusPage lazy chunk restored);
  `FOCUS_COMPLETION_EVENT` listener added to `TodayPage` so the card refreshes
  when the watcher completes a session off-page; `SelectField.value` widened to
  `string | null` with internal normalization to `""` — the installed Radix
  version's `shouldShowPlaceholder` only treats `""`/`undefined` as
  placeholder-triggering (NOT `null`), so the reviewer's suggested raw
  `value={null}` would have rendered an empty trigger; SettingsPage cast
  removed.
- Coordinator full gate (2026-10-10, commit `4d19e2f`): `npm run typecheck`
  exit 0; `npx vitest run` → **261/261 passed (21 files)**; `npm run build`
  exit 0 (no warnings, per-page lazy chunks intact); `cargo check` exit 0.

**Status: Done** (native verified; round 2: Laura APPROVE `79b23ba`,
Juan re-verified the shared helper)

---

## T-014 — Data/focus repair batch from review findings (Josh)

- **Description:** Fix the data/focus-owned findings from T-010/T-011: the
  `focusSessions.create` INSERT Blocker, app-global focus completion, Retry
  recovery (rejected-promise cache), repository integration tests, completion
  bookkeeping tests, transactional project delete, shared `toErrorMessage` usage
  in focus/settings, and the non-atomic backup write.
- **Owner:** Josh · **Dependencies:** T-010, T-011 · **Risk:** High
- **Lane:** Gold · **Status:** In progress

**Owned files:** `src/data/**`, `src/features/focus/**`,
`src/features/settings/**`, `src/lib/errors.ts` (import only), new
`src/features/focus/completeSession.ts` (+ shared completion watcher wired per
T-010 fix #2 — coordinate: the watcher mounts in app shell, which is Maya's
`src/app/**`; Josh provides the hook/component export, Maya only mounts it if
needed, otherwise Josh mounts it inside `FocusPage` + `DataProvider` stays
untouched by Josh). Nothing in `src/features/notes|tasks|today|projects/**`,
`src/index.css`, or `src-tauri/**` except `lib.rs` for the backup-write fix.

**Acceptance criteria**

1. `focusSessions.create` INSERT binds exactly one param per column (id excluded
   — SQLite autoincrements); a unit test asserts the column list, placeholder
   count and param count stay in lockstep (regression test for the Blocker).
2. A session whose deadline passes off the Focus page (or before the Focus page
   ever mounts) is written to `focus_sessions` exactly once app-globally, with
   `endedAt` at the deadline instant; the Today card stops showing a phantom
   running session. Dedupe by `startedAt + plannedDurationMs` preserved.
3. Retry on the app-wide error screen genuinely re-attempts: a failed
   `Database.load`/`getData()` is not cached as a rejected promise.
4. Repository integration tests exercise each repository against a mocked driver
   capturing (sql, params) — asserting parameterization and row mapping for
   tasks, projects, notes, focus sessions, focus state and settings.
5. Focus completion bookkeeping is unit-tested: exactly-once write under
   repeated ticks, crash-between-create-and-clear re-completes without a
   duplicate row, failed write keeps state for Retry.
6. `projects.remove` runs unassign + delete in one transaction.
7. `save_backup_file` writes atomically (temp file + rename) and keeps the
   `.json`-only, 100 MB, never-the-database guards.
8. `toErrorMessage` in focus/settings comes from `src/lib/errors.ts`.
9. `npm run typecheck`, `npx vitest run src/data src/features/focus src/features/settings`,
   `cargo check` green.

**Verification evidence** (2026-10-10)

- Worker (Josh) report: findings 1-5, 7, 9, 10 fixed; 6 rebutted with evidence;
  8 no-drift-found. Blocker fix: the INSERT column list now DRIVES both column
  names and placeholders (id excluded, SQLite autoincrements), with a lockstep
  regression test; new `repositories.integration.test.ts` (39 tests) exercises
  every repository against a mocked driver capturing `(sql, params)` with an
  automatic placeholder/param parity check in `afterEach` — the exact bug class
  that escaped before cannot pass again. App-global completion:
  `completeSession.ts` (single completion implementation, deadline `endedAt`
  derived from stored timestamps, dedupe by `startedAt+plannedDurationMs`) +
  `<FocusCompletionWatcher />` (mount/hashchange/focus/1 s interval) exported
  for the shell to mount. Retry recovery: `db.ts`/`index.ts` clear their
  cached promise inside `.catch` before rethrowing; `db.test.ts` proves
  fail-once-then-succeed recovery via `vi.resetModules`. Completion bookkeeping
  tests: `completeSession.test.ts` (8), `FocusCompletionWatcher.test.tsx` (6),
  timer tests for deadline `endedAt` + paused guard. `save_backup_file` now
  writes temp + `std::fs::rename` with all guards intact. Finding 6 rebutted:
  tauri-plugin-sql 2.5.0 has no transaction API (per-call pool checkout,
  single prepared statement — verified in the plugin's `commands.rs`/
  `wrapper.rs`), so unassign-then-delete (the non-destructive order) is kept
  and documented in a code comment rather than faked. Finding 8: no drift —
  validation limits match contracts (200/60/200 titles, 1–180 min, YYYY-MM-DD).
- Worker gates: typecheck exit 0; `npx vitest run src/data src/features/focus
  src/features/settings` → **156 passed**; `cargo check` exit 0.
- Coordinator integration: mounted the watcher in `App.tsx`, added the
  completion-event refresh to `TodayPage`, widened `SelectField.value` to
  `string | null` (normalized to `""` internally — the installed Radix shows
  the placeholder for `""`/`undefined`, not `null`; verified in the plugin's
  `shouldShowPlaceholder`), removed the SettingsPage cast.
- Coordinator full gate (2026-10-10, commit `4d19e2f`): typecheck exit 0;
  full suite **261/261 (21 files)**; `npm run build` exit 0; `cargo check`
  exit 0.

**Status: Done** (native verified; round 2: Juan APPROVE `79b23ba` with the
full repair table re-verified, Laura APPROVE on the same candidate)

---

## Coordinator native verification — repaired candidate `4d19e2f` (2026-10-10)

Run by Rob on the live app (`npm run tauri dev`, Tauri runtime, SQLite probes
against `%APPDATA%\com.danje.daydock\daydock.db`). This closes the "native
re-verification" items on T-013/T-014 and the "blocked without a Tauri runtime"
item on T-009. Test data left in the dev DB: 1 task, 1 note, 2 focus sessions,
1 project (`Programming`, reassigned task) — the `focusDurationMinutes` test
value was restored to 25.

- **Notes auto-save under StrictMode (T-013 AC1, Laura Major #1):** typed
  content persisted to SQLite in the real runtime (`notes.content` written,
  `updated_at` advanced from create time to `08:23:38Z`); UI status "Saved"
  matches the DB. The former dead-saver state is gone.
- **App-global focus completion (T-014 AC2, Laura Major #2):** a session whose
  deadline passed **off the Focus page** (user on Today) wrote its history row
  and cleared `focus_state` via the watcher; the Today card updated through
  `FOCUS_COMPLETION_EVENT` instead of showing a phantom running session.
- **Juan's Blocker (focus INSERT column/param parity):** every completed row
  this session was written through the repaired `create` — all 7 columns land
  with correct values (probed directly).
- **Focus timestamp investigation — resolved, NO BUG.** A prior row was
  misread as "started_at = original start"; history `started_at` is the
  **resume anchor by design** (`resumeTimer` re-anchors `startedAt`;
  `tickTimer` keeps `state.startedAt`). Reproduced deterministically with a DB
  probe at every transition: Start `08:55:42.598` → Pause (`paused`, same
  anchor, `elapsed_before=23702`) → Resume (`running`, **new anchor
  `08:56:26.904`**, bank preserved) → Today card **70 %** (= 23.7 s banked +
  18.3 s segment ✓) → deadline `08:57:03.202` = resume + 36.298 s remaining,
  exact to the millisecond → row `started_at=08:56:26.904`,
  `ended_at=08:57:03.202`, `focus_state` cleared, written by the watcher
  off-page. The earlier session's row follows the identical pattern (its
  `08:27:43.005` was its resume anchor). No code path produces the hypothesized
  bad state; no repair ticket was raised.
- **JSON export through the native dialog (T-009 AC2):** "Export backup" →
  Windows Save As (default `daydock-backup-2026-10-10.json`) → file written,
  **1,452 bytes**, UI message shows the same path and byte count. Parsed
  payload: `app{name, version 0.1.0, schema 1}`, `exportedAt`,
  projects=1 / tasks=1 / notes=1 / focusSessions=2, `settings{theme,
  focusDurationMinutes}`, session anchors correct. Test artifact deleted after
  validation.
- **Safe project delete (T-004/T-005: tasks are never deleted):** throwaway
  project create+delete clean; deleting `Programming` (1/1 task) left the task
  alive with `project_id NULL`, confirm dialog states "Its tasks are kept —
  they are not deleted"; project recreated and task reassigned (artifacts
  restored).
- **Theme:** light applied (DB `theme=light`, toggle label flips, screenshot
  shows neutral surfaces, sharp corners, no gradients), dark restored.
- **Search:** note search "zzzqqq" → "0 matches" empty state with guidance,
  "autosave" → 1 match, cleared → list restored; task search "zzz" → "No tasks
  match your filters", cleared → "1 of 1 task" (T-013 debounce working live).
- **`Custom…` preset (Laura nit):** duration 1 min → preset combo shows
  `Custom…` with spin value 1; restored to 25 → `25 minutes`.
- **Restart persistence:** task persistence across a real Tauri restart
  verified earlier in the same native run.
- Automation note: the native Save As dialog is a child window — orca keyboard
  input was refused (`window_not_focused`), so the file name was left at its
  configured default; the write was verified by the file on disk plus the UI
  receipt, not by dialog keystrokes.

**Round-2 re-reviews — both APPROVED the same candidate `79b23ba` (2026-10-10):**

- **Juan (T-011, gold gate for T-002/T-004/T-008/T-009): APPROVE.** All round-1
  findings re-verified FIXED/sound: Blocker regression-pinned
  (`focusSessions.ts` placeholders derived from the column list;
  `repositories.integration.test.ts` lockstep + afterEach parity), single
  `toErrorMessage` (14 call sites import `src/lib/errors.ts`), completion
  bookkeeping tests (8 + 6), Retry recovery tests, 39-test repository
  integration suite, atomic backup write, `useDataStatus` gone, transaction
  rebuttal accepted against the installed `tauri-plugin-sql-2.5.0` source (no
  transaction API, per-call pool checkout), and all three coordinator
  integration seams architecturally accepted (watcher mount + direct import
  with chunk evidence, TodayPage event listener, `SelectField` `string|null`
  normalization verified against Radix `shouldShowPlaceholder`). New Minor
  (FocusSessionCard's `../focus` barrel import statically pulls the
  FocusPage chunk into Today's chunk, ~10.6 KB — no correctness impact) and
  2 Nits (duplicated 1–180 range in FocusPage; pause/watcher sub-second race
  observation) recorded as follow-ups; reviewer states none blocks approval.
  Checks: `npm run typecheck` exit 0; `npx vitest run` **261/261 (21 files)**.
- **Laura (T-010): APPROVE.** Independently re-verified all 3 Majors, 4
  Minors and the Nits: re-ran the new `NoteEditor.test.tsx` against the OLD
  `1e10d02` code in a temp extraction (**3/3 FAILED** — empirically proving
  the StrictMode regression test captures Major #1) and it passes on the new
  candidate; re-measured contrast with her own script (ring worst
  **6.09:1 light / 3.08:1 dark**, all ≥3:1; light muted-on-secondary
  **4.81:1** ≥4.5); verified app-global completion wiring, T-009 AC2 shape,
  CSP `form-action`, debounce, `FieldError`, `Custom…` placeholder; accepted
  the transaction rebuttal against crate source; security/privacy delta
  re-pass clean (SQL confinement, parameterization, fixed `DataError`
  strings, exact-key export pinning). New findings recorded as follow-ups
  (Minor: no component test for the TodayPage event wiring / NotesPage
  failure paths; Nit: SettingsPage duration error lacks `role="alert"` — a
  round-1 carry-over outside T-013's scope; Nit: stale comment). Checks:
  `npm run typecheck` exit 0; `npx vitest run` **261/261 (21 files)**.

**Restart persistence (closing the last native AC gaps):** with theme=light
and a 25-minute session running, the app was killed and relaunched — it came
back in **light** (toggle reads "Switch to dark theme", restored from SQLite;
T-003 AC2) and the **focus session was restored** (Today card Running 24:06
with wall-clock-correct remaining across the downtime; Focus page showed
01:24 elapsed of 25:00; T-008 AC4). The test session was then Reset through
the confirm dialog: `focus_state` = 0 rows, `focus_sessions` unchanged (2) —
reset writes no history row, as specified. Theme returned to dark.

All follow-up findings from both reviewers are recorded in `backlog.md`.

---

