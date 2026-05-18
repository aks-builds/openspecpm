# Conventions

These rules apply to every phase of OpenSpecPM. Read this before touching files.

## Paths

| Artifact | Path |
|---|---|
| Project config | `.openspecpm/config.json` (chosen adapter, repo/org/project identifiers) |
| Project state | `.openspecpm/state.json` (not committed; idempotency hints) |
| OpenSpec changes | `openspec/changes/<feature>/` (owned by OpenSpec) |
| Proposal | `openspec/changes/<feature>/proposal.md` |
| Design | `openspec/changes/<feature>/design.md` |
| Tasks | `openspec/changes/<feature>/tasks.md` |
| BDD specs | `openspec/changes/<feature>/specs/*.md` |
| Progress (local) | `openspec/changes/<feature>/updates/<task-id>/progress.md` |
| Archive | `openspec/archive/<YYYY-MM-DD>-<feature>/` (owned by OpenSpec) |

The OpenSpec layout is authoritative — do not invent a parallel `.claude/...` tree. We sit *above* OpenSpec, not beside it.

## Secrets

Never write tokens to `.openspecpm/config.json`. Use environment variables:

- GitHub: `gh auth login` handles the token; no env var needed.
- Azure DevOps: `AZURE_DEVOPS_EXT_PAT` (Work Items: Read/Write).
- Jira: `JIRA_EMAIL` + `JIRA_API_TOKEN`.
- Linear: `LINEAR_API_KEY`.
- GitLab: `GITLAB_TOKEN` (`api` scope).
- LLM BDD judge (optional, opt-in via `--llm` or `judge.enabled` config): `ANTHROPIC_API_KEY`.

## Frontmatter schemas

All artifacts use YAML frontmatter. Required fields:

### proposal.md

```yaml
---
name: <feature-slug>
status: draft | in_review | approved | shipped
created: <ISO-8601 timestamp>
schema_version: 1
external:                          # filled by `openspecpm sync`
  github:
    adapter: github
    id: "42"
    url: https://github.com/.../issues/42
---
```

### tasks.md

```yaml
---
schema_version: 1
items:
  - title: "Implement X"
    sync_state: pending | created | failed
    external_id: "43"              # filled after sync
    external_url: https://...
    depends_on: []                  # task titles or external ids
    parallel: true | false
---
```

If `items:` is absent, OpenSpecPM falls back to parsing `- [ ] title` checklist lines in the body.

## BDD format

Scenarios in `specs/*.md` should use Gherkin-style triplets:

```
Scenario: User toggles dark mode
  Given the user is signed in
  And their theme preference is "system"
  When they select "Dark" in the appearance menu
  Then the UI re-renders in dark theme
  And their preference is saved to the profile
```

Lint heuristics (enforced softly at `propose`, hard at `sync` in Sprint 3+):

- Each scenario has one `Given`, one `When`, one `Then` (with optional `And`s).
- `Then` uses an observable verb (displays, returns, stores, rejects, emails, …).
- Reject "should work", "should be correct", "is successful" as `Then` predicates.
- Reject tautological `Then` (paraphrase of the `When`).

## ISO timestamps

All `created` / `updated` / `synced` fields use ISO-8601 with timezone:

```
2026-05-17T14:30:00Z
```

## Sync markers

Comments pushed to the PM tool are append-only and stamped:

```
<!-- SYNCED: 2026-05-17T14:30:00Z -->
…progress narrative…
```

This lets re-syncs detect what's already been sent without duplicating.
