export const STARTER_SPEC = `# Scenarios

Document each user-visible behavior as a Scenario with Given/When/Then.
Aim for one Given, one When, one Then per scenario, with optional And/But chains.

Scenario: Replace this title with a one-sentence behavior
  Given <pre-condition>
  And   <another pre-condition (optional)>
  When  <the user or system performs an action>
  Then  <an observable outcome>
  And   <another observable outcome (optional)>
`;

export const STARTER_TASKS = `---
schema_version: 1
items: []
---

# Tasks

Add one entry per work item to the \`items:\` frontmatter list. The frontmatter
is authoritative; this body is informational only.

Schema (per item):

\`\`\`yaml
- title: "Implement X"
  sync_state: pending
  depends_on: []
  parallel: true
  effort_hours: 3
\`\`\`
`;
