# Integration tests

These tests hit **live** PM backends. They are gated on `OPENSPECPM_INTEGRATION=1`
plus per-backend env vars:

| Backend | Required env |
|---|---|
| GitHub | `OPENSPECPM_IT_GH_REPO=owner/sandbox-repo` + `gh auth login` done |
| Azure DevOps | `AZURE_DEVOPS_EXT_PAT` + `OPENSPECPM_IT_ADO_ORG` + `OPENSPECPM_IT_ADO_PROJECT` |
| Jira | `JIRA_EMAIL` + `JIRA_API_TOKEN` + `OPENSPECPM_IT_JIRA_BASEURL` + `OPENSPECPM_IT_JIRA_PROJECT` |
| Linear | `LINEAR_API_KEY` + `OPENSPECPM_IT_LINEAR_TEAM_ID` |
| GitLab | `GITLAB_TOKEN` + `OPENSPECPM_IT_GITLAB_PROJECT_ID` |

CI does **not** run these. To execute locally:

```bash
OPENSPECPM_INTEGRATION=1 \
  OPENSPECPM_IT_GH_REPO=aks-builds/openspecpm-sandbox \
  node --test cli/tests/integration/github.test.js
```

Each test:

1. Creates an epic with title `openspecpm-it-<random>`.
2. Creates two tasks under it.
3. Adds a comment.
4. Closes the tasks + the epic.
5. Verifies state via `getWorkItem`.
6. Cleans up via `closeWorkItem` (does not delete — most backends don't support hard-delete via API).

If a test fails partway through, you may have orphaned `openspecpm-it-*` items
in your sandbox project. The next run will create new ones; remove the old ones
manually if needed.
