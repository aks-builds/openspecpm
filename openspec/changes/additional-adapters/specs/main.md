# Scenarios

Scenario: Notion adapter creates a parent epic and child tasks under it
  Given the user has NOTION_TOKEN set with write access to a target database
  And   a change "dark-mode" has three tasks with no remote items yet
  When  the user runs `openspecpm sync dark-mode` with adapter=notion
  Then  one Notion page is created as the epic
  And   three child pages are created and linked under the epic via the parent relation
  And   each task's frontmatter is updated with its external_id

Scenario: ClickUp depth-4 hierarchy collapses cleanly to depth-2 specs
  Given the user has CLICKUP_PAT set
  And   the user has selected a ClickUp list as the sync target
  When  the user runs `openspecpm sync dark-mode` with adapter=clickup
  Then  the proposal becomes a parent task in the list
  And   spec-level groupings are flattened into subtasks
  And   no work items spill outside the selected list

Scenario: doctor diagnoses a missing ASANA_PAT with a copyable command
  Given ASANA_PAT is not set in the environment
  When  the user runs `openspecpm doctor asana`
  Then  the output marks asana auth as failing with a ✖
  And   the remediation hint names the exact env var to set
  And   the hint includes the asana.com URL where the user creates a PAT
