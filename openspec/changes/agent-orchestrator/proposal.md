---
name: agent-orchestrator
type: feature
status: draft
schema_version: 1
---

# Feature: agent-orchestrator

## Problem

`openspecpm fan-out` emits ready-to-paste agent prompts and stops. The product's tagline is "for AI agents" but a human still has to copy each prompt into a separate session, wait, and copy progress back. The tool teaches the user to think in parallel tasks, then leaves the parallel dispatch as an exercise. This is the gap between OpenSpecPM as a planner and OpenSpecPM as an actual agent runtime — and it's what most resembles competing tools' selling point.

## Proposed solution

`openspecpm run <feature> [--max-parallel N] [--token-budget T] [--dry-run]` launches Claude Code subagents — one per `parallel: true` task ready to start — tails each agent's stdout into `openspec/changes/<feature>/updates/<task>/progress.md`, calls `notify.js` on completion or failure, and marks the task done on a zero exit. Strict per-task file scoping in the prompt prevents concurrent agents from clobbering each other. `--dry-run` prints the plan without spawning; `--token-budget` enforces a per-task ceiling.

## Success criteria

- N parallel agents launched concurrently, each writing only to its own progress.md
- Exit-0 agent → task marked done, `reconcile` triggered, notify fired
- Non-zero exit → notify fired with stderr tail attached, audit log entry recorded
- `--max-parallel N` and `--token-budget T` caps prevent runaway cost
- `--dry-run` outputs the agent plan (which tasks, which prompts) without spawning anything
- Agents respect file scope declared in the prompt — concurrent runs do not collide

## Out of scope

- Cross-agent merging of file edits — rely on per-task path scoping in prompts
- GUI for orchestrator monitoring — CLI-only first
- Auto-retry of failed agents — explicit human re-trigger required
- Sub-agent model selection — Claude Code chooses; orchestrator only spawns
