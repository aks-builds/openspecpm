# OpenSpecPM — v2 Roadmap

This folder holds active OpenSpec changes for the next phase of OpenSpecPM. Each subdirectory is a self-contained proposal — the same artifact `openspecpm propose` would create — so the tool plans itself with itself.

For each change you'll find:

- **`proposal.md`** — problem, solution, success criteria, out-of-scope
- **`tasks.md`** — dependency-aware task list with `parallel:` and `effort_hours` flags
- **`specs/main.md`** — Given/When/Then scenarios that double as acceptance criteria

Run `openspecpm status` from the repo root to see the live count. Run `openspecpm next` to see what's ready to start. Run `openspecpm sync <feature>` to push any of these to the configured PM tool as a tracked epic + child tasks.

## Status

**Shipped (v1.0.0):** [`bdd-llm-reviewer`](bdd-llm-reviewer/proposal.md) — opt-in LLM judge augmenting the heuristic BDD linter (`cli/src/bdd/judge.js`), behind `--llm` on `propose` / `sync` / `validate`. See [CHANGELOG](../../CHANGELOG.md#100---2026-05-18) for the full release notes.

## Phases (remaining)

Five changes remain, sequenced into four phases. Pull `agent-orchestrator` forward only if you want headline impact ahead of momentum — it's the longest, riskiest piece of work.

| Phase | Change | Tasks | Effort (hrs) | Risk |
|---|---|---:|---:|---|
| 1 — Visibility | [`dependency-graph`](dependency-graph/proposal.md) | 8 | 18 | Low |
| 2 — Quality | [`spec-to-tests`](spec-to-tests/proposal.md) | 9 | 23 | Low |
| 3 — Trust | [`traceability-export`](traceability-export/proposal.md) | 9 | 31 | Medium |
| 4 — Reach | [`additional-adapters`](additional-adapters/proposal.md) | 9 | 52 | Low |
| 5 — Headline | [`agent-orchestrator`](agent-orchestrator/proposal.md) | 12 | 54 | High |
| | **Total** | **47** | **~178** | |

## What each change adds

### [`dependency-graph`](dependency-graph/proposal.md)
A `--graph` flag on `next` / `blocked` / `validate` that emits a Mermaid flowchart of cross-feature task dependencies, with critical-path highlighting and a `--max-nodes` cap. Closes the gap between the data the tool already has (`depends_on:` frontmatter) and what humans + agents can actually see.

### [`bdd-llm-reviewer`](bdd-llm-reviewer/proposal.md) — shipped in v1.0.0
Augments the heuristic linter in `cli/src/bdd/linter.js` with an LLM judge (Claude Haiku 4.5 + prompt caching) that catches what regex can't: cross-spec contradictions, missing coverage of declared success criteria, semantically-vague observable outcomes that pass the verb check. Soft on `propose`, hard gate on `sync`. Opt-in via `--llm` or `judge.enabled: true` in `.openspecpm/config.json`.

### [`spec-to-tests`](spec-to-tests/proposal.md)
`openspecpm scaffold-tests <feature> --target playwright|cucumber|jest` parses each spec file's Given/When/Then blocks and writes test stubs with traceability comments back to the source spec. Closes the loop from spec author to test author. Idempotent — preserves customized test bodies on re-run.

### [`traceability-export`](traceability-export/proposal.md)
`openspecpm trace [--export pdf|csv|json]` walks `audit.log` and the git log to produce the proposal → spec → task → external_id → PR → deploy matrix on demand. Targets regulated industries (insurance, financial services, healthcare). Audit-log gaps surface as explicit `(incomplete: <reason>)` markers, never silent.

### [`additional-adapters`](additional-adapters/proposal.md)
Notion (depth 3), ClickUp (depth 4), Asana (depth 3) — three new backends behind the same 9-method adapter contract. Brings the supported total to eight. Each plugs into the existing `init` wizard and `doctor` health-check flow.

### [`agent-orchestrator`](agent-orchestrator/proposal.md)
The big leap. `openspecpm run <feature>` graduates `fan-out` from prompt-emitter to actual dispatcher: launches Claude Code subagents per `parallel: true` task, tails their progress, posts updates, surfaces failures. Strict per-task file scoping prevents concurrent collisions. `--max-parallel`, `--token-budget`, and `--dry-run` keep runaway cost in check.

## Cross-cutting (every change carries these)

- `doctor` coverage for any new env var the change introduces
- BDD scenarios under `specs/` for the new commands or flags (the tool dogfoods)
- An audit-log entry per new command (`audit.log()` call)
- A regenerated screenshot in `docs/screenshots/` after the command stabilizes
- An entry in `help-table.js` so `openspecpm help-table` stays current
- A `CHANGELOG.md` bump
