# Scenarios

Scenario: spawn N parallel agents for N parallel-safe tasks
  Given a feature has four tasks ready to start, all flagged parallel: true
  And   the user invokes `openspecpm run <feature> --max-parallel 4`
  When  the orchestrator dispatches
  Then  exactly four Claude Code subagents are spawned concurrently
  And   each agent writes only to its own updates/<task>/progress.md
  And   the audit log records a `spawn` entry per task with the task title and pid

Scenario: token-budget cap interrupts a runaway agent
  Given the user runs `openspecpm run <feature> --token-budget 50000`
  And   one agent's cumulative usage crosses 50000 tokens before completing
  When  the orchestrator's budget check fires
  Then  that agent is killed with a recorded `budget-exceeded` reason
  And   notify.js fires with the agent's stderr tail and the token count
  And   the task remains in its prior sync_state (not marked done)

Scenario: dry-run prints the plan without spawning
  Given the user runs `openspecpm run <feature> --dry-run`
  When  the orchestrator builds the plan
  Then  stdout lists each task that would be dispatched with its built prompt
  And   no child process is spawned
  And   no progress.md is written

Scenario: failed agent surfaces stderr tail in notify
  Given an agent exits non-zero after partial work
  When  the orchestrator processes the exit
  Then  the task's frontmatter sync_state is unchanged
  And   notify.js fires with the last 40 lines of stderr attached
  And   audit log records an `exit` entry with code, signal, and stderr_tail
