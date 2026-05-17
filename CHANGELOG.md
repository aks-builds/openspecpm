# Changelog

All notable changes to OpenSpecPM are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Sprint 1 scaffold: repo skeleton, Node CLI with Commander, OpenSpec bridge with version-probe anti-corruption layer.
- Adapter base class + capabilities contract.
- GitHub adapter (uses `gh` CLI).
- `openspecpm init` interactive wizard (`@clack/prompts`).
- `openspecpm doctor github` with English remediation hints.
- `openspecpm propose` (wraps OpenSpec) and `openspecpm sync` (idempotent, GitHub-only in Sprint 1).
- Agent Skill scaffold under `skill/openspecpm/` with conventions + plan references.
