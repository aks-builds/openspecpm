# Structure — Decomposing a proposal into tasks

**When to use this:** A proposal exists at `openspec/changes/<feature>/proposal.md` and the user wants to break it down into individual work items.

## Outcome

A populated `openspec/changes/<feature>/tasks.md` where the `items:` frontmatter array lists every task with: title, dependency edges, parallelizability, and a `sync_state: pending` marker.

## Flow

1. **Read the proposal and specs.** Open `proposal.md`, `design.md`, and every file in `specs/`. Build a mental model of what behavior must exist for the change to be complete.

2. **Group by stream.** Most features decompose into 2–5 independent streams. Common patterns:
   - **Data:** schema, migrations, persistence layer
   - **Service:** business logic, validation, domain rules
   - **API:** HTTP/RPC/CLI surface
   - **UI:** components, flows, accessibility
   - **Tests:** end-to-end coverage of the new behavior

   Streams that can be worked in parallel get `parallel: true`. Streams that must wait on another stream get `depends_on: ["<earlier-task-title>"]`.

3. **Right-size each task.** A task should be 2–8 hours of focused work for one engineer. If a task is bigger, split. If smaller, merge into the next one (overhead exceeds value).

4. **Write tasks.md.** Use the frontmatter schema from `conventions.md`. Every task gets:
   ```yaml
   - title: "Add user_preferences.theme column"
     sync_state: pending
     depends_on: []
     parallel: true
     effort_hours: 3
   ```

5. **Cross-check against BDD scenarios.** Every scenario in `specs/*.md` should map to at least one task. If a scenario is unimplemented, add a task. If a task isn't traceable to any scenario, ask whether it's actually needed.

## Hierarchy and the target PM tool

The backend's `capabilities().hierarchyDepth` determines how the structure projects into work items:

| Backend | Depth | Mapping |
|---|---|---|
| GitHub | 2 | Epic issue → sub-issues (via `gh-sub-issue`) |
| Linear | 2 | Project → Issues |
| GitLab | 2 | Parent issue → linked child issues (`relates_to` / `blocks`) |
| Jira | 3 | Epic → Story → Sub-task |
| Azure DevOps | 4 | Epic → Feature → User Story → Task |

The sync layer will **collapse levels gracefully** when authoring depth exceeds backend depth — e.g. on GitHub, "Feature" and "Story" levels are flattened into siblings of the Epic with a label tag, and a warning is printed. You do not need to author differently for each backend; author the deepest sensible structure and let the adapter compress.

## After this phase

- Route to `references/sync.md` to push tasks to the PM tool.
- If decomposition surfaced unknowns, route back to `references/plan.md` to refine the proposal.
