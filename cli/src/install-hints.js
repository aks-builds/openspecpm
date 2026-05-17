import { platform } from 'node:os';

const PACKAGES = {
  gh: {
    win32: 'winget install --id GitHub.cli',
    darwin: 'brew install gh',
    linux: 'sudo apt-get install gh   # or: snap install gh',
  },
  openspec: {
    all: 'npm install -g @fission-ai/openspec',
  },
  az: {
    win32: 'winget install --id Microsoft.AzureCLI',
    darwin: 'brew install azure-cli',
    linux: 'curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash',
  },
  jiracli: {
    all: 'npm install -g @ankitpokhrel/jira-cli   # optional; OpenSpecPM uses REST directly',
  },
};

const PAT_URLS = {
  github: { url: 'https://github.com/settings/tokens', scopes: 'repo, read:org (classic) — or fine-grained PAT scoped to your repo with Contents/Issues/Pull-requests RW' },
  azure: { url: 'https://dev.azure.com/<org>/_usersSettings/tokens', scopes: 'Work Items: Read & Write' },
  jira: { url: 'https://id.atlassian.com/manage-profile/security/api-tokens', scopes: 'API token (no scopes required; full account access)' },
  linear: { url: 'https://linear.app/settings/api', scopes: 'Personal API Key with full scope (read + write)' },
  gitlab: { url: 'https://gitlab.com/-/user_settings/personal_access_tokens', scopes: 'api (full read/write)' },
};

export function installCommand(tool) {
  const entry = PACKAGES[tool];
  if (!entry) return null;
  const os = platform();
  return entry[os] ?? entry.all ?? null;
}

export function patSetup(adapter) {
  return PAT_URLS[adapter] ?? null;
}

export function osName() {
  const map = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
  return map[platform()] ?? platform();
}
