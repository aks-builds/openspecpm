---
schema_version: 1
items:
  - title: "Add @anthropic-ai/sdk dependency"
    sync_state: pending
    depends_on: []
    parallel: true
    effort_hours: 1
  - title: "Implement cli/src/bdd/judge.js with Haiku + prompt cache"
    sync_state: pending
    depends_on: ["Add @anthropic-ai/sdk dependency"]
    parallel: false
    effort_hours: 8
  - title: "Define rule ids (bdd/contradiction, bdd/missing-coverage, bdd/vague-then)"
    sync_state: pending
    depends_on: ["Implement cli/src/bdd/judge.js with Haiku + prompt cache"]
    parallel: true
    effort_hours: 2
  - title: "Merge judge results into linter.js output"
    sync_state: pending
    depends_on: ["Implement cli/src/bdd/judge.js with Haiku + prompt cache"]
    parallel: false
    effort_hours: 3
  - title: "Wire --llm flag into propose, sync, validate"
    sync_state: pending
    depends_on: ["Merge judge results into linter.js output"]
    parallel: false
    effort_hours: 2
  - title: "Parallel-judge multiple specs in one call (Promise.all bounded)"
    sync_state: pending
    depends_on: ["Implement cli/src/bdd/judge.js with Haiku + prompt cache"]
    parallel: true
    effort_hours: 3
  - title: "Add ANTHROPIC_API_KEY probe to doctor.js with remediation hint"
    sync_state: pending
    depends_on: ["Add @anthropic-ai/sdk dependency"]
    parallel: true
    effort_hours: 1
  - title: "Tests with mocked SDK + recorded fixtures"
    sync_state: pending
    depends_on: ["Implement cli/src/bdd/judge.js with Haiku + prompt cache"]
    parallel: true
    effort_hours: 4
  - title: "judge.enabled config schema + default off"
    sync_state: pending
    depends_on: ["Wire --llm flag into propose, sync, validate"]
    parallel: true
    effort_hours: 1
---

# Tasks
