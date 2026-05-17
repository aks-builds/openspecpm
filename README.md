# OpenSpecPM — Spec-driven PM for any backend

[![test](https://github.com/aks-builds/openspecpm/actions/workflows/test.yml/badge.svg?event=push)](https://github.com/aks-builds/openspecpm/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Spec-driven, BDD-shaped project management for AI agents — author once in [OpenSpec](https://github.com/Fission-AI/OpenSpec), sync to GitHub Issues, Azure DevOps Boards, or Jira.

OpenSpecPM turns natural-language intent ("plan X", "sync the X epic", "what's blocked") into a disciplined flow:

```
idea → proposal.md (OpenSpec) → BDD specs (Given/When/Then) → tasks
     → tracked work items (GitHub | ADO | Jira) → shipped code
```

It is a sibling of [CCPM](https://github.com/automazeio/ccpm), with three differences:

1. **OpenSpec drives spec authoring**, not a bespoke PRD format. Every feature gets `proposal.md`, `design.md`, `tasks.md`, and a `specs/` folder of BDD scenarios.
2. **The PM tool is pluggable.** An interactive wizard asks once at `init` time; adapters cover GitHub Issues/Projects, Azure DevOps Boards, and Jira.
3. **Built for non-engineers too.** Project managers, BAs, and program managers can drive the flow without seeing git worktrees or terminal scars. A `doctor` command owns auth-setup pain.

## Status

Sprint 1 ✅: GitHub adapter, OpenSpec bridge, init/propose/sync/doctor commands.
Sprint 2 ✅: Azure DevOps + Jira adapters (REST), contract tests, structure/sync/execute references.
Sprint 3 (planned): BDD linter, status/standup/next/blocked/ship, README polish, `npm publish`.

See [`CHANGELOG.md`](CHANGELOG.md) for the running log.

## Install

```bash
# As a CLI (any harness)
npx openspecpm@latest init

# As a Claude Code Agent Skill
# (copy skill/openspecpm/ into your Claude Code skills directory; SKILL.md handles routing)
```

OpenSpecPM shells out to [OpenSpec](https://github.com/Fission-AI/OpenSpec); install it first:

```bash
npm install -g @fission-ai/openspec
```

## Usage

Once initialized, the CLI mirrors CCPM's natural-language triggers:

| What you want | Command |
|---|---|
| First-time setup, pick a PM tool | `npx openspecpm init` |
| Check auth health | `npx openspecpm doctor` |
| Author a proposal (PRD-equivalent) | `npx openspecpm propose <feature>` |
| Push proposal + tasks to PM tool | `npx openspecpm sync <feature>` |
| Project status | `npx openspecpm status` (Sprint 3) |
| Standup digest | `npx openspecpm standup` (Sprint 3) |

In Claude Code, just say it: *"plan a feature called dark-mode"*, *"sync the dark-mode epic to Jira"*, *"what's blocked"* — the skill routes intent to the right phase.

## Workflow phases

OpenSpecPM is organized into five phases, mirrored from CCPM:

1. **Plan** — capture requirements via OpenSpec proposal, including BDD scenarios.
2. **Structure** — decompose the proposal into numbered tasks.
3. **Sync** — push proposal + tasks to your PM tool (GitHub/ADO/Jira).
4. **Execute** — start working on a tracked item; parallel agents where useful.
5. **Track** — status, standup, what's next, what's blocked.

Each phase has a reference doc under [`skill/openspecpm/references/`](skill/openspecpm/references/).

## Skill structure

```
skill/openspecpm/
├── SKILL.md
└── references/
    ├── conventions.md   # file paths, frontmatter schemas, BDD format
    ├── plan.md          # propose + BDD authoring
    ├── structure.md     # decompose into tasks
    ├── sync.md          # adapter-aware sync
    ├── execute.md       # start work on a tracked item
    ├── track.md         # status, standup, search
    └── scripts/         # thin shims that exec the Node CLI
```

## Why three adapters

Different teams live in different tools. Shipping all three from v0.1 means OpenSpecPM works the day you adopt it — no "wait for v0.3 when we add Jira" friction. The adapter interface is uniform; differences (hierarchy depth, sprint/iteration fields) are surfaced via a `capabilities()` method so the sync layer degrades gracefully when a target backend can't represent the full task tree.

## License

[MIT](LICENSE)
