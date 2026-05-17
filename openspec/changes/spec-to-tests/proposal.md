---
name: spec-to-tests
type: feature
status: draft
schema_version: 1
---

# Feature: spec-to-tests

## Problem

BDD scenarios in `openspec/changes/<f>/specs/*.md` describe acceptance criteria but stay in markdown. Engineers re-type the same Given/When/Then by hand into Cucumber `.feature` files, Playwright `test.describe` blocks, or Jest `describe`/`it` skeletons. The translation is mechanical, lossy, and the test files drift away from the spec as either side evolves. Tests stop being a faithful reflection of intended behavior — the exact rot that BDD was supposed to prevent.

## Proposed solution

`openspecpm scaffold-tests <feature> --target playwright|cucumber|jest` parses each spec file's Scenario blocks and emits test stubs under `tests/<feature>/`. Each scenario becomes one test case with TODO bodies and a traceability comment (`// from openspec/changes/<f>/specs/<file>.md:<line>`) so the test always names its source. Per-target scaffolders live in `cli/src/scaffolders/`; the output directory is configurable via `.openspecpm/config.json`.

## Success criteria

- Each Scenario block becomes one test case (Cucumber `Scenario:`, Playwright `test()`, Jest `it()`)
- Generated files parse / compile cleanly in the target framework on a fresh project
- Every test case carries a traceability comment naming source file + line
- Configurable output path via `.openspecpm/config.json` under `scaffold.outputDir`
- Re-running scaffold leaves customized test bodies untouched (idempotent — only adds new stubs)

## Out of scope

- Filling in actual test bodies (LLM-driven body generation is a future spike)
- Reverse direction (tests → BDD)
- Test framework auto-detection — caller specifies via `--target`
