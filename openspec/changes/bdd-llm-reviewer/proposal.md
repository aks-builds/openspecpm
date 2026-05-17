---
name: bdd-llm-reviewer
type: feature
status: draft
schema_version: 1
---

# Feature: bdd-llm-reviewer

## Problem

The heuristic linter in `cli/src/bdd/linter.js` catches surface mistakes (deny-list phrases, missing observable verbs) but misses semantic gaps: scenarios that contradict each other across spec files, missing coverage of declared success criteria, observable outcomes that pass the regex but fail human review ("returns successfully" technically has a verb but means nothing). Customers shipping to regulated industries cannot trust BDD as acceptance criteria when reviewers must still read every scenario by hand.

## Proposed solution

Add an LLM-backed judge (`cli/src/bdd/judge.js`) that augments the heuristic linter. Uses `@anthropic-ai/sdk` with Claude Haiku for cost/latency, prompt-caches the proposal context so re-runs are cheap. The judge scores each scenario for observable-outcome clarity, surfaces cross-spec contradictions, and flags missing-coverage gaps against `success_criteria`. Behind a `--llm` flag (opt-in) or `judge.enabled` config; soft mode on `propose`, hard gate on `sync` (paired with `--force`).

## Success criteria

- `openspecpm propose --llm <feature>` runs heuristic + LLM lint and merges findings
- Judge surfaces at least cross-spec contradictions and missing-coverage gaps as distinct rule ids (`bdd/contradiction`, `bdd/missing-coverage`)
- Prompt cache hit on `proposal.md` content keeps re-runs under 2s
- `doctor` reports presence/absence of `ANTHROPIC_API_KEY` with an English remediation hint
- Judge findings carry severity (`warn` / `error`) and file:line location

## Out of scope

- Fine-tuning a custom model — Haiku off-the-shelf only
- Embedding-based semantic search across the project (separate feature)
- Auto-rewriting bad scenarios — judge reports only, humans edit
