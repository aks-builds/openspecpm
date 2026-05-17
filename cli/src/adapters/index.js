import { GitHubAdapter } from './github.js';
import { AzureAdapter } from './azure.js';
import { JiraAdapter } from './jira.js';
import { AdapterError } from './base.js';

const REGISTRY = {
  github: GitHubAdapter,
  azure: AzureAdapter,
  jira: JiraAdapter,
};

const ALIASES = {
  gh: 'github',
  ado: 'azure',
  'azure-devops': 'azure',
  atlassian: 'jira',
};

export function listAdapters() {
  return Object.keys(REGISTRY);
}

export function resolveAdapter(name) {
  if (!name) return name;
  const key = name.toLowerCase();
  return ALIASES[key] ?? key;
}

export function loadAdapter(name, config = {}) {
  const resolved = resolveAdapter(name);
  const Cls = REGISTRY[resolved];
  if (!Cls) {
    throw new AdapterError(`Unknown adapter: ${name}`, {
      remediation: `Pick one of: ${listAdapters().join(', ')} (aliases: ${Object.keys(ALIASES).join(', ')})`,
    });
  }
  return new Cls(config);
}

export { AdapterError };
