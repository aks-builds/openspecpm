import { GitHubAdapter } from './github.js';
import { AzureAdapter } from './azure.js';
import { JiraAdapter } from './jira.js';
import { AdapterError } from './base.js';

const REGISTRY = {
  github: GitHubAdapter,
  azure: AzureAdapter,
  jira: JiraAdapter,
};

export function listAdapters() {
  return Object.keys(REGISTRY);
}

export function loadAdapter(name, config = {}) {
  const Cls = REGISTRY[name];
  if (!Cls) {
    throw new AdapterError(`Unknown adapter: ${name}`, {
      remediation: `Pick one of: ${listAdapters().join(', ')}`,
    });
  }
  return new Cls(config);
}

export { AdapterError };
