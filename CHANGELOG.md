# Changelog

All notable changes to OpenSpecPM are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-05-18

### Security hardening — pass through audit findings

Eleven commits addressing every HIGH / MEDIUM / LOW-with-security-impact finding from the v1.0.0 quality audit. 113/113 tests; +14 new regression tests across the touched surfaces.

**HIGH severity:**

- **`cli/src/http.js`** — every adapter HTTP request now bounded by `AbortSignal.timeout(timeoutMs)` (default 30s). A hung Jira / ADO / Linear / GitLab endpoint no longer wedges `sync --all` indefinitely. New test confirms the request rejects within budget, not at wall-clock max.
- **`cli/src/adapters/azure.js`** + **`cli/src/adapters/gitlab.js`** — user-controlled `item.id` / `child.id` / `parent.id` (from `tasks.md` frontmatter, user-editable) now wrapped in `encodeURIComponent` before URL-path interpolation. Closes a path-injection vector — a typo'd `external_id: "1/../99"` no longer reaches unintended endpoints. Jira was already correct.
- **`cli/src/tracking.js`** — `loadChange` now validates that `tasks.md` frontmatter `items:` is an array of well-shaped objects (each with a string `title`). Malformed entries are silently dropped; non-array `items:` raises a clear error with a remediation pointing at the file to repair. Malformed YAML itself raises with file context instead of crashing deep with `TypeError: items is not iterable`.
- **`cli/src/openspec-bridge.js`** — new `assertSafeFeatureName()` rejects empty / non-string input, anything containing `..` / `/` / `\` / Windows drive letters, and anything outside `/^[a-z0-9][a-z0-9._-]*$/i`. Called at the top of `changeDir()`, `changeExists()`, and `propose()` so every entry point into the OpenSpec layout validates first. Closes path-traversal via feature name.
- **`cli/src/commands/sync.js`** + **`cli/src/commands/bulk.js`** — `sync`, `sync --all`, and `ship --all-ready` now throw at the end if any task or change failed, instead of swallowing per-task errors and returning 0. `openspecpm sync feature && deploy` in CI no longer proceeds on silent partial sync. Per-task `last_error` still persisted to `tasks.md` frontmatter for inspection.
- **`cli/src/notify.js`** — `fetch` response status is now checked instead of being discarded. A 401 / 403 / 500 from Slack / Teams / generic counts as an error, not a successful send. `standup --broadcast` no longer claims success when the webhook silently rejected.

**MEDIUM severity:**

- **`cli/tests/github-adapter.test.js`** — locked the leading-dash title behavior under array argv (M3). No code change needed; execa array-args + cobra's flag parser already handle `--title "--evil-flag"` correctly, but the regression test prevents a future refactor from breaking it.
- **`cli/src/audit.js`** — `SECRET_SEGMENTS` extended to include `bearer`, `cookie`, `session`, `webhook`, `signature`, `assertion`. New `scrubValue()` redacts webhook URLs from any string value (Slack hooks, MS Teams connectors, M365 webhooks). `record()`'s `result` and `error` fields now also go through `scrubValue`. **`cli/src/notify.js`** sanitizes its `target.url` from every error message at the source. Two-layer defense: the URL can't leak from notify's error path, and even if some other code path puts a webhook URL in an audit entry, the sink redacts it. (M6 + M11 + LOW-4)
- **`cli/bin/openspecpm.js`** — installed `uncaughtException` and `unhandledRejection` handlers that print sanitized message + remediation + a pointer to `audit.log`. A future programming bug (TypeError, etc.) no longer dumps Node's default stack trace with absolute install / tmp paths to stderr. (M8)
- **`cli/src/commands/sync.js`** — `extractSummary` now strips C0/C1 control chars (except TAB/LF/CR), DEL, zero-width / joiner chars, bidi overrides (LRE/RLE/PDF/LRO/RLO), and isolates (LRI/RLI/FSI/PDI) before sending the proposal body to the remote tracker as the epic description. Closes homograph / hidden-content vector in issue titles and bodies. (M9)

**LOW severity (defense-in-depth):**

- **`cli/src/adapters/azure.js`** — `listWorkItems` now allowlist-validates the WIQL `tag` against `/^[a-zA-Z0-9._:-]+$/`. Single-quote doubling escape already handled the only known WIQL string-literal breakout, but allowlist validation is more robust than escape-based protection. (LOW-1)

### Post-1.0 doc sweep

- **README.md:** lede tagline + flow Mermaid + "differences from CCPM" section now reference all five PM backends (GitHub, Azure DevOps, Jira, **Linear, GitLab**) instead of the original three. The "three differences" framing bumped to five — added bullets for audit-log-by-default and cross-feature task graphs, with the LLM judge folded into the BDD-authoring bullet.
- **README cross-cutting line:** added optional Slack / Teams / generic-webhook broadcasts on `standup --broadcast`.
- **README Roadmap:** marked `bdd-llm-reviewer` as shipped (no longer in the active 6); count adjusted to 5 remaining.
- **README Project structure:** rewritten to reflect actual `cli/src/` contents (20 commands, 5 adapters under `cli/src/adapters/`, `audit.js` / `notify.js` / `telemetry.js` / `install-hints.js` / `bdd/judge.js`), workflow set (`test.yml` + `auto-approve.yml` + `release.yml` + `publish.yml`), `docs/screenshots/`, and `openspec/changes/` v2 roadmap directory.
- **SKILL.md:** "three differences" → "five differences"; "(Sprint 3+)" / "(Sprint 3)" markers stripped from the workflow header and the phase table.
- **SECURITY.md:** out-of-scope vendor list extended with Linear + GitLab (the in-scope secrets list already had them).
- **`skill/openspecpm/references/{conventions,sync,execute,plan}.md`:** "(Sprint N)" / "(Sprint N+)" annotations stripped throughout — those markers were pre-1.0 development history noise, no longer meaningful.
- **`openspec/changes/README.md`:** added a "Shipped" section calling out `bdd-llm-reviewer` (v1.0.0); active roadmap table reduced from 6 to 5 changes; totals recomputed (47 tasks, ~178 hrs).
- **`openspec/changes/bdd-llm-reviewer/proposal.md`:** frontmatter `status: draft` → `status: shipped` with `shipped_in: 1.0.0` and `shipped_at: 2026-05-18`.
- **`cli/bin/openspecpm.js`:** `program.version()` now reads from `package.json` at runtime instead of the hardcoded `'0.1.0-alpha.0'`. Future `npm version` bumps keep `openspecpm --version` in sync automatically.

## [1.0.0] - 2026-05-18

### Fix — release.yml must use a user-owned PAT, not GITHUB_TOKEN

- `.github/workflows/release.yml`: switched the branch push and `gh pr create` from `secrets.GITHUB_TOKEN` to `secrets.RELEASE_PR_PAT`. **Why:** GitHub by design suppresses downstream workflow runs from events triggered by `GITHUB_TOKEN` (anti-recursion safeguard). With `GITHUB_TOKEN`, the auto-opened release PR's `pull_request: opened` event never reaches `auto-approve.yml` or `test.yml` — the PR sits forever waiting for an approval and a status check that will never report. A user-owned PAT is not subject to this rule. `CONTRIBUTING.md` § Releasing updated with the new required repo secret.

### v2 — automated release pipeline

- **`.github/workflows/release.yml`**: manually-dispatched release-preparation workflow. Click "Run workflow", pick a bump (`prerelease` / `patch` / `minor` / `major`), and the pipeline runs the test suite, bumps `package.json`, rolls `CHANGELOG.md` (`[Unreleased]` → `[X.Y.Z] - DATE`), opens a PR on a `release/vX.Y.Z` branch, and enables squash auto-merge. No direct push to `main`.
- **`.github/workflows/publish.yml`**: post-merge half of the pipeline. Fires when a `release/*` PR is merged into `main`. Reads the version from `package.json`, publishes to npm with sigstore provenance, syncs the `latest` dist-tag for pre-1.0 alpha releases, tags the merge commit, creates a GitHub release with the just-rolled changelog section as the body.
- **`auto-approve.yml` reusable workflow** (at `aks-builds/workflows`): extended to support an optional `APPROVER_PAT` secret alongside the existing `APPROVER_APP_ID` + `APPROVER_APP_PRIVATE_KEY`. The PAT path runs as a second parallel job and posts a review under the PAT-owning user's identity — useful when branch protection requires multiple distinct approvers, or to keep a real human-account review in the audit trail alongside the bot. Either, both, or neither path can be configured per consuming repo; an unconfigured path runs cleanly and exits without posting a review. See `CONTRIBUTING.md` § Releasing for repo-secret setup.

### v2 — LLM-backed BDD judge

- **`cli/src/bdd/judge.js`**: opt-in LLM judge that augments the heuristic BDD linter. Behind `--llm` flag on `propose`, `sync`, `validate`, or `judge.enabled: true` in `.openspecpm/config.json`. Uses Claude Haiku 4.5 via `@anthropic-ai/sdk`, with `tool_use` for structured `report_findings` output and `cache_control: ephemeral` on the proposal system block so re-runs across multiple specs in one feature reuse the cache. Emits three new rule IDs: `bdd/llm-contradiction` (cross-spec contradictions), `bdd/llm-missing-coverage` (success criteria with no scenario), `bdd/llm-vague-then` (Then predicates that pass regex but state no observable outcome). Findings share the existing `LintFinding` shape so they merge with heuristic output via a single spread.
- **`cli/src/commands/doctor.js`**: always-on `[judge]` section probes `ANTHROPIC_API_KEY` with English remediation hint, mirroring the per-adapter layout.
- **`cli/src/audit.js`**: `record()` now accepts an optional `meta` field; the judge logs `{model, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}` per LLM call so cache hit rate is auditable from `.openspecpm/audit.log`.
- **`sync --llm`**: judge runs alongside heuristic lint; LLM errors block sync unless `--force` overrides. Network/auth failures degrade with a remediation hint pointing at `doctor`.
- **`propose --llm`**: judge runs as soft-lint only; never aborts proposal authoring on judge failure.
- **`validate --llm`**: judge runs per change; failures degrade into `bdd/llm-parse-error` findings rather than aborting the sweep.
- **`@anthropic-ai/sdk ^0.65.0`** added to `dependencies`. New `cli/tests/judge.test.js` covers the merged-findings shape, parse-error degradation, `onUsage` callback, parallel fan-out across specs, the cache_control invariant, and unknown-rule filtering — all against a plain stub client, zero real network calls.
- **Doc sweep**: README command table flags `--llm` on `propose` / `sync` / `validate` rows; SKILL.md script-first table mirrors it; `references/conventions.md` lists `ANTHROPIC_API_KEY` under Secrets; `openspec/changes/bdd-llm-reviewer/tasks.md` items marked `sync_state: created`.

### Post-Sprint 6 — docs, CI, v2 planning

- **v2 roadmap scaffolded as 6 OpenSpec changes** under `openspec/changes/` (dogfood: the tool plans itself with itself). Each change has a full proposal, dependency-aware tasks.md, and BDD scenarios. Roadmap index lives at `openspec/changes/README.md`. Features: `dependency-graph`, `bdd-llm-reviewer`, `spec-to-tests`, `traceability-export`, `additional-adapters` (Notion + ClickUp + Asana), `agent-orchestrator`.
- **CI tests badge moved to a Gist-backed shields.io endpoint** updated via `schneegans/dynamic-badges-action`. The previous workflow tried to push the badge JSON back to `main`, which branch protection (rightly) rejects. The gist approach updates badge data without ever pushing to main. Required repo settings: `GIST_SECRET` secret (PAT with `gist` scope) + `TESTS_BADGE_GIST_ID` variable.
- **Test-count parsing fix in `.github/workflows/test.yml`**: `node --test` emits a `ℹ`-prefixed summary on TTY and `#`-prefixed (TAP) on CI. The old regex only matched `ℹ`, so badges silently read 0 in CI. Regex now matches both.
- **README screenshot pipeline** at `docs/screenshots/render.ps1`: self-contained PowerShell renderer that scaffolds sample OpenSpec changes via `propose --offline`, captures 6 commands (`help-table`, `doctor`, `status`, `next`, `blocked`, `validate`) as terminal-style PNGs using `System.Drawing`, then cleans up. Working tree stays clean.
- **README ASCII flow diagram** converted to a Mermaid `flowchart LR` block, matching the existing Architecture + Lifecycle diagrams.
- **Stale-doc sweep**: Linear and GitLab (added Sprints 5–6) now appear in `SKILL.md`, `references/sync.md` (field-mapping table + capabilities + opening line), `references/structure.md` (hierarchy table), `references/conventions.md` (env vars), `SECURITY.md`, both issue templates, and the PR template. `SKILL.md` script-first table now includes `assign`, `watch`, `doctor --install`, `doctor --setup-auth`, `sync --all`, `ship --all-ready`. `CONTRIBUTING.md` test count corrected (49 → 91).

### Sprint 6

- `doctor --install`: OS-detected install hints (winget on Windows, brew on macOS, apt on Linux) for `gh`, `az`, and `openspec`. Linear/GitLab/Jira don't need a CLI.
- `doctor --setup-auth`: prints the PAT/token creation URL and required scopes for each adapter. Reduces the #1 onboarding cliff to one command.
- Change-type templates (`cli/src/bdd/templates.js`): `feature`, `bug`, `refactor`, `incident`. `propose --type bug` (etc.) selects the template; `--offline` scaffolds from templates without calling `openspec` so users without OpenSpec installed can still start.
- Brownfield-aware `init`: detects existing `openspec/` and notes that it will be reused rather than re-initialized.
- Bulk operations: `sync --all` walks every change with confirmation + per-feature error isolation; `ship --all-ready` ships changes whose tasks are all `sync_state: created` (no pending/failed).
- `sync --diff`: prints the adapter + capabilities summary alongside the call plan.
- `watch [feature]`: debounced recursive `fs.watch` over `openspec/changes/`. Re-runs BDD lint per change, or `validate` with `--all`. SIGINT-clean.
- Notifications (`cli/src/notify.js`): Slack incoming-webhook + Teams MessageCard + generic JSON envelope. Configured via `config.notify.{slack,teams,generic}`. Wired into `standup --broadcast`. Errors per target are collected, never raised.
- Telemetry scaffold (`cli/src/telemetry.js`): opt-in via `config.telemetry.enabled = true`. Alpha policy: data is mirrored to the audit log only — **no network calls**. Captures command/duration/adapter/OS; never feature names or repo identifiers.
- Plugin hook documented: `registerAdapter()` was added in Sprint 5; templates and notify both expose their config shapes for third parties to extend.
- Tests: +14 (templates per type, notify routing per platform, install-hints lookup). Total 91/91 green.

### Sprint 5

- Linear adapter (GraphQL at `api.linear.app/graphql`). Bearer auth via `LINEAR_API_KEY`. Full 9-method implementation: projectCreate for epics, issueCreate with parent linkage, cycle/estimate fields for sprints/story-points, workflow-state lookup for close, viewer query for doctor.
- GitLab adapter (REST v4). PAT auth via `GITLAB_TOKEN` with `api` scope. Issues + issue links (`relates_to`/`blocks`), milestones as sprints, `weight` as story points, `state_event=close` for close.
- Plugin hook: `registerAdapter(name, ctor, { aliases })` in `cli/src/adapters/index.js` lets third parties register without forking.
- Cross-feature `depends_on`: tasks may reference `<feature>/<task-title>` or `<feature>/<external-id>`. `findNextTasks` and `findBlockedTasks` walk the full change set and resolve across features. Legacy same-change deps still work.
- `assign <feature> <task>` command: sets assignee / sprint / iteration / area / story-points on a synced work item via `adapter.updateWorkItem`. Backend-agnostic surface — adapters pick up the keys they support.
- GitHub adapter: `listChildren(parent)` and `removeChild(parent, child)` for full sub-issue hierarchy management.
- Integration test harness under `cli/tests/integration/` — gated on `OPENSPECPM_INTEGRATION=1` + per-backend env vars. README + harness helpers; CI does not run them.
- Init wizard adds Linear + GitLab options with auth hints.
- Tests: +14 (Linear adapter contract, GitLab adapter contract, cross-feature deps). Total 77/77 green.

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
