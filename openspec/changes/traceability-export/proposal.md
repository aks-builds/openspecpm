---
name: traceability-export
type: feature
status: draft
schema_version: 1
---

# Feature: traceability-export

## Problem

Regulated industries (insurance, financial services, healthcare) must prove that every shipped change traces back to a documented requirement: proposal → BDD spec → task → external work item → PR / commit → deployment marker. Today that data exists across `.openspecpm/audit.log`, the git log, and adapter state — but nobody can produce a single matrix on demand during an audit. Compliance teams build it manually, which is slow, error-prone, and breaks the moment anything moves.

## Proposed solution

`openspecpm trace [--export pdf|csv|json] [--feature <name>]` walks `audit.log` (JSONL), joins git log by `external_id` and PR refs, and produces the full traceability matrix per change. PDF format is print-ready with a per-feature table of contents for compliance review; CSV imports cleanly into Excel; JSON feeds downstream tooling. Audit-log gaps surface as explicit `(incomplete)` markers — never silent failures.

## Success criteria

- `openspecpm trace --export json` emits a matrix with rows: feature → spec ref → task → external_id → PR/commit SHA → deploy marker
- Missing fields render as `(incomplete: <reason>)` so reviewers see exactly where coverage is thin
- PDF output is print-ready, with a table of contents and one section per feature
- CSV survives a round-trip through Excel without quote-escaping corruption
- `--feature <name>` scopes the export to a single change
- Audit log entries written by every existing command carry enough metadata for the join (backfill helper handles older entries)

## Out of scope

- Live deploy-event ingestion — assumes an out-of-band deploy marker in audit.log
- Real-time updating dashboard (a future feature)
- Bidirectional sync of changes back into the audit log
