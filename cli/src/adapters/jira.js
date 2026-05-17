import { Adapter, AdapterError } from './base.js';
import { HttpClient, basicAuth } from '../http.js';
import { TokenBucket, PRESETS } from '../ratelimit.js';

const API_PREFIX = '/rest/api/3';

const STATE_TO_NORMALIZED = (s) => {
  const v = (s ?? '').toLowerCase();
  if (['done', 'closed', 'resolved'].includes(v)) return 'closed';
  if (['in progress', 'in review'].includes(v)) return 'in_progress';
  if (['blocked'].includes(v)) return 'blocked';
  return 'open';
};

function adfFromText(text) {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : [],
      },
    ],
  };
}

export class JiraAdapter extends Adapter {
  #http;
  #bucket;

  constructor(config = {}, { fetch: fetchImpl, http } = {}) {
    super(config);
    this.#bucket = new TokenBucket(PRESETS.jira);
    if (http) {
      this.#http = http;
    } else {
      const email = process.env.JIRA_EMAIL;
      const token = process.env.JIRA_API_TOKEN;
      this.#http = new HttpClient({
        baseUrl: config.baseUrl || 'https://placeholder.invalid',
        auth: email && token ? basicAuth(email, token) : null,
        fetch: fetchImpl,
        remediationHint: 'Set JIRA_EMAIL and JIRA_API_TOKEN; verify project key + base URL.',
      });
    }
  }

  get name() {
    return 'jira';
  }

  capabilities() {
    return {
      hierarchyDepth: 3,
      supportsSubIssues: true,
      supportsSprints: true,
      supportsLabels: true,
      fieldMap: { epic: 'Epic', story: 'Story', subtask: 'Sub-task' },
    };
  }

  #projectKey() {
    const key = this.config.projectKey;
    if (!key) {
      throw new AdapterError('Jira adapter requires config.projectKey.', {
        remediation: 'Re-run `openspecpm init` and supply the project key (e.g. "PROJ").',
      });
    }
    return key;
  }

  async #req(method, path, opts) {
    await this.#bucket.take();
    return this.#http.request(method, `${API_PREFIX}${path}`, opts);
  }

  async doctor() {
    const findings = [];
    if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
      findings.push({
        ok: false,
        msg: 'JIRA_EMAIL and/or JIRA_API_TOKEN not set.',
        remediation: 'Create an API token at id.atlassian.com/manage-profile/security/api-tokens and export both vars.',
      });
      return findings;
    }
    if (!this.config.baseUrl) {
      findings.push({ ok: false, msg: 'baseUrl missing from config.', remediation: 'Re-run `openspecpm init`.' });
      return findings;
    }
    try {
      const me = await this.#req('GET', '/myself');
      findings.push({ ok: true, msg: `Authenticated as ${me.emailAddress ?? me.displayName ?? me.accountId}` });
    } catch (err) {
      findings.push({
        ok: false,
        msg: `Auth failed: ${err.message}`,
        remediation: err.remediation ?? 'Verify email + API token + base URL.',
      });
    }
    return findings;
  }

  async init() {
    if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
      throw new AdapterError('JIRA_EMAIL and JIRA_API_TOKEN are required.', {
        remediation: 'Set both env vars before running sync.',
      });
    }
    return this.capabilities();
  }

  async #createIssue({ summary, description, issuetype, parent, labels }) {
    const body = {
      fields: {
        project: { key: this.#projectKey() },
        summary,
        description: adfFromText(description ?? ''),
        issuetype: { name: issuetype },
        labels: labels ?? [],
        ...(parent ? { parent: { key: parent } } : {}),
      },
    };
    const data = await this.#req('POST', '/issue', { body });
    const url = this.config.baseUrl ? `${this.config.baseUrl.replace(/\/$/, '')}/browse/${data.key}` : data.self;
    return { adapter: 'jira', id: data.key, url, raw: data };
  }

  async createEpic(feature) {
    return this.#createIssue({
      summary: feature.name,
      description: feature.summary ?? '',
      issuetype: 'Epic',
      labels: ['openspec', `openspec-${feature.name}`],
    });
  }

  async createWorkItem(epic, task /*, opts */) {
    const issuetype = task.type ?? 'Story';
    const ref = await this.#createIssue({
      summary: task.title,
      description: task.body ?? '',
      issuetype,
      parent: issuetype === 'Sub-task' ? epic.id : undefined,
      labels: ['openspec', `openspec-${epic.feature ?? ''}`],
    });
    if (epic?.id && issuetype !== 'Sub-task') {
      try {
        await this.linkWorkItems(epic, ref, 'Relates');
      } catch {
        // Non-fatal: Epic-link customField IDs vary across instances.
      }
    }
    return ref;
  }

  async linkWorkItems(parent, child, type = 'Relates') {
    await this.#req('POST', '/issueLink', {
      body: {
        type: { name: type },
        inwardIssue: { key: child.id },
        outwardIssue: { key: parent.id },
      },
    });
  }

  async addProgressComment(item, body) {
    await this.#req('POST', `/issue/${encodeURIComponent(item.id)}/comment`, {
      body: { body: adfFromText(body) },
    });
  }

  async updateWorkItem(item, patch) {
    const fields = {};
    if (patch.title) fields.summary = patch.title;
    if (patch.description) fields.description = adfFromText(patch.description);
    if (patch.assignee) fields.assignee = { accountId: patch.assignee };
    if (patch.addLabels) fields.labels = patch.addLabels;
    if (Object.keys(fields).length) {
      await this.#req('PUT', `/issue/${encodeURIComponent(item.id)}`, { body: { fields } });
    }
    if (patch.transition) {
      await this.#req('POST', `/issue/${encodeURIComponent(item.id)}/transitions`, {
        body: { transition: { id: String(patch.transition) } },
      });
    }
  }

  async closeWorkItem(item, resolution) {
    const transitions = await this.#req('GET', `/issue/${encodeURIComponent(item.id)}/transitions`);
    const done = (transitions.transitions ?? []).find((t) => /done|closed|resolve/i.test(t.name));
    if (!done) {
      throw new AdapterError('No Done/Closed transition available for this issue.', {
        remediation: 'Update the workflow or call updateWorkItem({ transition: <id> }) directly.',
      });
    }
    await this.updateWorkItem(item, { transition: done.id });
    if (resolution) await this.addProgressComment(item, resolution);
  }

  async getWorkItem(item) {
    const data = await this.#req('GET', `/issue/${encodeURIComponent(item.id)}`, {
      query: { fields: 'summary,status,labels,assignee' },
    });
    return {
      ref: { adapter: 'jira', id: data.key, url: this.config.baseUrl ? `${this.config.baseUrl.replace(/\/$/, '')}/browse/${data.key}` : data.self },
      title: data.fields?.summary,
      status: STATE_TO_NORMALIZED(data.fields?.status?.name),
      labels: data.fields?.labels ?? [],
      assignee: data.fields?.assignee?.emailAddress ?? data.fields?.assignee?.accountId,
    };
  }

  async listWorkItems(query = {}) {
    const jql = query.jql ?? `project = "${this.#projectKey()}" AND labels = "openspec" ORDER BY created DESC`;
    const data = await this.#req('POST', '/search/jql', {
      body: { jql, fields: ['summary', 'status', 'labels', 'assignee'], maxResults: query.limit ?? 50 },
    });
    return (data.issues ?? []).map((d) => ({
      ref: { adapter: 'jira', id: d.key, url: this.config.baseUrl ? `${this.config.baseUrl.replace(/\/$/, '')}/browse/${d.key}` : d.self },
      title: d.fields?.summary,
      status: STATE_TO_NORMALIZED(d.fields?.status?.name),
      labels: d.fields?.labels ?? [],
      assignee: d.fields?.assignee?.emailAddress ?? d.fields?.assignee?.accountId,
    }));
  }
}
