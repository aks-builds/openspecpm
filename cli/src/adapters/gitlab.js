import { Adapter, AdapterError } from './base.js';
import { HttpClient } from '../http.js';
import { TokenBucket } from '../ratelimit.js';

// User-controlled ids (from tasks.md frontmatter) MUST be encoded before
// interpolation into URL paths, or a value like "1/../99" can reach
// unintended project endpoints.
const enc = (v) => encodeURIComponent(String(v));

const STATE_TO_NORMALIZED = (s) => {
  const v = (s ?? '').toLowerCase();
  if (v === 'closed') return 'closed';
  return 'open';
};

export class GitLabAdapter extends Adapter {
  #http;
  #bucket;

  constructor(config = {}, { fetch: fetchImpl, http } = {}) {
    super(config);
    this.#bucket = new TokenBucket({ capacity: 30, refillPerSec: 1 }); // GitLab.com is generous
    const baseUrl = (config.baseUrl || 'https://gitlab.com').replace(/\/$/, '');
    const token = process.env.GITLAB_TOKEN;
    if (http) {
      this.#http = http;
    } else {
      this.#http = new HttpClient({
        baseUrl: `${baseUrl}/api/v4`,
        auth: null,
        defaultHeaders: token ? { 'PRIVATE-TOKEN': token } : {},
        fetch: fetchImpl,
        remediationHint: 'Set GITLAB_TOKEN with api scope; verify projectId.',
      });
    }
  }

  get name() {
    return 'gitlab';
  }

  capabilities() {
    return {
      hierarchyDepth: 2,                  // 3 with Premium epics; we conservatively report 2
      supportsSubIssues: true,             // via issue links
      supportsSprints: true,               // milestones
      supportsLabels: true,
      fieldMap: { epic: 'Issue+epic-label', task: 'Issue', sprint: 'Milestone' },
    };
  }

  #project() {
    const id = this.config.projectId;
    if (id === undefined || id === null || id === '') {
      throw new AdapterError('GitLab adapter requires config.projectId.', {
        remediation: 'Re-run `openspecpm init`; projectId is the numeric ID or "owner/repo".',
      });
    }
    return encodeURIComponent(String(id));
  }

  async #req(method, path, opts) {
    await this.#bucket.take();
    return this.#http.request(method, path, opts);
  }

  async doctor() {
    if (!process.env.GITLAB_TOKEN) {
      return [{ ok: false, msg: 'GITLAB_TOKEN not set.', remediation: 'Create a PAT with `api` scope at gitlab.com/-/user_settings/personal_access_tokens.' }];
    }
    try {
      const me = await this.#req('GET', '/user');
      return [{ ok: true, msg: `Authenticated as ${me.username ?? me.email}` }];
    } catch (err) {
      return [{ ok: false, msg: `Auth failed: ${err.message}`, remediation: err.remediation }];
    }
  }

  async init() {
    if (!process.env.GITLAB_TOKEN) {
      throw new AdapterError('GITLAB_TOKEN is required.', { remediation: 'Export a PAT with api scope.' });
    }
    return this.capabilities();
  }

  async createEpic(feature) {
    // Treat as a labeled issue if Premium Epics not available.
    return this.createWorkItem(null, { title: `Epic: ${feature.name}`, body: feature.summary ?? '', type: 'epic' });
  }

  async createWorkItem(epic, task /*, opts */) {
    const labels = ['openspec'];
    if (task.type === 'epic') labels.push('openspec-epic');
    else labels.push('openspec-task');
    if (epic?.feature) labels.push(`openspec:${epic.feature}`);

    const data = await this.#req('POST', `/projects/${this.#project()}/issues`, {
      body: {
        title: task.title,
        description: task.body ?? '',
        labels: labels.join(','),
      },
    });
    const ref = { adapter: 'gitlab', id: String(data.iid), url: data.web_url };

    if (epic?.id && task.type !== 'epic') {
      try {
        await this.linkWorkItems(epic, ref, 'relates_to');
      } catch {
        // Non-fatal
      }
    }
    return ref;
  }

  async linkWorkItems(parent, child, type = 'relates_to') {
    await this.#req('POST', `/projects/${this.#project()}/issues/${enc(child.id)}/links`, {
      body: {
        target_project_id: this.config.projectId,
        target_issue_iid: parent.id,
        link_type: type,
      },
    });
  }

  async addProgressComment(item, body) {
    await this.#req('POST', `/projects/${this.#project()}/issues/${enc(item.id)}/notes`, {
      body: { body },
    });
  }

  async updateWorkItem(item, patch) {
    const body = {};
    if (patch.title) body.title = patch.title;
    if (patch.description) body.description = patch.description;
    if (patch.addLabels) body.add_labels = patch.addLabels.join(',');
    if (patch.removeLabels) body.remove_labels = patch.removeLabels.join(',');
    if (patch.assignee) body.assignee_ids = [patch.assignee];
    if (patch.milestoneId) body.milestone_id = patch.milestoneId;  // sprint
    if (patch.weight !== undefined) body.weight = patch.weight;     // story points
    if (!Object.keys(body).length) return;
    await this.#req('PUT', `/projects/${this.#project()}/issues/${enc(item.id)}`, { body });
  }

  async closeWorkItem(item, resolution) {
    await this.#req('PUT', `/projects/${this.#project()}/issues/${enc(item.id)}`, {
      body: { state_event: 'close' },
    });
    if (resolution) await this.addProgressComment(item, resolution);
  }

  async getWorkItem(item) {
    const data = await this.#req('GET', `/projects/${this.#project()}/issues/${enc(item.id)}`);
    return {
      ref: { adapter: 'gitlab', id: String(data.iid), url: data.web_url },
      title: data.title,
      status: STATE_TO_NORMALIZED(data.state),
      labels: data.labels ?? [],
      assignee: data.assignee?.username ?? null,
    };
  }

  async listWorkItems(query = {}) {
    const data = await this.#req('GET', `/projects/${this.#project()}/issues`, {
      query: { labels: query.label ?? 'openspec', per_page: query.limit ?? 50, state: query.state },
    });
    return (data ?? []).map((d) => ({
      ref: { adapter: 'gitlab', id: String(d.iid), url: d.web_url },
      title: d.title,
      status: STATE_TO_NORMALIZED(d.state),
      labels: d.labels ?? [],
      assignee: d.assignee?.username ?? null,
    }));
  }
}
