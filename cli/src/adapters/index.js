import { GitHubAdapter } from './github.js';
import { AzureAdapter } from './azure.js';
import { JiraAdapter } from './jira.js';
import { LinearAdapter } from './linear.js';
import { GitLabAdapter } from './gitlab.js';
import { AdapterError } from './base.js';

const REGISTRY = {
  github: GitHubAdapter,
  azure: AzureAdapter,
  jira: JiraAdapter,
  linear: LinearAdapter,
  gitlab: GitLabAdapter,
};

const ALIASES = {
  gh: 'github',
  ado: 'azure',
  'azure-devops': 'azure',
  atlassian: 'jira',
  gl: 'gitlab',
};

// Plugin registration hook. Third-party adapters register via:
//   import { registerAdapter } from 'openspecpm/cli/src/adapters/index.js';
//   registerAdapter('myname', MyAdapterClass, { aliases: ['mn'] });
export function registerAdapter(name, ctor, { aliases = [] } = {}) {
  if (REGISTRY[name]) throw new AdapterError(`Adapter "${name}" already registered.`);
  REGISTRY[name] = ctor;
  for (const a of aliases) ALIASES[a] = name;
}

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
