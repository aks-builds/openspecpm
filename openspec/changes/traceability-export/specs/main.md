# Scenarios

Scenario: full chain renders for a shipped feature
  Given a change "dark-mode" has been proposed, synced, shipped
  And   each task has an external_id and a merged PR recorded in audit.log
  When  the user runs `openspecpm trace --feature dark-mode --export json`
  Then  the output contains one row per task
  And   each row carries proposal ref, spec ref, task title, external_id, PR SHA, deploy marker

Scenario: incomplete chain surfaces (incomplete) markers
  Given a task whose external_id was created before audit.log captured PR refs
  When  the user runs `openspecpm trace --export csv`
  Then  the PR column for that row reads `(incomplete: pr-ref-missing)`
  And   the rest of the row is populated normally

Scenario: CSV survives Excel reimport without escape corruption
  Given a task title contains a comma and a double-quote: `Add "x, y" validator`
  When  the user runs `openspecpm trace --export csv` and opens the file in Excel
  Then  the title cell reads `Add "x, y" validator` exactly
  And   no row is split across multiple Excel rows
