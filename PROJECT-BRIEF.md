# Project brief — DayDock

## Project name

DayDock

## What I want to build

DayDock is an offline-first Windows desktop application for a student / programmer /
small-business owner who manages multiple responsibilities in one place. It manages
everyday tasks, projects, quick notes and focus (Pomodoro-style) sessions, and shows a
single "Today" dashboard with the real state of the day.

It is a personal tool: all data is stored locally, no account, no cloud, no network
access required at runtime.

## Features I want

1. **Today dashboard** — current date, today's tasks, overdue tasks, completed count,
   priority tasks, active focus session, quick-add task input. All values come from
   stored data.
2. **Task management** — create, edit, complete/reopen, delete (with confirmation),
   due date, priority (Low/Medium/High), project assignment, filters (status, priority,
   project) and search.
3. **Project organization** — create, rename, delete (with safe task handling), assign
   tasks, project-specific task view, task progress display.
   Example projects: School, Programming, Personal, Business.
4. **Quick notes** — create, edit, delete (with confirmation), search, automatic
   saving with updated timestamp. Plain-text editor for the MVP.
5. **Focus timer** — configurable duration, start/pause/resume/reset, remaining time,
   completed sessions saved to history, suspension- and sleep-safe elapsed-time
   handling.
6. **Settings** — dark/light theme, focus timer duration, local JSON data export,
   basic application information.

## Platforms

Windows desktop (Tauri 2). No mobile, no web deployment in the MVP.

## First version

The MVP is the six features above, all persisted in local SQLite and usable without
internet access. Everything else goes to the backlog.

## Design preferences

- Minimalist and modern; dark mode is the default, light mode supported.
- Mostly sharp corners; clean typography; neutral black/white/gray palette.
- Subtle transitions and hover states; compact sidebar navigation.
- No unnecessary gradients or decorations; not a generic-looking template.
- Accessible keyboard navigation, consistent spacing, responsive to window resizing.

## Stack and services

- Tauri 2, React, TypeScript, Vite, Tailwind CSS (v4), shadcn/ui-style components,
  SQLite (via `tauri-plugin-sql`, local file), Vitest for unit tests.
- No Supabase, no cloud authentication, no paid services, no telemetry.
- No credentials, tokens or API keys are stored anywhere in this project.

## Important features for gold lane

Gold-lane (strongest verification) items:

1. Task persistence across application restarts (SQLite writes, migrations).
2. Data export to JSON producing a valid backup of all supported local data.
3. Focus timer elapsed-time accuracy across pause/resume and system suspension.

No account permissions, sync or RLS work exists in this MVP.

## How I will know it works

- Create a task, complete it, restart the app, and the task is still completed.
- Create projects, assign tasks, and the project view and progress are correct.
- The Today dashboard reflects real stored tasks (today / overdue / completed /
  priority) and the running focus session.
- Create and edit notes, search them, restart the app, and they persist.
- Start/pause/resume/reset the focus timer; completed sessions appear in history.
- Switch between dark and light themes.
- Export produces a valid JSON backup file containing tasks, projects, notes,
  focus sessions and settings.
- Core flows are operable with the keyboard alone.
- `npm test` and the Windows build succeed.

## Constraints and exclusions

- Offline-only MVP: no sync, no accounts, no cloud, no network calls at runtime.
- No backup **restore/import** in the MVP — export only. Do not claim restore exists.
- Plain-text note editor (no rich text / markdown editing).
- No attachments, no recurring tasks, no calendar, no notifications in the MVP.
- Preserve user data: never delete or overwrite the local database, and never commit
  it to Git.
- Windows packaging must be verified where the environment supports it; if it cannot
  be verified, report that honestly and provide local verification commands.

## Action permissions

Ask before pushing, deploying, changing remote services or data, or modifying
credentials. Any exception needs explicit authorization for the specific action.
