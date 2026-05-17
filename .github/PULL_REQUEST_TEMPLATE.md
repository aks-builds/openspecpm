<!--
Thanks for the PR. A few quick checks before you hit submit:
- Read CONTRIBUTING.md if this is your first PR.
- Keep the diff scoped — one change per PR.
- Conventional Commits in the title (feat: / fix: / docs: / chore: / test: / refactor:)
-->

## What & why

<!-- One paragraph. What does this change, and why now? Link the issue (e.g. "Closes #42"). -->

## Type of change

- [ ] `feat` — new behavior
- [ ] `fix` — bug fix
- [ ] `refactor` — no behavior change
- [ ] `docs` — docs / comments / README
- [ ] `chore` — tooling / CI / deps
- [ ] `test` — tests only

## Checklist

- [ ] `npm test` passes locally
- [ ] Tests added/updated for the behavior change (or N/A — explain below)
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] README command-reference and/or SKILL.md trigger phrases updated (if commands changed)
- [ ] Adapter changes update the field-mapping table in `skill/openspecpm/references/sync.md`
- [ ] No secrets, PATs, or API tokens in code, tests, or fixtures
- [ ] BDD scenarios (if added/changed) pass `cli/src/bdd/linter.js` heuristics

## Backend coverage

<!-- If this touches a backend, which adapters did you verify against? -->
- [ ] GitHub
- [ ] Azure DevOps
- [ ] Jira
- [ ] N/A — non-backend change

## Screenshots / output

<!-- If user-visible (CLI output, README, skill docs), paste a before/after. -->

## Anything reviewers should know

<!-- Edge cases, design alternatives you considered, follow-ups you're punting. -->
