# DayDock

Offline-first Windows desktop app for everyday tasks, projects, quick notes and focus
sessions, with a Today dashboard that reflects what is actually stored on your machine.

Built with **Tauri 2 · React 19 · TypeScript · Vite · Tailwind CSS 4 · SQLite · Vitest**.
No account, no cloud, no network calls at runtime.

## Prerequisites

| Tool | Version used here | Notes |
| --- | --- | --- |
| Node.js | 24.x (npm 11) | LTS 20+ should work |
| Rust (stable, MSVC) | 1.98.1 | `rustup default stable` |
| Visual Studio Build Tools 2022 | with the **Desktop development with C++** workload | required by the MSVC linker |
| WebView2 Runtime | evergreen, preinstalled on Windows 11 | [runtime download](https://developer.microsoft.com/microsoft-edge/webview2/) for older Windows |

Check your toolchain:

```powershell
node --version
cargo --version
rustup show
```

## Installation

```powershell
git clone <repo> DayDock      # or copy the folder
cd DayDock
npm install
```

## Development

```powershell
npm run tauri dev      # starts Vite, compiles the Rust shell and opens the app window
npm run dev            # frontend only (Vite). The data layer needs the Tauri runtime,
                       # so a browser-only session shows the database error state by design.
```

The dev server binds `http://localhost:1420` (fixed port; `strictPort` is on).

## Tests and checks

```powershell
npm run typecheck      # tsc --noEmit
npm test               # vitest run (unit tests: validation, date/clock, pure models)
npm run test:watch     # vitest watch mode
npm run build          # tsc + vite build (production frontend bundle)
```

## Windows build

```powershell
npm run tauri build
```

Bundles are written to `src-tauri/target/release/bundle/` (NSIS/MSI installer and/or
portable binaries, depending on the `bundle.targets` setting in
`src-tauri/tauri.conf.json`). Release profile: LTO, single codegen unit, stripped.

To verify the Rust side without bundling:

```powershell
cd src-tauri
cargo check
cargo build --release
```

## Where your data lives

Everything is stored locally in a SQLite database named `daydock.db` created by the
Tauri SQL plugin in DayDock's application-data folder (identifier `com.danje.daydock`).
Tables: `projects`, `tasks`, `notes`, `focus_sessions`, `focus_state`, `settings`.
Schema changes are applied only through versioned migrations in
`src-tauri/src/migrations.rs` (migration v1 is immutable once released).

Use **Settings → Data → Export backup** to write a JSON copy of projects, tasks, notes,
focus sessions and settings to a location you choose.

## Features

- **Today** — real local date, quick-add task, due-today list, overdue list, high-priority
  list, completed-today / overdue / priority counters, and the live focus session card.
- **Tasks** — create, edit, complete/reopen, delete (confirmed), due date, priority
  (Low/Medium/High), project assignment, combined status/priority/project filters and
  title/description search.
- **Projects** — create, rename, delete (tasks are kept and unassigned, never deleted),
  per-project task view, and completed/total progress.
- **Notes** — plain-text notes with search, ~500 ms debounced auto-save, saving/saved
  status, updated timestamps and confirmed deletion.
- **Focus timer** — configurable duration (1–180 min), start/pause/resume/reset,
  wall-clock-accurate countdown that survives sleep/suspension and app restarts,
  completed sessions saved once, and a session history.
- **Settings** — dark (default) / light theme, focus duration, JSON backup export, app info.
- **Accessibility** — keyboard-operable throughout, visible focus rings, labelled controls,
  focus-trapped dialogs with Escape, polite live regions, no color-only signals.

## Architecture

```
src/
  data/          typed DB contracts, migrations consumer, repositories, validation, export  (all SQL lives here)
  lib/           shared pure utilities (date/clock helpers)
  app/           DataProvider, ThemeProvider, hash router
  components/    layout shell + shadcn-style UI primitives
  features/      today | tasks | projects | notes | focus | settings (page + pure model + tests)
src-tauri/
  src/migrations.rs   versioned SQLite migrations
  src/lib.rs          plugin registration + the narrow `save_backup_file` command
```

Business logic lives in pure, unit-tested modules; components render and call the typed
repositories. `tickets.md` holds the ticket plan and the verification evidence;
`backlog.md` holds post-MVP ideas.

## Known limitations

- **Backup restore/import is not implemented.** Export only — importing a JSON backup is
  in the backlog.
- A focus session that reaches zero while you are on a different page writes its history
  row the next time the Focus page opens (deferred, not lost).
- Notes are plain text (no Markdown/rich text), no tags, no attachments.
- No recurring tasks, calendar view, notifications or sync.
- Application icons are the Tauri defaults; no code signing.
- See `backlog.md` for the full list.

## Permissions and safety

- No credentials, tokens or API keys are stored, logged or transmitted.
- CSP is restricted to `self` + Tauri IPC; capabilities grant only `core`, `dialog` (save)
  and `sql` (load/select/execute) — no filesystem, shell or network plugin.
- Nothing is pushed, deployed or sent anywhere without explicit approval.
