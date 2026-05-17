# Sync — Pushing an OpenSpec change to the PM tool

**When to use this:** The user has a proposal + tasks ready and wants them tracked in GitHub Issues / Azure DevOps Boards / Jira / Linear / GitLab Issues.

## Outcome

For the chosen adapter, the epic and every task are created as work items, linked into a hierarchy where the backend supports it, and recorded back into local frontmatter (`external:` on `proposal.md`, `external_id` + `external_url` on each task in `tasks.md`).

## The CLI does the work

```
openspecpm sync <feature>             # create + update
openspecpm sync <feature> --dry-run   # print the call plan, no remote writes
```

Do not script `gh issue create` or hand-craft REST calls in agent reasoning — let the adapter handle vocabulary differences across backends.

## Idempotency contract

Sync is safe to re-run. The rules:

1. **Epic:** if `proposal.md` frontmatter already carries `external.<adapter>` with an `id`, the existing epic is reused. No duplicate epics are ever created.
2. **Tasks:** each task carries `sync_state: pending | created | failed`. `sync` skips `created` items and retries `failed` ones.
3. **Comments:** progress comments stamped `<!-- SYNCED: <iso-timestamp> -->` are append-only. Re-running sync after a comment was posted does not repost.

This means: if the network fails halfway through a 30-task sync, fix the cause, re-run, and only the un-created items get created.

## Capabilities and hierarchy collapse

Each adapter reports `capabilities()`. The sync layer reads `hierarchyDepth`:

- **GitHub (depth 2):** Epic issue + flat task sub-issues. If the task tree authored depth >2, intermediate levels are flattened into siblings tagged `openspec:<feature>` and a one-line warning is printed.
- **Linear (depth 2):** Project as epic, issues as tasks under the project. `parent` relation when supported by the workspace.
- **GitLab (depth 2):** Parent issue + child issues linked via `relates_to` / `blocks`. Milestone serves as the epic container if `--milestone` is supplied.
- **Jira (depth 3):** Epic → Story → optional Sub-task. Stories without sub-tasks just sit under the Epic via `Relates` link.
- **Azure DevOps (depth 4):** Epic → Feature → User Story → Task with `System.LinkTypes.Hierarchy-Reverse` Parent links.

## Field mapping per adapter

| OpenSpec field | GitHub | Azure DevOps | Jira | Linear | GitLab |
|---|---|---|---|---|---|
| `task.title` | Issue title | `System.Title` | `summary` | `title` | `title` |
| `task.body` | Issue body (markdown) | `System.Description` (HTML) | `description` (ADF) | `description` (markdown) | `description` (markdown) |
| `feature.name` (tag) | label `openspec:<name>` | tag `openspec:<name>` | label `openspec-<name>` | label `openspec:<name>` | label `openspec:<name>` |
| `task.depends_on` | task-list reference in body | `System.LinkTypes.Dependency` link | `Blocks` issue link | issue relation `blocks` | issue link `blocks` |
| `task.iteration` | (ignored, depth=2) | `System.IterationPath` | sprint custom field | `cycleId` | `milestone` |
| `task.assignee` | `--add-assignee` | `System.AssignedTo` | `assignee.accountId` | `assigneeId` | `assignee_ids` |
| `task.effort_hours` | (ignored) | `Microsoft.VSTS.Scheduling.Effort` | story-points custom field | `estimate` | `weight` |

The CLI handles the translation. Author tasks in the OpenSpec/CCPM dialect described in `conventions.md`.

## After sync

- Each item is now visible in the PM tool. The user can route stakeholders to those URLs for sign-off.
- Progress narrative still lives locally in `openspec/changes/<feature>/updates/<task>/progress.md`. Use `openspecpm comment <task>` (Sprint 3) to broadcast a new update to the PM tool.
- Route to `references/execute.md` when the user is ready to start building.
