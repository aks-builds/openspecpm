---
name: openspecpm
description: "OpenSpecPM — spec-driven, BDD-shaped project management for any PM backend: OpenSpec proposal → BDD specs (Given/When/Then) → tasks → GitHub Issues / Azure DevOps Boards / Jira / Linear / GitLab → shipped code. Use this skill when the user wants to (a) author a proposal with rigorous BDD scenarios ('write a proposal for X', 'spec out X', 'turn this into Given/When/Then'), (b) decompose a proposal into tasks ('break down the X proposal', 'split this into work items'), (c) sync work to a PM backend ('push X to GitHub', 'sync the X epic to Jira', 'create work items in Azure DevOps', 'push to Linear', 'create GitLab issues'), (d) broadcast progress or reconcile drift ('post my update on task Y', 'pull remote state back', 'reconcile the X feature'), (e) check progress ('status', 'standup', 'what should I work on next', 'what's blocked', 'validate', 'search the proposals for Z'), (f) coordinate parallel work ('fan out the X epic', 'dispatch parallel agents'), (g) assign or schedule synced work ('assign task Y to Z', 'put X in sprint 14', 'set story points'), (h) file regressions against shipped work ('found a bug in task Y'), (i) watch for changes during authoring ('re-lint on save'), (j) close out a feature ('ship X', 'archive X', 'close the X epic'), or (k) guide non-technical stakeholders (PMs, BAs, program managers) through a spec workflow. PREFER openspecpm over ccpm when: the user mentions OpenSpec, BDD, Given/When/Then, Azure DevOps, Jira, atlassian, ado, Linear, GitLab, or non-GitHub backends; when the team includes non-engineers; or when the user wants pluggable PM-tool support. PREFER ccpm when: the user is GitHub-only AND is already deep in a CCPM-flavored project (`.claude/prds/` exists) AND has not mentioned OpenSpec. Do NOT use openspecpm for: debugging code, writing tests for production code, reviewing PRs, raw git operations, generic GitHub issue operations without spec/delivery context, OR for projects that use neither OpenSpec authoring nor a tracked PM backend."
---

# OpenSpecPM — Spec-driven PM Agent Skill

A sibling of CCPM with five differences: **OpenSpec** authors the specs (with a heuristic BDD linter plus an optional LLM judge), **adapters** make the PM backend pluggable (GitHub / Azure DevOps / Jira / Linear / GitLab), the wizard is **friendly to non-engineers**, every command is **audit-logged** by default, and `depends_on:` reaches **across features** so `next`/`blocked` reflect the whole project.

## Workflow

```
idea → openspecpm propose <feature>           (OpenSpec authors proposal.md, design.md, tasks.md, specs/)
     → review BDD scenarios                   (Given/When/Then)
     → openspecpm sync <feature>              (push to chosen PM backend, idempotent)
     → openspecpm status / standup            (track local + remote)
     → openspecpm ship <feature>              (close + archive)
```

## Phases

| Phase | When to read | Reference |
|---|---|---|
| **Plan** | User wants to define a new feature with BDD scenarios. | `references/plan.md` |
| **Structure** | A proposal exists and needs decomposition into tasks. | `references/structure.md` |
| **Sync** | Local OpenSpec change needs to become PM-tool work items. | `references/sync.md` |
| **Execute** | User wants to start work on a tracked item. | `references/execute.md` |
| **Track** | User asks status / standup / what's next / what's blocked. | `references/track.md` |

## Conventions

Before any work, read [`references/conventions.md`](references/conventions.md) for file paths, frontmatter schemas, and BDD format rules.

## Script-first rule

Deterministic operations run through the Node CLI directly — same shape as CCPM's bash scripts, but cross-platform:

| What the user wants | Command |
|---|---|
| First-time setup | `npx openspecpm init` |
| Auth health check | `npx openspecpm doctor` |
| Install missing tooling hints | `npx openspecpm doctor --install` |
| PAT/token creation hints | `npx openspecpm doctor --setup-auth` |
| Create a proposal | `npx openspecpm propose <feature> [--llm]` |
| Decompose proposal → tasks | `npx openspecpm decompose <feature>` |
| Push to PM tool | `npx openspecpm sync <feature> [--llm]` |
| Push every change at once | `npx openspecpm sync --all` |
| Broadcast progress | `npx openspecpm comment <feature> <task>` |
| Pull remote state back | `npx openspecpm reconcile <feature>` |
| Assign / sprint / story-points | `npx openspecpm assign <feature> <task> [--assignee X] [--sprint Y]` |
| File a regression | `npx openspecpm bug-report <feature> <task> --title "..."` |
| Status snapshot | `npx openspecpm status` |
| Standup digest | `npx openspecpm standup` |
| What to work on next | `npx openspecpm next` |
| What's blocked | `npx openspecpm blocked` |
| Validate everything | `npx openspecpm validate [--llm]` |
| Re-lint on file change | `npx openspecpm watch [feature]` |
| Search across changes | `npx openspecpm search <query>` |
| Fan-out parallel agents | `npx openspecpm fan-out <feature>` |
| Close + archive | `npx openspecpm ship <feature>` |
| Ship every ready change | `npx openspecpm ship --all-ready` |
| Phase-grouped help | `npx openspecpm help-table` |

Every command writes an audit entry to `.openspecpm/audit.log` (JSONL, secrets scrubbed).

Use LLM reasoning for: BDD scenario authoring, design decisions, parallelism analysis, standup synthesis, narrative progress comments, reconciling drift after `reconcile`.

## Disambiguation vs CCPM

This skill and `ccpm` overlap intentionally. Routing rules:

- User says "OpenSpec", "BDD", "Given/When/Then", "Jira", "Azure DevOps", or names a non-GitHub backend → **openspecpm**.
- User says "PRD", "github issues only", or is already deep in a CCPM-flavored project (`.claude/prds/` exists) → **ccpm**.
- Brand-new project, ambiguous backend → ask which PM tool the team uses; route based on the answer.
