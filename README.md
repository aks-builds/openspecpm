# OpenSpecPM — Spec-driven PM for any backend

[![test](https://github.com/aks-builds/openspecpm/actions/workflows/test.yml/badge.svg?event=push)](https://github.com/aks-builds/openspecpm/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![tests](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Faks-builds%2Fopenspecpm%2Fmain%2F.github%2Fbadges%2Ftests.json)](cli/tests)

> Spec-driven, BDD-shaped project management for AI agents — author once in [OpenSpec](https://github.com/Fission-AI/OpenSpec), sync to GitHub Issues, Azure DevOps Boards, or Jira.

OpenSpecPM turns natural-language intent ("plan X", "sync the X epic", "what's blocked", "ship X") into a disciplined flow:

```
idea → proposal.md (OpenSpec) → BDD specs (Given/When/Then) → tasks
     → tracked work items (GitHub | ADO | Jira) → shipped code
```

It is a sibling of [CCPM](https://github.com/automazeio/ccpm), with three differences:

1. **OpenSpec drives spec authoring** — every feature gets `proposal.md`, `design.md`, `tasks.md`, and a `specs/` folder of BDD scenarios.
2. **The PM tool is pluggable** — an interactive wizard at `init` time picks GitHub Issues/Projects, Azure DevOps Boards, or Jira.
3. **Built for non-engineers too** — PMs/BAs/PgMs can drive the flow. A `doctor` command owns auth-setup pain. Worktrees are hidden by default.

## Install

```bash
# Standalone CLI (any harness)
npx openspecpm@latest init

# Claude Code Agent Skill
# Copy skill/openspecpm/ into your Claude Code skills directory.
# SKILL.md handles routing — just talk to Claude.
```

OpenSpecPM shells out to [OpenSpec](https://github.com/Fission-AI/OpenSpec); install it first:

```bash
npm install -g @fission-ai/openspec
```

## Quick start

```bash
# 1. One-time setup. The wizard asks which PM tool your team uses.
npx openspecpm init

# 2. Verify auth before doing anything remote.
npx openspecpm doctor

# 3. Author a proposal. OpenSpec generates proposal.md, design.md, tasks.md,
#    and BDD scenarios in specs/. Soft BDD-lint runs after authoring.
npx openspecpm propose dark-mode --prompt "Per-user dark theme with persistence."

# 4. Review the generated files. Refine BDD scenarios until lint is clean.

# 5. Sync to the PM tool. Hard BDD lint runs first; pass --force to override.
npx openspecpm sync dark-mode

# 6. Pick up where you left off.
npx openspecpm next        # tasks ready to start
npx openspecpm blocked     # tasks waiting on dependencies
npx openspecpm standup     # progress updates in the last 24h

# 7. When the feature is verified, close + archive.
npx openspecpm ship dark-mode
```

## Command reference

| Command | What it does |
|---|---|
| `init` | Interactive wizard. Picks the PM tool. Writes `.openspecpm/config.json`. |
| `doctor [adapter]` | Auth/tooling health check. English remediation hints on every failure. |
| `propose <feature>` | Shell out to OpenSpec; create `openspec/changes/<feature>/`. Soft-lint BDD scenarios. |
| `decompose <feature>` | Extract tasks from proposal headings/checklists + BDD scenarios into `tasks.md`. |
| `sync <feature>` | Hard-lint BDD, then create/update work items in the PM tool. Idempotent. |
| `comment <feature> <task>` | Broadcast local `progress.md` (or `-m`) to the PM tool with `<!-- SYNCED -->` marker. |
| `reconcile <feature>` | Pull remote work-item state into local frontmatter. Detects out-of-band closes. |
| `bug-report <feature> <task> --title "…"` | File a linked regression against a shipped task. |
| `status` | Per-change task counts: pending / created / failed / done. |
| `standup [--since 24h]` | Recent `progress.md` updates, newest first. |
| `next [-l 5]` | Tasks with no unmet dependencies. |
| `blocked` | Tasks waiting on unmet dependencies (with reasons). |
| `validate` | Schema + dependency + BDD-lint sweep across every change. |
| `search <query>` | Grep across proposals, specs, tasks, progress notes. |
| `fan-out <feature>` | Emit ready-to-paste agent prompts for `parallel: true` tasks. |
| `ship <feature> [-y]` | Close all task work items + close the epic + archive the OpenSpec change. |
| `help-table [topic]` | Context-aware command reference grouped by workflow phase. |

Every command appends a JSONL entry (secrets scrubbed) to `.openspecpm/audit.log`.

## Architecture

```mermaid
flowchart TD
    PM([👤 Project Manager / BA])
    Dev([👤 Developer])
    Agent([🤖 AI Agent · Claude Code])

    Skill["**Agent Skill**<br/>skill/openspecpm/SKILL.md<br/><br/>Routes natural-language intent"]
    CLI["**Node CLI**<br/>cli/bin/openspecpm.js<br/><br/>Commander dispatch + audit"]

    subgraph CMDS["📋 Commands · cli/src/commands/"]
        direction LR
        Setup["**① Setup**<br/>init • doctor"]
        Plan["**② Plan**<br/>propose • decompose"]
        SyncCmd["**③ Sync**<br/>sync • comment • reconcile<br/>assign • bug-report"]
        Track["**④ Track**<br/>status • standup • next<br/>blocked • validate • search • watch"]
        Exec["**⑤ Execute / Ship**<br/>fan-out • ship • help-table"]
    end

    subgraph CORE["⚙️ Core services · cli/src/"]
        direction LR
        Bridge["**OpenSpec Bridge + BDD**<br/>openspec-bridge.js<br/>bdd/linter.js"]
        TrackingS["**Tracking + Audit**<br/>tracking.js<br/>audit.js"]
        HTTP["**HTTP + Rate-limit**<br/>http.js<br/>ratelimit.js"]
        IO["**Config + Notify + Telemetry**<br/>config.js • notify.js<br/>telemetry.js"]
    end

    subgraph ADAPTERS["🔌 Adapter contract · cli/src/adapters/ · 9 methods + capabilities()"]
        direction LR
        GHA["**GitHub**<br/>depth 2"]
        AzA["**Azure DevOps**<br/>depth 4"]
        JiA["**Jira**<br/>depth 3"]
        LiA["**Linear**<br/>depth 2"]
        GlA["**GitLab**<br/>depth 2"]
    end

    subgraph EXT["☁️ External PM systems"]
        direction LR
        GHE[("GitHub<br/>Issues / Projects")]
        AzE[("Azure DevOps<br/>Boards")]
        JiE[("Jira<br/>Cloud / Server")]
        LiE[("Linear")]
        GlE[("GitLab<br/>Issues")]
    end

    subgraph PERSIST["💾 Persistence & sinks"]
        direction LR
        FS1["📁 **openspec/**<br/>changes/&lt;feature&gt;/<br/>• proposal.md<br/>• specs/*.md (BDD)<br/>• tasks.md<br/>• updates/progress.md"]
        FS2["📁 **.openspecpm/**<br/>• config.json<br/>• audit.log (JSONL)<br/>• state.json"]
        Sinks["🔔 **Webhooks**<br/>• Slack<br/>• Teams<br/>• Generic JSON"]
    end

    PM --> Skill
    Dev --> CLI
    Agent --> Skill
    Skill -- invokes --> CLI
    CLI --> CMDS
    CMDS --> CORE
    CORE --> ADAPTERS

    GHA --> GHE
    AzA --> AzE
    JiA --> JiE
    LiA --> LiE
    GlA --> GlE

    Bridge -. writes .-> FS1
    TrackingS -. writes .-> FS1
    IO -. writes .-> FS2
    IO -. broadcast .-> Sinks

    classDef user fill:#DAE8FC,stroke:#6C8EBF,color:#000
    classDef agent fill:#FFE0B2,stroke:#D97757,color:#000
    classDef entry fill:#C5E1A5,stroke:#558B2F,color:#000
    classDef skill fill:#FFE0B2,stroke:#D97757,color:#000
    classDef github fill:#222,stroke:#000,color:#fff
    classDef azure fill:#0078D7,stroke:#005A9E,color:#fff
    classDef jira fill:#0052CC,stroke:#003580,color:#fff
    classDef linear fill:#5E6AD2,stroke:#3F47A0,color:#fff
    classDef gitlab fill:#FC6D26,stroke:#C44A19,color:#fff
    classDef ext fill:#fff,stroke:#333,stroke-width:3px,color:#000
    classDef fs fill:#fff,stroke:#444,stroke-width:2px,color:#000

    class PM,Dev user
    class Agent agent
    class CLI entry
    class Skill skill
    class GHA github
    class AzA azure
    class JiA jira
    class LiA linear
    class GlA gitlab
    class GHE,AzE,JiE,LiE,GlE ext
    class FS1,FS2,Sinks fs
```

## Lifecycle

```mermaid
flowchart LR
    Idea["💡 **Idea**<br/>stakeholder feature,<br/>bug, or refactor"]

    subgraph P1["① PLAN"]
        direction TB
        Propose["**openspecpm propose**<br/>Shells out to OpenSpec<br/>Soft BDD lint"]
        Decompose["**openspecpm decompose**<br/>Extract tasks from<br/>proposal + BDD"]
        Propose --> Decompose
    end

    subgraph P2["② REVIEW + SYNC"]
        direction TB
        Review["👀 **Human review**<br/>Sign off on BDD"]
        Validate["**openspecpm validate**<br/>Schema + BDD sweep"]
        SyncCmd["**openspecpm sync**<br/>Hard BDD lint<br/>Idempotent"]
        Review --> Validate --> SyncCmd
    end

    subgraph P3["③ EXECUTE"]
        direction TB
        Next["**openspecpm next**"]
        FanOut["**openspecpm fan-out**<br/>Parallel agent prompts"]
        Build["🤖 **Implement**<br/>BDD = acceptance criteria"]
        Comment["**openspecpm comment**<br/>Broadcast progress"]
        Reconcile["**openspecpm reconcile**<br/>Pull remote state"]
        Next --> FanOut --> Build --> Comment --> Reconcile
    end

    subgraph P4["④ TRACK"]
        direction TB
        Status["**Track commands**<br/>status • standup<br/>blocked • search<br/>watch • bug-report"]
    end

    subgraph P5["⑤ SHIP"]
        direction TB
        Ship["**openspecpm ship**<br/>Close tasks + epic<br/>Archive change"]
        Shipped["🚀 **Shipped**"]
        Ship --> Shipped
    end

    Idea --> P1
    P1 --> P2
    P2 --> P3
    P3 --> P4
    P4 --> P5
    Shipped -. next feature .-> Idea

    classDef ideaC fill:#FFF9C4,stroke:#F9A825,color:#000
    classDef cmdC fill:#D5E8D4,stroke:#82B366,color:#000
    classDef humanC fill:#FFF9C4,stroke:#F9A825,color:#000
    classDef agentC fill:#FFE0B2,stroke:#D97757,color:#000
    classDef shipC fill:#FFCDD2,stroke:#D32F2F,color:#000
    classDef doneC fill:#C8E6C9,stroke:#2E7D32,color:#000

    class Idea ideaC
    class Propose,Decompose,Validate,SyncCmd,Next,FanOut,Comment,Reconcile,Status cmdC
    class Review humanC
    class Build agentC
    class Ship shipC
    class Shipped doneC
```

> Cross-cutting on every command: audit log (`.openspecpm/audit.log`, secrets scrubbed) · token-bucket rate-limiting per adapter · OpenSpec version probe · optional opt-in telemetry.

## Workflow phases

OpenSpecPM is organized into five phases, each with a reference doc under [`skill/openspecpm/references/`](skill/openspecpm/references/):

1. **Plan** ([`plan.md`](skill/openspecpm/references/plan.md)) — Capture requirements through an OpenSpec proposal + BDD scenarios.
2. **Structure** ([`structure.md`](skill/openspecpm/references/structure.md)) — Decompose into tasks with explicit dependencies and parallelism hints.
3. **Sync** ([`sync.md`](skill/openspecpm/references/sync.md)) — Push to the PM tool. Capabilities-driven hierarchy collapse for flatter backends.
4. **Execute** ([`execute.md`](skill/openspecpm/references/execute.md)) — Start work on a tracked item. Optional worktrees, parallel-agent dispatch.
5. **Track** ([`track.md`](skill/openspecpm/references/track.md)) — Status, standup, next, blocked, ship.

## Architecture highlights

- **Adapter contract.** Every backend implements the same 9-method interface plus `capabilities()` reporting hierarchy depth (GitHub=2, Jira=3, ADO=4). The sync layer collapses levels gracefully.
- **OpenSpec anti-corruption layer.** Version-pinned probe on every CLI invocation. One constant absorbs upstream path moves.
- **Idempotent sync.** Each task carries `sync_state` + `external_id` in frontmatter. Re-running `sync` skips created items and retries failures. Comments use `<!-- SYNCED: <ts> -->` markers to prevent duplication.
- **Token-bucket rate-limiting.** Per-adapter presets tuned for each backend's published limits.
- **BDD linter.** Heuristic checks: one Given/When/Then per scenario, observable verbs in Then, deny-list for vague phrases ("should work"), tautology detection via word-bigram similarity.

## Project structure

```
openspecpm/
├── README.md              this file
├── LICENSE                MIT
├── CHANGELOG.md
├── package.json
├── .github/workflows/test.yml
├── skill/openspecpm/      Claude Code Agent Skill
│   ├── SKILL.md
│   └── references/        conventions, plan, structure, sync, execute, track
└── cli/
    ├── bin/openspecpm.js  Commander entrypoint
    ├── src/
    │   ├── commands/      init, doctor, propose, sync, status, standup, next, blocked, ship
    │   ├── adapters/      base, github, azure, jira, index
    │   ├── bdd/           linter, templates
    │   ├── http.js        REST helper for ADO + Jira
    │   ├── tracking.js    listChanges, findNext, findBlocked, findRecent
    │   ├── openspec-bridge.js
    │   ├── config.js
    │   ├── frontmatter.js
    │   └── ratelimit.js
    └── tests/             unit + contract tests (count badge is auto-updated by CI)
```

## License

[MIT](LICENSE)
