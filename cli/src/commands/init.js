import * as p from '@clack/prompts';
import { writeConfig, readConfig } from '../config.js';
import { listAdapters } from '../adapters/index.js';

export async function runInit({ nonInteractive = false } = {}) {
  const existing = await readConfig();
  if (existing && nonInteractive) {
    p.note(`Config already exists at .openspecpm/config.json (adapter: ${existing.adapter}).`, 'init');
    return existing;
  }

  p.intro('openspecpm init — pick your PM tool');

  if (existing) {
    const overwrite = await p.confirm({
      message: `A config already exists (adapter: ${existing.adapter}). Overwrite?`,
      initialValue: false,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel('Keeping existing config.');
      return existing;
    }
  }

  const adapter = await p.select({
    message: 'Which PM tool does your team use?',
    options: [
      { value: 'github', label: 'GitHub Issues / Projects', hint: 'Stable (gh CLI)' },
      { value: 'azure', label: 'Azure DevOps Boards', hint: 'Beta — REST + PAT' },
      { value: 'jira', label: 'Jira', hint: 'Beta — REST + API token' },
    ],
  });
  if (p.isCancel(adapter)) return cancelled();
  if (!listAdapters().includes(adapter)) return cancelled();

  const config = { adapter };

  if (adapter === 'github') {
    const repo = await p.text({
      message: 'GitHub repo (owner/name)',
      placeholder: 'aks-builds/openspecpm',
      validate: (v) => (/^[^/]+\/[^/]+$/.test(v ?? '') ? undefined : 'Format must be owner/name'),
    });
    if (p.isCancel(repo)) return cancelled();
    config.repo = repo;
  } else if (adapter === 'azure') {
    const organization = await p.text({ message: 'Azure DevOps organization', placeholder: 'contoso' });
    if (p.isCancel(organization)) return cancelled();
    const project = await p.text({ message: 'Project name', placeholder: 'MyProject' });
    if (p.isCancel(project)) return cancelled();
    config.organization = organization;
    config.project = project;
    p.note('Set AZURE_DEVOPS_EXT_PAT in your environment with Work Items (Read/Write) scope.', 'azure auth');
  } else if (adapter === 'jira') {
    const baseUrl = await p.text({
      message: 'Jira base URL',
      placeholder: 'https://yourorg.atlassian.net',
      validate: (v) => (/^https?:\/\//.test(v ?? '') ? undefined : 'Must be an http(s) URL'),
    });
    if (p.isCancel(baseUrl)) return cancelled();
    const projectKey = await p.text({ message: 'Project key', placeholder: 'PROJ' });
    if (p.isCancel(projectKey)) return cancelled();
    config.baseUrl = baseUrl;
    config.projectKey = projectKey;
    p.note('Set JIRA_EMAIL and JIRA_API_TOKEN in your environment.', 'jira auth');
  }

  const path = await writeConfig(config);
  p.outro(`Wrote ${path}. Next: run \`openspecpm doctor ${adapter}\` to verify auth.`);
  return config;
}

function cancelled() {
  p.cancel('Aborted.');
  return null;
}
