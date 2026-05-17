---
schema_version: 1
items:
  - title: "Extract BDD scenario parser from linter.js into shared module"
    sync_state: pending
    depends_on: []
    parallel: false
    effort_hours: 3
  - title: "Implement Playwright scaffolder (cli/src/scaffolders/playwright.js)"
    sync_state: pending
    depends_on: ["Extract BDD scenario parser from linter.js into shared module"]
    parallel: true
    effort_hours: 4
  - title: "Implement Cucumber scaffolder (cli/src/scaffolders/cucumber.js)"
    sync_state: pending
    depends_on: ["Extract BDD scenario parser from linter.js into shared module"]
    parallel: true
    effort_hours: 3
  - title: "Implement Jest scaffolder (cli/src/scaffolders/jest.js)"
    sync_state: pending
    depends_on: ["Extract BDD scenario parser from linter.js into shared module"]
    parallel: true
    effort_hours: 3
  - title: "Wire scaffold-tests command in bin/openspecpm.js"
    sync_state: pending
    depends_on:
      - "Implement Playwright scaffolder (cli/src/scaffolders/playwright.js)"
      - "Implement Cucumber scaffolder (cli/src/scaffolders/cucumber.js)"
      - "Implement Jest scaffolder (cli/src/scaffolders/jest.js)"
    parallel: false
    effort_hours: 2
  - title: "Add traceability comment helper (source path + line)"
    sync_state: pending
    depends_on: ["Extract BDD scenario parser from linter.js into shared module"]
    parallel: true
    effort_hours: 1
  - title: "Idempotency: skip stubs whose test name already exists"
    sync_state: pending
    depends_on: ["Wire scaffold-tests command in bin/openspecpm.js"]
    parallel: false
    effort_hours: 3
  - title: "Config schema: scaffold.outputDir + scaffold.defaultTarget"
    sync_state: pending
    depends_on: ["Wire scaffold-tests command in bin/openspecpm.js"]
    parallel: true
    effort_hours: 1
  - title: "Smoke test in tests/ creates real files and re-runs cleanly"
    sync_state: pending
    depends_on: ["Idempotency: skip stubs whose test name already exists"]
    parallel: true
    effort_hours: 3
---

# Tasks
