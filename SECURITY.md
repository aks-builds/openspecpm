# Security Policy

## Supported versions

OpenSpecPM is in pre-1.0 alpha. Security fixes are issued against the latest published version on the `alpha` npm dist-tag.

| Version | Supported |
|---|---|
| `0.1.x-alpha` | ✅ |
| `< 0.1` | ❌ (no releases) |

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports.**

Email the maintainer privately at **its.aks@outlook.com** with:

- A clear description of the issue and impact.
- Steps to reproduce, or a minimal proof-of-concept.
- The affected version (`npx openspecpm --version`).
- Whether you'd like credit in the fix's release notes.

You should receive an acknowledgement within **5 business days**. Triaged reports get a patch on a target timeline based on severity:

| Severity | Target fix window |
|---|---|
| Critical (auth bypass, secret exposure, RCE) | 7 days |
| High (privilege escalation, data integrity) | 14 days |
| Medium (info disclosure, denial of service) | 30 days |
| Low (hardening) | next planned release |

After a fix ships, we'll coordinate a public disclosure date with you.

## Scope

In scope:

- The CLI itself (`cli/`)
- The Agent Skill (`skill/`)
- The published npm tarball

Out of scope:

- Vulnerabilities in upstream OpenSpec, `gh`, `az`, `jira-cli` — report to those projects directly.
- Vulnerabilities in your local PM backend (GitHub, Azure DevOps, Jira) — report to the vendor.
- Misconfiguration that exposes a user's own PAT or API token — that's on the user.

## Handling secrets

OpenSpecPM **never writes auth tokens to `.openspecpm/config.json`**. All credentials flow through environment variables (`AZURE_DEVOPS_EXT_PAT`, `JIRA_EMAIL`, `JIRA_API_TOKEN`) or external tooling (`gh auth login`). If you find a code path that persists a secret to disk, please report it.
