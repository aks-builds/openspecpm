# Changelog

All notable changes to OpenSpecPM are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Sprint 2

- Azure DevOps Boards adapter (REST + PAT auth). All 9 adapter methods implemented: WIQL list, JSON-Patch create/update, Parent/Child hierarchy links, state-based close, comments.
- Jira adapter (REST v3 + email/API-token auth). All 9 methods implemented: JQL list, ADF descriptions, issue links, transition-based close, comments.
- Shared HTTP helper (`cli/src/http.js`) with Basic-auth injection, JSON parsing, status-code-aware remediation hints.
- Contract tests for both REST adapters against mocked `fetch` (21 new tests, 37 total).
- Skill references: `structure.md`, `sync.md`, `execute.md` (covering capabilities-driven hierarchy collapse, idempotency contract, field-mapping table per backend, hidden-by-default worktrees).
- `doctor ado` and `doctor jira` validate auth + reach the backend's identity endpoint.

### Sprint 1

- Repo scaffold: Node CLI with Commander, OpenSpec bridge with version-probe anti-corruption layer.
- Adapter base class + `capabilities()` contract.
- GitHub adapter (uses `gh` CLI).
- `openspecpm init` interactive wizard (`@clack/prompts`).
- `openspecpm doctor github` with English remediation hints.
- `openspecpm propose` (wraps OpenSpec) and `openspecpm sync` (idempotent, frontmatter-tracked).
- Agent Skill scaffold under `skill/openspecpm/` with conventions + plan references.
- 16 unit + contract tests; GitHub Actions CI on Node 20.
