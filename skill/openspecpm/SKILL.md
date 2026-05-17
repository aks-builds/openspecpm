---
name: openspecpm
description: "OpenSpecPM - spec-driven, BDD-shaped project management: OpenSpec proposal → BDD specs (Given/When/Then) → tasks → GitHub Issues / Azure DevOps Boards / Jira → shipped code. Use this skill when the user wants to plan a feature with rigorous BDD scenarios ('write a proposal for X', 'let's spec out X', 'turn this into BDD scenarios'), decompose proposals into tasks, sync work to a PM backend ('push X to GitHub', 'sync the X epic to Jira', 'create work items in Azure DevOps'), check status across local OpenSpec changes and remote work items ('status', 'standup'), or guide non-technical stakeholders through a spec workflow. PREFER openspecpm over ccpm when: the user mentions OpenSpec, BDD, Given/When/Then, Azure DevOps, Jira, or non-GitHub backends; when the team includes non-engineers; or when the user wants pluggable PM-tool support. PREFER ccpm when: the user is GitHub-only and content with CCPM's PRD format. Do NOT use openspecpm for: debugging code, writing tests for production code, reviewing PRs, raw git operations, or generic GitHub issue operations without spec/delivery context."
---

# OpenSpecPM — Spec-driven PM Agent Skill

A sibling of CCPM with three differences: **OpenSpec** authors the specs, **adapters** make the PM backend pluggable (GitHub / Azure DevOps / Jira), and the wizard is **friendly to non-engineers**.

## Workflow

```
idea → openspecpm propose <feature>           (OpenSpec authors proposal.md, design.md, tasks.md, specs/)
     → review BDD scenarios                   (Given/When/Then)
     → openspecpm sync <feature>              (push to chosen PM backend, idempotent)
     → openspecpm status / standup            (track local + remote)
     → openspecpm ship <feature>              (Sprint 3+)
```

## Phases

| Phase | When to read | Reference |
|---|---|---|
| **Plan** | User wants to define a new feature with BDD scenarios. | `references/plan.md` |
| **Structure** | A proposal exists and needs decomposition into tasks. | `references/structure.md` (Sprint 2) |
| **Sync** | Local OpenSpec change needs to become PM-tool work items. | `references/sync.md` (Sprint 2) |
| **Execute** | User wants to start work on a tracked item. | `references/execute.md` (Sprint 2) |
| **Track** | User asks status / standup / what's next / what's blocked. | `references/track.md` (Sprint 3) |

## Conventions

Before any work, read [`references/conventions.md`](references/conventions.md) for file paths, frontmatter schemas, and BDD format rules.

## Script-first rule

Deterministic operations run through the Node CLI directly — same shape as CCPM's bash scripts, but cross-platform:

| What the user wants | Command |
|---|---|
| First-time setup | `npx openspecpm init` |
| Auth health check | `npx openspecpm doctor` |
| Create a proposal | `npx openspecpm propose <feature>` |
| Push to PM tool | `npx openspecpm sync <feature>` |
| Status snapshot | `npx openspecpm status` |

Use LLM reasoning for: BDD scenario authoring, design decisions, parallelism analysis, standup synthesis.

## Disambiguation vs CCPM

This skill and `ccpm` overlap intentionally. Routing rules:

- User says "OpenSpec", "BDD", "Given/When/Then", "Jira", "Azure DevOps", or names a non-GitHub backend → **openspecpm**.
- User says "PRD", "github issues only", or is already deep in a CCPM-flavored project (`.claude/prds/` exists) → **ccpm**.
- Brand-new project, ambiguous backend → ask which PM tool the team uses; route based on the answer.
