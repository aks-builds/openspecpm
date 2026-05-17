---
name: additional-adapters
type: feature
status: draft
schema_version: 1
---

# Feature: additional-adapters

## Problem

OpenSpecPM ships with five adapters: GitHub, Azure DevOps, Jira, Linear, GitLab. Three large PM markets are missing — Notion (popular with PM/BA teams who don't live in an engineering tracker), ClickUp (operations-heavy orgs), Asana (cross-functional teams). Customers running on those tools must either drop OpenSpecPM or maintain a parallel tracker. The 9-method adapter contract makes adding new backends a contained piece of work; not having these three is leaving market on the table.

## Proposed solution

Implement Notion, ClickUp, and Asana adapters against the existing 9-method contract (`createEpic`, `createTask`, `linkChildToParent`, `getItem`, `closeItem`, `addComment`, `assignItem`, `searchItems`, `capabilities`). Each plugs into the adapter registry, `init` wizard, and `doctor` health checks. Hierarchy depth differs per backend — Notion depth 3, ClickUp depth 4, Asana depth 3 — handled by existing `capabilities()` reporting and the sync layer's depth-collapse logic.

## Success criteria

- Each of the three adapters passes the adapter contract test suite
- `openspecpm init` wizard lists Notion, ClickUp, Asana as backend choices
- `openspecpm doctor notion` (and clickup / asana) checks the relevant env var with an English remediation hint for missing or invalid auth
- Capability map: Notion `{ depth: 3, supportsAssign: true }`, ClickUp `{ depth: 4 }`, Asana `{ depth: 3 }`
- README backend matrix updated to list all eight adapters

## Out of scope

- Bidirectional comment sync (existing limitation across all adapters)
- Real-time webhook ingestion from any backend
- Custom-field mapping beyond what the 9-method contract already exposes
