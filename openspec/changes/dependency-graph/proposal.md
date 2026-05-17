---
name: dependency-graph
type: feature
status: draft
schema_version: 1
---

# Feature: dependency-graph

## Problem

`next` and `blocked` list tasks as flat bullets. On any project with cross-feature dependencies, neither agents nor humans can see the actual graph — which task blocks the most downstream work, which islands are parallel-safe, where the critical path runs. The information exists in `depends_on:` frontmatter; it's just never visualized.

## Proposed solution

Add a `--graph` flag to `next`, `blocked`, and `validate` that emits a Mermaid `flowchart` block to stdout. Nodes are tasks, edges are `depends_on` relationships, classDef styling distinguishes ready / blocked / parallel-safe / shipped. The critical path (longest dependency chain) is highlighted. A `--max-nodes N` cap truncates large graphs with a one-line summary footer.

## Success criteria

- `openspecpm next --graph` emits a valid Mermaid `flowchart` block parseable by GitHub markdown renderer
- Nodes carry task title + originating feature; styling reflects task state
- Cross-feature edges render correctly (deps that resolve in another change)
- `--max-nodes 30` truncates and prints `(+N tasks omitted)` footer
- Critical path edges use a distinct edge style

## Out of scope

- Rendering Mermaid to PNG (covered by `docs/screenshots/render.ps1` pipeline)
- Interactive / clickable graph UI — terminal-only first
- Sorting or scheduling beyond what `next` already implements
