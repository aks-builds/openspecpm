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
npm test                          # 100 tests should pass
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

## Releasing

Releases run through two workflows. No direct push to `main` and no local `npm publish` step.

- `.github/workflows/release.yml` — manually dispatched. Bumps the version, rolls `CHANGELOG.md`, opens a PR on a `release/v<X.Y.Z>` branch, enables auto-merge.
- `.github/workflows/auto-approve.yml` (consumes the reusable workflow at `aks-builds/workflows`) — auto-approves the release PR using up to two parallel reviewers: a GitHub App and a secondary-account PAT. Both are optional; configure at least one.
- `.github/workflows/publish.yml` — fires when the release PR merges. Reads the bumped version from `package.json`, publishes to npm with sigstore provenance, syncs dist-tags, tags the commit, creates the GitHub release.

**One-time setup (repo secrets):**

1. `RELEASE_PR_PAT` — Personal Access Token from the **primary `aks-builds` account** with `repo` scope (classic) or fine-grained `Contents: Read and write` + `Pull requests: Read and write` scoped to this repo. Used by `release.yml` to push the `release/*` branch and open the PR. **Must be a user-owned PAT, not `GITHUB_TOKEN`** — by design, events triggered by `GITHUB_TOKEN` do not fire downstream workflows, so an auto-opened release PR would never trigger `auto-approve.yml` or `test.yml` and would sit forever waiting for approvals and status checks. A user-owned PAT is not subject to this anti-recursion rule.
2. `NPM_TOKEN` — npm automation token. npmjs.com → Account → Access Tokens → Generate → **Automation** type → copy into GitHub repo Settings → Secrets and variables → Actions.
3. Approver(s) — at least one of:
   - `APPROVER_APP_ID` + `APPROVER_APP_PRIVATE_KEY` — GitHub App credentials. Approval shows up as the bot identity.
   - `APPROVER_PAT` — a Personal Access Token from a **secondary GitHub account** (must be a different user than the `RELEASE_PR_PAT` owner — GitHub rejects self-approval) with `repo` scope. Approval shows up as that user. Useful when you want a real human identity in the review history alongside (or instead of) the bot.

   Configuring both gives two parallel approvals from two distinct identities — sane belt-and-suspenders for branch protection rules that require ≥1 reviewer other than the PR author.
4. Branch protection on `main` — configure the required-approvers count to match how many of the above you configured (1 if you set up only App or only PAT; 2 if you set up both and want both to count). Make sure auto-merge is allowed (Settings → General → Pull Requests → Allow auto-merge).

**Cutting a release:**

1. Make sure everything you want shipped is on `main` and the `[Unreleased]` section of `CHANGELOG.md` has the release notes.
2. GitHub → Actions → `release` → **Run workflow**.
3. Pick the bump:
   - `prerelease` (default) → `0.1.0-alpha.0` becomes `0.1.0-alpha.1`. Uses `preid` (default `alpha`).
   - `patch` / `minor` / `major` → standard semver bumps.
4. Click **Run**.

**What happens, end-to-end:**

1. `release.yml` checks out `main`, runs `npm ci && npm test`.
2. Bumps `package.json` + `package-lock.json` (no commit yet).
3. Rolls `CHANGELOG.md`: inserts an empty `[Unreleased]` and date-stamps the current content as `[X.Y.Z] - YYYY-MM-DD`.
4. Creates branch `release/vX.Y.Z`, commits (`chore(release): X.Y.Z`), pushes the branch.
5. Opens a PR against `main`, enables auto-merge (squash).
6. `auto-approve.yml` fires on PR-opened, calls the reusable workflow, which posts approval(s) from whichever approver identities are configured.
7. Once the required approvals are met and any required checks pass, GitHub auto-merges the PR.
8. `publish.yml` triggers on the PR-merged event. Re-installs, reads version from `package.json`, runs `npm publish --access public --tag <alpha|latest> --provenance`.
9. For pre-1.0 prereleases, also moves the `latest` dist-tag so `npx openspecpm@latest` resolves to the newest alpha.
10. Tags `vX.Y.Z` on the merge commit and pushes the tag.
11. Creates a GitHub release using the just-rolled `CHANGELOG.md` section as the body. Marks it as a prerelease if the version contains a hyphen.

**If something goes wrong:**

- PR opens but auto-approve doesn't fire → check that at least one of `APPROVER_APP_ID`/`APPROVER_PAT` is set, that the PR author matches `owner-login` (defaults to `aks-builds`), and that the auto-approve workflow ran (Actions tab).
- PR merges but publish fails (npm auth, network) → the merge commit and CHANGELOG roll are already on main, but the tag and GitHub release are not. Re-run `publish.yml` manually (Actions → publish → Run workflow with the right ref) once the underlying issue is fixed. The idempotency guard in `publish.yml` will refuse if the tag already exists.
- Publish succeeds but tag/release fail → npm has the package but the repo doesn't reflect it. Manually run `git tag vX.Y.Z <merge-sha> && git push --tags`, then `gh release create vX.Y.Z`.
- Wrong version published → `npm unpublish openspecpm@X.Y.Z` is only allowed within 72 hours and only if nothing depends on it. Better path: publish a corrected version on top.

## Reporting bugs / requesting features

Use the issue templates under `.github/ISSUE_TEMPLATE/`. They cut triage time.

## Code of conduct

Be kind. Disagree with ideas, not people. If something feels off, email the maintainer (see [`SECURITY.md`](SECURITY.md) for contact).
