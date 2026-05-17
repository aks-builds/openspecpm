---
schema_version: 1
items:
  - title: "Implement cli/src/graph.js builder (buildMermaid)"
    sync_state: pending
    depends_on: []
    parallel: true
    effort_hours: 6
  - title: "Add --graph flag to next.js"
    sync_state: pending
    depends_on: ["Implement cli/src/graph.js builder (buildMermaid)"]
    parallel: true
    effort_hours: 1
  - title: "Add --graph flag to blocked.js"
    sync_state: pending
    depends_on: ["Implement cli/src/graph.js builder (buildMermaid)"]
    parallel: true
    effort_hours: 1
  - title: "Add --graph flag to validate.js"
    sync_state: pending
    depends_on: ["Implement cli/src/graph.js builder (buildMermaid)"]
    parallel: true
    effort_hours: 1
  - title: "Implement --max-nodes truncation + summary footer"
    sync_state: pending
    depends_on: ["Implement cli/src/graph.js builder (buildMermaid)"]
    parallel: false
    effort_hours: 2
  - title: "Highlight critical-path edges with distinct style"
    sync_state: pending
    depends_on: ["Implement cli/src/graph.js builder (buildMermaid)"]
    parallel: true
    effort_hours: 3
  - title: "Unit tests for graph builder (single + cross-feature + cyclic guards)"
    sync_state: pending
    depends_on: ["Implement cli/src/graph.js builder (buildMermaid)"]
    parallel: true
    effort_hours: 3
  - title: "Update README + help-table.js entries for --graph"
    sync_state: pending
    depends_on:
      - "Add --graph flag to next.js"
      - "Add --graph flag to blocked.js"
      - "Add --graph flag to validate.js"
    parallel: false
    effort_hours: 1
---

# Tasks
