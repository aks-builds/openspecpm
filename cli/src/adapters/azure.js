import { Adapter, AdapterError } from './base.js';
import { HttpClient, basicAuth } from '../http.js';
import { TokenBucket, PRESETS } from '../ratelimit.js';

// User-controlled ids (from tasks.md frontmatter) MUST be encoded before
// interpolation into URL paths or body URL values, or a value like
// "1/../99" can reach unintended endpoints.
const enc = (v) => encodeURIComponent(String(v));

const API_VERSION = '7.1';
const COMMENTS_API_VERSION = '7.1-preview.3';

const STATE_OPEN = 'New';
const STATE_CLOSED = 'Closed';

const STATE_TO_NORMALIZED = (s) => {
  const v = (s ?? '').toLowerCase();
  if (['closed', 'done', 'removed', 'resolved'].includes(v)) return 'closed';
  if (['active', 'in progress', 'committed'].includes(v)) return 'in_progress';
  if (['blocked'].includes(v)) return 'blocked';
  return 'open';
};

export class AzureAdapter extends Adapter {
  #http;
  #bucket;

  constructor(config = {}, { fetch: fetchImpl, http } = {}) {
    super(config);
    this.#bucket = new TokenBucket(PRESETS.ado);
    if (http) {
      this.#http = http;
    } else {
      const pat = process.env.AZURE_DEVOPS_EXT_PAT;
      const baseUrl = config.baseUrl || (config.organization ? `https://dev.azure.com/${config.organization}` : 'https://placeholder.invalid');
      this.#http = new HttpClient({
        baseUrl,
        auth: pat ? basicAuth('', pat) : null,
        fetch: fetchImpl,
        remediationHint: 'Set AZURE_DEVOPS_EXT_PAT with Work Items (Read/Write) scope, then retry.',
      });
    }
  }

  get name() {
    return 'azure';
  }

  capabilities() {
    return {
      hierarchyDepth: 4,
      supportsSubIssues: true,
      supportsSprints: true,
      supportsLabels: true,
      fieldMap: { epic: 'Epic', feature: 'Feature', story: 'User Story', task: 'Task' },
    };
  }

  #project() {
    const project = this.config.project;
    if (!project) {
      throw new AdapterError('Azure adapter requires config.project.', {
        remediation: 'Re-run `openspecpm init` and supply the project name.',
      });
    }
    return project;
  }

  async #req(method, path, opts) {
    await this.#bucket.take();
    return this.#http.request(method, path, opts);
  }

  async doctor() {
    const findings = [];
    if (!process.env.AZURE_DEVOPS_EXT_PAT) {
      findings.push({
        ok: false,
        msg: 'AZURE_DEVOPS_EXT_PAT not set.',
        remediation: 'Create a PAT with Work Items (Read/Write) and export AZURE_DEVOPS_EXT_PAT.',
      });
      return findings;
    }
    try {
      await this.#req('GET', `/_apis/connectionData`, { query: { 'api-version': API_VERSION } });
      findings.push({ ok: true, msg: 'PAT authenticates against Azure DevOps' });
    } catch (err) {
      findings.push({
        ok: false,
        msg: `PAT auth failed: ${err.message}`,
        remediation: err.remediation ?? 'Verify PAT scopes and organization URL.',
      });
    }
    return findings;
  }

  async init() {
    if (!process.env.AZURE_DEVOPS_EXT_PAT) {
      throw new AdapterError('AZURE_DEVOPS_EXT_PAT is required.', {
        remediation: 'Set the env var with Work Items (Read/Write) scope.',
      });
    }
    return this.capabilities();
  }

  async #createWorkItem(type, fields) {
    const ops = Object.entries(fields).map(([field, value]) => ({
      op: 'add',
      path: `/fields/${field}`,
      value,
    }));
    const path = `/${encodeURIComponent(this.#project())}/_apis/wit/workitems/$${type}`;
    const data = await this.#req('POST', path, {
      query: { 'api-version': API_VERSION },
      body: ops,
      contentType: 'application/json-patch+json',
    });
    return {
      adapter: 'azure',
      id: String(data.id),
      url: data._links?.html?.href ?? data.url,
      raw: data,
    };
  }

  async createEpic(feature) {
    return this.#createWorkItem('Epic', {
      'System.Title': feature.name,
      'System.Description': feature.summary ?? '',
      'System.Tags': `openspec; openspec:${feature.name}`,
    });
  }

  async createWorkItem(epic, task /*, opts */) {
    const fields = {
      'System.Title': task.title,
      'System.Description': task.body ?? '',
      'System.Tags': `openspec; openspec:${epic.feature ?? ''}`,
    };
    const itemType = task.type ?? 'Task';
    const ref = await this.#createWorkItem(itemType, fields);
    if (epic?.id) {
      try {
        await this.linkWorkItems(epic, ref, 'Parent');
      } catch (err) {
        // Non-fatal: caller still gets the ref.
      }
    }
    return ref;
  }

  async linkWorkItems(parent, child, _type = 'Parent') {
    const ops = [
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `${this.config.baseUrl ?? `https://dev.azure.com/${this.config.organization}`}/_apis/wit/workItems/${enc(parent.id)}`,
        },
      },
    ];
    const path = `/${encodeURIComponent(this.#project())}/_apis/wit/workitems/${enc(child.id)}`;
    await this.#req('PATCH', path, {
      query: { 'api-version': API_VERSION },
      body: ops,
      contentType: 'application/json-patch+json',
    });
  }

  async addProgressComment(item, body) {
    const path = `/${encodeURIComponent(this.#project())}/_apis/wit/workItems/${enc(item.id)}/comments`;
    await this.#req('POST', path, {
      query: { 'api-version': COMMENTS_API_VERSION },
      body: { text: body },
    });
  }

  async updateWorkItem(item, patch) {
    const ops = [];
    if (patch.title) ops.push({ op: 'add', path: '/fields/System.Title', value: patch.title });
    if (patch.state) ops.push({ op: 'add', path: '/fields/System.State', value: patch.state });
    if (patch.assignee) ops.push({ op: 'add', path: '/fields/System.AssignedTo', value: patch.assignee });
    if (patch.iterationPath) ops.push({ op: 'add', path: '/fields/System.IterationPath', value: patch.iterationPath });
    if (patch.areaPath) ops.push({ op: 'add', path: '/fields/System.AreaPath', value: patch.areaPath });
    if (!ops.length) return;
    const path = `/${encodeURIComponent(this.#project())}/_apis/wit/workitems/${enc(item.id)}`;
    await this.#req('PATCH', path, {
      query: { 'api-version': API_VERSION },
      body: ops,
      contentType: 'application/json-patch+json',
    });
  }

  async closeWorkItem(item, resolution) {
    await this.updateWorkItem(item, { state: STATE_CLOSED });
    if (resolution) await this.addProgressComment(item, resolution);
  }

  async getWorkItem(item) {
    const path = `/${encodeURIComponent(this.#project())}/_apis/wit/workitems/${enc(item.id)}`;
    const data = await this.#req('GET', path, { query: { 'api-version': API_VERSION } });
    return {
      ref: { adapter: 'azure', id: String(data.id), url: data._links?.html?.href },
      title: data.fields?.['System.Title'],
      status: STATE_TO_NORMALIZED(data.fields?.['System.State']),
      labels: (data.fields?.['System.Tags'] ?? '').split(/;\s*/).filter(Boolean),
      assignee: data.fields?.['System.AssignedTo']?.uniqueName,
    };
  }

  async listWorkItems(query = {}) {
    const tag = query.tag ?? `openspec`;
    const wiql = `SELECT [System.Id], [System.Title], [System.State], [System.Tags], [System.AssignedTo] FROM workitems WHERE [System.TeamProject] = @project AND [System.Tags] CONTAINS '${tag.replace(/'/g, "''")}' ORDER BY [System.Id] DESC`;
    const path = `/${encodeURIComponent(this.#project())}/_apis/wit/wiql`;
    const res = await this.#req('POST', path, {
      query: { 'api-version': API_VERSION },
      body: { query: wiql },
    });
    const ids = (res.workItems ?? []).slice(0, query.limit ?? 50).map((w) => w.id);
    if (!ids.length) return [];
    const batch = await this.#req('GET', `/${encodeURIComponent(this.#project())}/_apis/wit/workitems`, {
      query: { ids: ids.join(','), 'api-version': API_VERSION },
    });
    return (batch.value ?? []).map((data) => ({
      ref: { adapter: 'azure', id: String(data.id), url: data._links?.html?.href },
      title: data.fields?.['System.Title'],
      status: STATE_TO_NORMALIZED(data.fields?.['System.State']),
      labels: (data.fields?.['System.Tags'] ?? '').split(/;\s*/).filter(Boolean),
      assignee: data.fields?.['System.AssignedTo']?.uniqueName,
    }));
  }
}

export { STATE_OPEN, STATE_CLOSED };
