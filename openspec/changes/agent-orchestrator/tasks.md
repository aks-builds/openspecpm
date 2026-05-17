---
schema_version: 1
items:
  - title: "Refactor fan-out.js to extract prompt-build helper"
    sync_state: pending
    depends_on: []
    parallel: false
    effort_hours: 4
  - title: "Implement cli/src/orchestrator.js process supervisor"
    sync_state: pending
    depends_on: ["Refactor fan-out.js to extract prompt-build helper"]
    parallel: false
    effort_hours: 16
  - title: "Wire cli/src/commands/run.js"
    sync_state: pending
    depends_on: ["Implement cli/src/orchestrator.js process supervisor"]
    parallel: false
    effort_hours: 3
  - title: "--max-parallel N enforcement (concurrency limit)"
    sync_state: pending
    depends_on: ["Implement cli/src/orchestrator.js process supervisor"]
    parallel: true
    effort_hours: 2
  - title: "--token-budget T enforcement (kill agent on overrun)"
    sync_state: pending
    depends_on: ["Implement cli/src/orchestrator.js process supervisor"]
    parallel: true
    effort_hours: 6
  - title: "--dry-run mode prints plan without spawning"
    sync_state: pending
    depends_on: ["Wire cli/src/commands/run.js"]
    parallel: true
    effort_hours: 2
  - title: "Progress tail into updates/<task>/progress.md"
    sync_state: pending
    depends_on: ["Implement cli/src/orchestrator.js process supervisor"]
    parallel: false
    effort_hours: 4
  - title: "notify.js failure routing extension (stderr tail attachment)"
    sync_state: pending
    depends_on: ["Implement cli/src/orchestrator.js process supervisor"]
    parallel: true
    effort_hours: 3
  - title: "Audit log spawn / exit / kill entries"
    sync_state: pending
    depends_on: ["Implement cli/src/orchestrator.js process supervisor"]
    parallel: true
    effort_hours: 2
  - title: "Auto-trigger reconcile after each successful task"
    sync_state: pending
    depends_on: ["Wire cli/src/commands/run.js"]
    parallel: false
    effort_hours: 2
  - title: "Update skill/openspecpm/SKILL.md with sub-agent file-scoping rules"
    sync_state: pending
    depends_on: ["Wire cli/src/commands/run.js"]
    parallel: true
    effort_hours: 2
  - title: "Integration test with mock claude CLI"
    sync_state: pending
    depends_on: ["Wire cli/src/commands/run.js"]
    parallel: true
    effort_hours: 8
---

# Tasks
