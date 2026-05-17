# Execute — Starting work on a tracked item

**When to use this:** The user says "let's work on X", "start issue 42", "begin Task PROJ-7", or names a synced work item they want to make progress on.

## Outcome

A work item moved to `in_progress` in the PM tool, a local progress directory created, and the agent is ready to write code / docs / configuration that implements the work item.

## Flow

1. **Resolve the work item.** Match the user's reference (issue number, Jira key, ADO ID, or natural-language feature name) against the local tasks tree:
   - Read `openspec/changes/*/tasks.md` and find the item whose `external_id` matches, or whose `title` is the closest match.
   - If ambiguous, ask the user to disambiguate by listing the 2–3 candidates.

2. **Move the item to in-progress in the PM tool.** Via the adapter:
   - GitHub: `updateWorkItem({ addLabels: ['in-progress'] })`
   - Azure DevOps: `updateWorkItem({ state: 'Active' })`
   - Jira: `updateWorkItem({ transition: <to-In-Progress> })`

3. **Create the local progress directory.**
   - Path: `openspec/changes/<feature>/updates/<task>/`
   - Drop a stub `progress.md` with frontmatter `{started: <ISO-8601>, owner: <user>, work_item: <external_id>}`.

4. **Announce the start.** Add a comment to the work item via `addProgressComment`:
   ```
   <!-- SYNCED: 2026-05-17T14:30:00Z -->
   Started work on this item.
   ```

5. **Now do the work.** Use the spec scenarios in `openspec/changes/<feature>/specs/` as the acceptance criteria. Implement code, write tests, refactor — whatever the task requires. Use the BDD scenarios as the test plan, not just the spec.

6. **Periodically broadcast progress.** Append to local `progress.md`, then sync to the PM tool with `openspecpm comment <task>` (Sprint 3). Don't post per-keystroke — once per meaningful checkpoint.

7. **When done.** Run `openspecpm ship <feature>` (Sprint 3) to close the work item with a final comment and archive the OpenSpec change.

## Worktrees: hidden by default

Engineers may want a `git worktree` per feature so concurrent work doesn't collide. To opt in:

```
openspecpm start <feature> --dev
```

This creates `../openspec-<feature>/` on branch `openspec/<feature>`. **For non-technical users, do not surface this.** They will be confused by ghost folders. The default `start` command (Sprint 3+) skips the worktree and works in the current checkout.

## Parallel agents

If `tasks.md` flags items with `parallel: true` and they have no `depends_on` overlap, multiple agents can take them concurrently — this is CCPM's killer feature and OpenSpecPM inherits it.

For each parallel task:
1. Mark each as in-progress via the adapter.
2. Launch a sub-agent with a focused prompt: "Implement task T from the X feature. The BDD scenarios are at specs/Y.md. Use only files under <stream-scope>."
3. Wait for completion, then merge.

In Sprint 3, `openspecpm fan-out <feature>` automates the launch.

## What to avoid

- Don't start work on a task that hasn't been synced — the PM tool won't track it and you'll lose traceability.
- Don't bypass BDD scenarios. They're the contract the proposal was approved on.
- Don't move multiple items to in-progress simultaneously unless they're flagged `parallel: true` — that hides bottlenecks.
- Don't write progress comments containing secrets, credentials, or anything you wouldn't want visible to everyone with read access to the PM tool.
