---
schema_version: 1
items:
  - title: "Notion adapter: implement 9-method contract"
    sync_state: pending
    depends_on: []
    parallel: true
    effort_hours: 16
  - title: "ClickUp adapter: implement 9-method contract"
    sync_state: pending
    depends_on: []
    parallel: true
    effort_hours: 12
  - title: "Asana adapter: implement 9-method contract"
    sync_state: pending
    depends_on: []
    parallel: true
    effort_hours: 12
  - title: "Extend adapter contract test suite to cover new adapters"
    sync_state: pending
    depends_on:
      - "Notion adapter: implement 9-method contract"
      - "ClickUp adapter: implement 9-method contract"
      - "Asana adapter: implement 9-method contract"
    parallel: false
    effort_hours: 4
  - title: "Register all three in cli/src/adapters/index.js"
    sync_state: pending
    depends_on:
      - "Notion adapter: implement 9-method contract"
      - "ClickUp adapter: implement 9-method contract"
      - "Asana adapter: implement 9-method contract"
    parallel: false
    effort_hours: 1
  - title: "init.js wizard options for new adapters"
    sync_state: pending
    depends_on: ["Register all three in cli/src/adapters/index.js"]
    parallel: false
    effort_hours: 2
  - title: "doctor.js env-var checks (NOTION_TOKEN, CLICKUP_PAT, ASANA_PAT)"
    sync_state: pending
    depends_on: ["Register all three in cli/src/adapters/index.js"]
    parallel: true
    effort_hours: 2
  - title: "Update README backend matrix + architecture diagram"
    sync_state: pending
    depends_on: ["init.js wizard options for new adapters"]
    parallel: true
    effort_hours: 2
  - title: "Skill references update: structure.md depth-collapse examples"
    sync_state: pending
    depends_on: ["Update README backend matrix + architecture diagram"]
    parallel: true
    effort_hours: 1
---

# Tasks
