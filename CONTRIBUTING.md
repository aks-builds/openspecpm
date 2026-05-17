# Contributing to OpenSpecPM

Thanks for your interest. OpenSpecPM is a spec-driven, BDD-shaped PM tool for AI agents — and it dogfoods itself: contributions follow the same OpenSpec → BDD → tasks → PR loop the tool was built for.

## TL;DR

- Use Node 20 or newer.
- `npm install && npm test` must pass before opening a PR.
- One change per PR — keep the diff scoped.
- For any change that touches behavior, add or update a test.
- For any change that adds or changes commands, update the README command-reference table and `CHANGELOG.md`.

## Setup

```bash
git clone https://github.com/aks-builds/openspecpm.git
cd openspecpm
npm install
npm test                          # 49 tests should pass
node cli/bin/openspecpm.js --help # smoke-test the CLI
```

If you'll be using `propose`/`sync` end-to-end locally, install OpenSpec too:

```bash
npm install -g @fission-ai/openspec
```

## Branch + commit

- Branch from `main` with a short slug: `feat/sprint4-comment-command`, `fix/jira-adf-link`, `docs/readme-screenshots`.
- Commit messages use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`. The subject line should fit in 70 chars; explain the *why* in the body.

Example:

```
fix(jira): fall back to issuelink when epic-link custom field is absent

Jira Cloud instances do not expose the customfield_10014 (Epic Link)
without a paid plan, so the previous logic silently failed for free
tenants. Use the generic /issueLink endpoint as a best-effort fallback.
```

## Adding or changing an adapter

The adapter contract lives in `cli/src/adapters/base.js` — all 9 methods plus `capabilities()`. New backends must:

1. Implement every method (throw `AdapterError` with a `remediation` hint where a feature isn't supported).
2. Add a `doctor()` that diagnoses auth state and returns findings with English remediation.
3. Register in `cli/src/adapters/index.js` (REGISTRY + ALIASES).
4. Ship contract tests against a mocked `fetch` (see `cli/tests/azure-adapter.test.js` or `jira-adapter.test.js`).
5. Update the field-mapping table in `skill/openspecpm/references/sync.md`.

## Adding or changing a command

1. Implement under `cli/src/commands/<name>.js` and export `run<Name>`.
2. Register in `cli/bin/openspecpm.js` with `program.command(...)`.
3. Update the command-reference table in `README.md` and the script-first table in `skill/openspecpm/SKILL.md`.
4. If the command shifts the workflow, update the relevant phase doc under `skill/openspecpm/references/`.

## Testing

- `node --test` recurses into `cli/tests/`. We use only the built-in Node test runner — no Jest, no mocha.
- Adapter tests use a `mockFetch` helper. Don't make real network calls from tests.
- For interactive prompts (`@clack/prompts`), test the pure logic separately and keep the prompt layer thin.

## BDD scenarios for new behavior

Every behavioral change should ship with a Given/When/Then scenario in a comment or a fixture file. The project lints scenarios via `cli/src/bdd/linter.js` — keep your wording observable, no "should work".

## Reporting bugs / requesting features

Use the issue templates under `.github/ISSUE_TEMPLATE/`. They cut triage time.

## Code of conduct

Be kind. Disagree with ideas, not people. If something feels off, email the maintainer (see [`SECURITY.md`](SECURITY.md) for contact).
