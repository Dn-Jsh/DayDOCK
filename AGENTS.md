# Project engineering team

At the start of requested engineering work, read applicable instructions, `PROJECT-BRIEF.md`, current Git state and the existing ticket source. Treat blank fields as undecided. Inspect existing code, ask only for missing decisions, define a small usable first version and keep later features in the backlog. Establish a new Git repository before parallel worktrees.

## Team and task-based effort

Rob plans batches; Juan reviews architecture; Maya implements frontend; Josh owns backend/Supabase; Layra reviews design/accessibility; Laura independently verifies behavior. Keep `gpt-6.1-sol` for Rob/Josh/Laura and `gpt-6-luna` for Juan/Maya/Layra.

| Task | Requested effort |
| --- | --- |
| Routine planning, scoped fixes, ordinary implementation and targeted checks | `medium` |
| Difficult debugging, architecture, account boundaries, sync or uncertain native behavior | `high` |
| Selected gold-lane implementation and independent review | Sol `high`; Luna `max` |

New coordinator and six role defaults use medium. Select effort in the assignment packet and verify the effective launch receipt. Escalate for concrete complexity or a failed targeted attempt; never reset the repair limit. Report unavailable settings. Running sessions keep their settings until a supported control or new launch changes them; a prompt alone does not switch effort. Honor explicit per-task overrides.

## Scheduling and context

Prefer one implementer, then an independent reviewer; **at most two active specialists**, excluding the coordinator, across Orca/Codex. Nested workers count and need an allocated slot. Rob batches planning; use Juan/Layra when architecture/design needs them. Start roles when needed, not all six in advance. Reuse same-role workers for related tickets while preserving independent review.

Independent implementations need separate worktrees and explicit file ownership. Do not revert others' edits or start blocked dependencies. Run only **one heavy build, packaging job, emulator session or browser test suite** at a time.

Worker packet: ticket, owned files, candidate identity, criteria, required skills/checks and findings. Native workers use `fork_turns="none"`; include history only when needed. Orca needs real Run/Task/Dispatch state. Load compact version-matched guides once per session/runtime version, references or `--full` only when needed. Follow authoritative settlement/release rules.

Read relevant files/diffs. Load `caveman` once/session and retain it in chat; documents/code use normal prose. Load `ponytail` for relevant Maya/Josh coding or Juan simplification, default full. Preserve requirements, readable code, module boundaries, validation, data-loss handling, security, accessibility and existing test frameworks. Honor stop caveman, stop ponytail and normal mode. Reuse unchanged skills; do not replay history or load every plugin.

## Role skills

Read the primary skill for the assigned action, then relevant conditional skills. Include required names in the packet; reuse unchanged guidance. Report missing skills with meaningful alternatives, never false passes. Type safety, descriptive names, appropriate splitting and avoiding duplication remain requirements.

| Role | Primary skills for the action | Load when triggered |
| --- | --- | --- |
| Rob | `ticket-table` | `ticket-quoting` for quotes; `ticket-batching` for batches; `gold-lane-adapter` for gold |
| Juan | `architectural-review` | Complexity: `ponytail`, `karpathy-guidelines`, `code-splitting`, `dry-enforcement`, `descriptive-variable-naming`, `kaizen`; gold: `gold-lane-adapter` |
| Maya | `clean-code-typescript`, `ponytail` for coding | New design: `frontend-design`; component APIs: `shadcn`, `composition-patterns`; contracts: `typescript-discipline`; routes: `code-splitting`; SSR: `react-ssr-hydration`; UI: `accessibility-wcag`; refactors: `dry-enforcement`, `descriptive-variable-naming`; Android platform skills |
| Josh | Migrations: `db-migration-discipline`; authorization/access: `supabase-rls-boundaries`; coding: `ponytail` | SQL/index/performance: `supabase-postgres-best-practices`; contracts: `typescript-discipline`; relevant backend/API/sync skills |
| Layra | UI review: `accessibility-wcag`; design: `frontend-design` | `ui-ux-pro-max`, `web-design-guidelines`, `shadcn`, `dry-enforcement`, `descriptive-variable-naming`, platform skills for affected work |
| Laura | `code-review` | PR: `pr-review-toolkit`; security: `security-review`; UI: `accessibility-wcag`; type/style/browser/native guidance for related risks |

## Evidence, progress and completion

The coordinator owns the existing ticket source or `tickets.md`: stable ID, criteria, dependencies, owner, risk, lane, status, evidence. After each accepted assignment success/failure or ticket completion, show ID/task/owner/status, completed/total, next task, blockers and evidence before further scheduling. Use To do, In progress, Review, Testing, Done, Blocked. For large backlogs show the current milestone. Keep history separately; updates require an active coordinator.

Name Orca terminals `<Role> | <effective model> <effort> | <ticket ID>: <short action>` at launch/reuse/task change/settlement using `orca terminal rename` and issued handles. Mark unknown settings unverified. Native workers without terminals appear in the status report. Assignment completion alone is not a Done ticket.

Before Done load `engineering-gates` and `completion-mandate`; apply relevant gates with evidence and justified N/A. Establish an independent review baseline, then rerun affected checks and required final integration checks. Repeat full suites only for changed risk, a required gate or questionable evidence. Report unavailable checks and meaningful alternatives. Selected gold tickets require architecture/data-boundary review and independent Juan and Laura approvals of the same final candidate, sequential if needed. Done requires criteria, checks and reviews to pass. Stop after three failed repair attempts on the same issue; report the blocker.

Checkpoint before pausing: completed/remaining work, candidate, blockers, next action. Record model/effort, attempts and exposed usage at milestones; unavailable telemetry is not zero. File size and short replies do not prove monetary savings.

## Final summaries

Keep final user summaries to at most three short bullets: what changed or was fixed; where to see it with clickable file or app links; and material verification results or blockers only when needed. Keep detailed evidence in linked ticket/review records. Give more detail when the user asks. Required progress tables and safety notices still apply.

## Action boundaries

Ask before push/deploy, remote service/data changes, credentials or remote agents. Use Stripe test mode. Preserve explicit authorizations, project constraints and secrets; verify tools/connections. No removing skills/plugins to save usage without a specific request.
