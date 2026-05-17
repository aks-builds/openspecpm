---
schema_version: 1
items:
  - title: "Audit.js: add backfill helper for missing fields on older entries"
    sync_state: pending
    depends_on: []
    parallel: true
    effort_hours: 3
  - title: "Implement cli/src/commands/trace.js matrix builder"
    sync_state: pending
    depends_on: ["Audit.js: add backfill helper for missing fields on older entries"]
    parallel: false
    effort_hours: 6
  - title: "JSON exporter (cli/src/exporters/json.js)"
    sync_state: pending
    depends_on: ["Implement cli/src/commands/trace.js matrix builder"]
    parallel: true
    effort_hours: 1
  - title: "CSV exporter (cli/src/exporters/csv.js) with Excel-safe quoting"
    sync_state: pending
    depends_on: ["Implement cli/src/commands/trace.js matrix builder"]
    parallel: true
    effort_hours: 3
  - title: "PDF exporter (cli/src/exporters/pdf.js) using pdfkit"
    sync_state: pending
    depends_on: ["Implement cli/src/commands/trace.js matrix builder"]
    parallel: true
    effort_hours: 8
  - title: "--feature <name> scoping flag"
    sync_state: pending
    depends_on: ["Implement cli/src/commands/trace.js matrix builder"]
    parallel: true
    effort_hours: 1
  - title: "Render (incomplete: <reason>) markers for missing fields"
    sync_state: pending
    depends_on: ["Implement cli/src/commands/trace.js matrix builder"]
    parallel: false
    effort_hours: 2
  - title: "Tests with sample audit logs covering complete + incomplete chains"
    sync_state: pending
    depends_on: ["Implement cli/src/commands/trace.js matrix builder"]
    parallel: true
    effort_hours: 4
  - title: "Ensure every existing command writes external_id + PR ref to audit"
    sync_state: pending
    depends_on: ["Audit.js: add backfill helper for missing fields on older entries"]
    parallel: true
    effort_hours: 3
---

# Tasks
