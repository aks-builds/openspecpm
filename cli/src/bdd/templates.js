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

export const CHANGE_TYPES = ['feature', 'bug', 'refactor', 'incident'];

const PROPOSAL_TEMPLATES = {
  feature: (name) => `---
name: ${name}
type: feature
status: draft
schema_version: 1
---

# Feature: ${name}

## Problem
What can't users do today? Who feels it?

## Proposed solution
One paragraph describing the user-visible behavior.

## Success criteria
- Observable outcome 1
- Observable outcome 2

## Out of scope
- Things we are deliberately not doing in this change
`,

  bug: (name) => `---
name: ${name}
type: bug
status: draft
schema_version: 1
severity: low | medium | high | critical
---

# Bug: ${name}

## Symptom
What does the user see?

## Reproduce
1. Step
2. Step

## Root cause (after investigation)
Fill in once known.

## Fix approach
One paragraph.

## Regression test
Which scenarios in specs/ exercise this path?
`,

  refactor: (name) => `---
name: ${name}
type: refactor
status: draft
schema_version: 1
behavior_change: none
---

# Refactor: ${name}

## What's being changed
Files / modules / patterns affected.

## Why now
The motivating constraint or smell.

## Behavior contract
This refactor MUST NOT change observable behavior. List the BDD scenarios
in specs/ that must continue to pass unchanged.

## Risk + rollback
What's the blast radius if this goes wrong? How do we revert?
`,

  incident: (name) => `---
name: ${name}
type: incident
status: draft
schema_version: 1
severity: sev1 | sev2 | sev3
detected_at: <ISO-8601>
mitigated_at: <ISO-8601>
---

# Incident: ${name}

## Impact
Who was affected, for how long, in what way.

## Timeline
| Time | Event |
|------|-------|
| ... | ... |

## Root cause
One paragraph.

## Mitigation
What stopped the bleeding.

## Action items
- [ ] Owner: short description
`,
};

const SPECS_TEMPLATES = {
  feature: STARTER_SPEC,
  bug: `# Regression scenarios

Each scenario MUST fail without the fix and pass with it.

Scenario: <symptom title>
  Given <state at time of bug>
  When  <action that triggered it>
  Then  <observable correct behavior, not the buggy one>
`,
  refactor: STARTER_SPEC,
  incident: `# Post-incident verification

Scenario: <action that triggered the incident> no longer breaks
  Given <conditions at incident time, reproduced>
  When  <triggering action>
  Then  <safe behavior occurs>
  And   <no alert fires>
`,
};

export function proposalTemplate(type, name) {
  const t = PROPOSAL_TEMPLATES[type] ?? PROPOSAL_TEMPLATES.feature;
  return t(name);
}

export function specsTemplate(type) {
  return SPECS_TEMPLATES[type] ?? STARTER_SPEC;
}
