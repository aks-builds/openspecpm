# Track — Status, standup, next, blocked, ship

**When to use this:** The user asks "what's our status", "give me a standup", "what should I work on next", "what's blocked", "ship the X feature", or any other tracking-flavored question.

## Outcome

A concise, current snapshot of work in flight — synthesized from local OpenSpec changes + remote work-item state — presented back to the user.

## Script-first rule

Tracking commands are deterministic. Run the CLI; do not handcraft these answers from memory.

| What the user wants | Command |
|---|---|
| Project status | `openspecpm status` |
| Standup digest | `openspecpm standup` (or `--since 12h` / `--since 2d`) |
| What's ready to start | `openspecpm next` |
| What's blocked | `openspecpm blocked` |
| Close + archive a feature | `openspecpm ship <feature>` |

## How tracking reads state

- **Local source of truth** for proposals, BDD scenarios, task definitions, and progress narrative: `openspec/changes/<feature>/`.
- **Remote source of truth** for status field, assignee, sprint/iteration, and visibility to other stakeholders: the PM tool.
- **Idempotent sync** (per `sync.md`): re-running `sync` reconciles drift. Tracking commands do *not* automatically reconcile — they report local state. If a remote close hasn't been reflected locally, the user sees stale data. Suggest a re-sync if the user reports surprise.

## What each command does

### `status`
Lists every OpenSpec change with a per-change breakdown of task `sync_state` (`pending` / `created` / `failed` / `done`). Fast, local-only, suitable for "what are we working on right now" answers.

### `standup`
Walks `openspec/changes/<feature>/updates/<task>/progress.md` files modified within the window (default 24h) and prints the first ~240 chars of each. Use for daily/weekly written standups.

### `next`
Returns the set of tasks whose `depends_on` are all satisfied (each named dep either done or absent from the tree). Caller picks the priority. Bias toward tasks already flagged `parallel: true` when multiple agents are available.

### `blocked`
Inverse of `next`. Returns tasks that have at least one unmet dep, with the dep name and reason (`dep-open`, `dep-failed`, `not-found`). `not-found` flags a dependency typo or a deleted task — escalate.

### `ship`
Two-step close + archive:

1. Confirm with the user (suppress with `-y`).
2. Iterate every task with `sync_state: created` and call `adapter.closeWorkItem(ref, "Shipped via openspecpm ship <feature>")`.
3. Close the epic via the same call.
4. Shell out to `openspec archive <feature>` so the change moves to `openspec/archive/<date>-<feature>/`. Skippable with `--skip-archive` if you want to keep authoring locally for a follow-up.

If any close fails, ship continues and reports failures inline — re-running ship is safe (closing a closed item is a no-op in every supported backend).

## What to avoid

- Don't paraphrase status from memory — run the CLI, the state changes constantly.
- Don't `ship` mid-flight just because every task happens to be `created`. Ship implies *behavior is verified*; closing the work items is a side-effect.
- Don't mass-close work items by editing tasks.md frontmatter — that desynchronizes local from remote. Use `ship` or `adapter.closeWorkItem` so the broadcast happens.
