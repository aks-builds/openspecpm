# Changelog

All notable changes to OpenSpecPM are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Sprint 4

- `comment <feature> <task>`: post local `progress.md` (or `-m "..."`) to the PM tool with an auto-generated `<!-- SYNCED: <iso> -->` marker; appends to local progress for traceability.
- `reconcile <feature>`: fetches every task with an `external_id` via `adapter.getWorkItem` and mirrors the remote `status`/`assignee` into local task frontmatter. Detects out-of-band closes so `next`/`blocked` reflect remote truth.
- `decompose <feature>`: extracts tasks from proposal headings, GitHub-style checklists, "Tasks" sections, and BDD scenarios in `specs/`. Refuses to overwrite an existing `tasks.md` without `--force`.
- `validate`: walks every change checking proposal frontmatter shape, task schema (`sync_state` enum, required fields, duplicate titles), `depends_on` reference resolution, and BDD lint summary. Exits non-zero on any error.
- `search <query>`: case-insensitive regex grep across `openspec/changes/**/*.md`. `--case-sensitive` and `-l <limit>` flags.
- `fan-out <feature>`: emits ready-to-paste agent prompts for `parallel: true` tasks with no unmet deps. Each prompt embeds the proposal summary, design notes, and the linked BDD spec as acceptance criteria.
- `bug-report <feature> <task> --title "..."`: files a regression bug via `adapter.createWorkItem`, links it to the original via `linkWorkItems`, comments on the original. Works against all three adapters.
- `help-table [topic]`: CCPM-style topical help. Groups commands by phase (Setup / Plan / Sync / Track / Execute-Ship).
- Audit log (`cli/src/audit.js`): every command appends a JSONL entry to `.openspecpm/audit.log` with timestamp, args (secrets scrubbed), and result/error. Wrapped via `audited()` helper in `cli/bin/openspecpm.js`.
- Tests: +9 covering audit (record + scrub + audited wrapper), validate inputs, decompose heuristics + idempotency, search. Total 58/58 green.

### Sprint 3

- BDD linter (`cli/src/bdd/linter.js`): parses `Scenario:` blocks, runs heuristic checks (one Given/When/Then, observable verbs in Then, deny-list for vague phrases, tautology detection via word-bigram similarity). Soft mode at `propose`, hard mode at `sync` with `--force` override.
- Tracking commands: `status` (per-change task counts), `standup` (recent `progress.md` updates with `--since 12h/2d/1w`), `next` (open tasks with satisfied deps), `blocked` (tasks waiting on unmet deps with reasons).
- `ship <feature>`: closes every synced work item via the adapter, closes the epic, then shells out to `openspec archive`. Two-step confirmation (or `-y`).
- `cli/src/tracking.js` helper: `listChanges`, `loadChange`, `findNextTasks`, `findBlockedTasks`, `findRecentUpdates`, `unmetDeps`, `summarizeChange`.
- `references/track.md` skill doc.
- Final SKILL.md description with all Sprint 3 trigger phrases and sharpened non-triggers vs CCPM.
- 12 new tests (BDD linter + tracking), 49 total.

### Sprint 2

- Azure DevOps Boards adapter (REST + PAT auth). All 9 adapter methods implemented: WIQL list, JSON-Patch create/update, Parent/Child hierarchy links, state-based close, comments.
- Jira adapter (REST v3 + email/API-token auth). All 9 methods implemented: JQL list, ADF descriptions, issue links, transition-based close, comments.
- Shared HTTP helper (`cli/src/http.js`) with Basic-auth injection, JSON parsing, status-code-aware remediation hints.
- Contract tests for both REST adapters against mocked `fetch` (21 new tests, 37 total).
- Skill references: `structure.md`, `sync.md`, `execute.md` (covering capabilities-driven hierarchy collapse, idempotency contract, field-mapping table per backend, hidden-by-default worktrees).
- `doctor ado` and `doctor jira` validate auth + reach the backend's identity endpoint.

### Sprint 1

- Repo scaffold: Node CLI with Commander, OpenSpec bridge with version-probe anti-corruption layer.
- Adapter base class + `capabilities()` contract.
- GitHub adapter (uses `gh` CLI).
- `openspecpm init` interactive wizard (`@clack/prompts`).
- `openspecpm doctor github` with English remediation hints.
- `openspecpm propose` (wraps OpenSpec) and `openspecpm sync` (idempotent, frontmatter-tracked).
- Agent Skill scaffold under `skill/openspecpm/` with conventions + plan references.
- 16 unit + contract tests; GitHub Actions CI on Node 20.
