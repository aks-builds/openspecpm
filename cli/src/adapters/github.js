import { execa } from 'execa';
import { Adapter, AdapterError } from './base.js';
import { TokenBucket, PRESETS } from '../ratelimit.js';

const LABEL_EPIC = 'openspec-epic';
const LABEL_TASK = 'openspec-task';

export class GitHubAdapter extends Adapter {
  #runner;
  #bucket;

  constructor(config = {}, { runner = execa } = {}) {
    super(config);
    this.#runner = runner;
    this.#bucket = new TokenBucket(PRESETS.github);
  }

  get name() {
    return 'github';
  }

  capabilities() {
    return {
      hierarchyDepth: 2,
      supportsSubIssues: true,
      supportsSprints: false,
      supportsLabels: true,
      fieldMap: { epic: 'issue+label', task: 'issue+sub-issue' },
    };
  }

  get #repo() {
    const repo = this.config.repo;
    if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) {
      throw new AdapterError('GitHub adapter requires config.repo as "owner/name".', {
        remediation: 'Re-run `openspecpm init` and provide a valid owner/repo.',
      });
    }
    return repo;
  }

  async #gh(args, opts = {}) {
    await this.#bucket.take();
    try {
      const { stdout } = await this.#runner('gh', args, { ...opts });
      return stdout;
    } catch (err) {
      const stderr = err.stderr ?? err.message ?? '';
      throw new AdapterError(`gh ${args.slice(0, 2).join(' ')} failed: ${stderr.trim()}`, {
        remediation: 'Run `openspecpm doctor github` to diagnose.',
        cause: err,
      });
    }
  }

  async doctor() {
    const findings = [];
    try {
      await this.#runner('gh', ['--version']);
    } catch {
      return [{ ok: false, msg: 'gh CLI not installed.', remediation: 'Install GitHub CLI: https://cli.github.com/' }];
    }
    try {
      await this.#runner('gh', ['auth', 'status']);
      findings.push({ ok: true, msg: 'gh auth ok' });
    } catch {
      findings.push({ ok: false, msg: 'gh not authenticated.', remediation: 'Run `gh auth login` and grant repo + read:org scopes.' });
    }
    try {
      await this.#runner('gh', ['extension', 'list']).then((r) => {
        if (!String(r.stdout ?? '').includes('yahsan2/gh-sub-issue')) {
          findings.push({
            ok: false,
            msg: 'gh-sub-issue extension missing (needed for parent/child issue links).',
            remediation: 'Install with `gh extension install yahsan2/gh-sub-issue`.',
          });
        } else {
          findings.push({ ok: true, msg: 'gh-sub-issue installed' });
        }
      });
    } catch {
      // optional extension; non-fatal
    }
    return findings;
  }

  async init() {
    // Ensure labels exist (idempotent).
    for (const [label, color] of [
      [LABEL_EPIC, '0E8A16'],
      [LABEL_TASK, '1D76DB'],
    ]) {
      try {
        await this.#gh(['label', 'create', label, '--color', color, '--repo', this.#repo]);
      } catch {
        /* already exists — fine */
      }
    }
    return this.capabilities();
  }

  async createEpic(feature) {
    const title = `Epic: ${feature.name}`;
    const body = feature.summary ?? '';
    const stdout = await this.#gh([
      'issue', 'create',
      '--repo', this.#repo,
      '--title', title,
      '--body', body,
      '--label', `${LABEL_EPIC},openspec:${feature.name}`,
    ]);
    const url = stdout.trim().split('\n').pop();
    const id = url.match(/\/(\d+)$/)?.[1];
    return { adapter: 'github', id, url };
  }

  async createWorkItem(epic, task /*, opts */) {
    const stdout = await this.#gh([
      'issue', 'create',
      '--repo', this.#repo,
      '--title', task.title,
      '--body', task.body ?? '',
      '--label', `${LABEL_TASK},openspec:${epic.feature ?? ''}`,
    ]);
    const url = stdout.trim().split('\n').pop();
    const id = url.match(/\/(\d+)$/)?.[1];
    const ref = { adapter: 'github', id, url };
    // Best-effort parent/child link via gh-sub-issue.
    try {
      await this.#gh(['sub-issue', 'add', '--repo', this.#repo, '--parent', epic.id, '--child', id]);
    } catch {
      // Extension not installed or call failed — caller can fall back to task lists.
    }
    return ref;
  }

  async linkWorkItems(parent, child /*, type */) {
    await this.#gh(['sub-issue', 'add', '--repo', this.#repo, '--parent', parent.id, '--child', child.id]);
  }

  async listChildren(parent) {
    try {
      const raw = await this.#gh(['sub-issue', 'list', '--repo', this.#repo, '--parent', parent.id]);
      // Newer versions of the extension support --json; older ones return text.
      try {
        const list = JSON.parse(raw);
        return Array.isArray(list)
          ? list.map((d) => ({ adapter: 'github', id: String(d.number ?? d.id), url: d.url }))
          : [];
      } catch {
        // Fallback: parse `#42 - Title` lines.
        return (raw ?? '').split(/\r?\n/).map((l) => l.match(/#(\d+)/)?.[1]).filter(Boolean)
          .map((id) => ({ adapter: 'github', id, url: `https://github.com/${this.config.repo}/issues/${id}` }));
      }
    } catch {
      return [];
    }
  }

  async removeChild(parent, child) {
    try {
      await this.#gh(['sub-issue', 'remove', '--repo', this.#repo, '--parent', parent.id, '--child', child.id]);
    } catch (err) {
      throw new AdapterError(`Failed to remove sub-issue link: ${err.message}`, {
        remediation: 'Ensure the gh-sub-issue extension is installed: `gh extension install yahsan2/gh-sub-issue`.',
      });
    }
  }

  async addProgressComment(item, body) {
    await this.#gh([
      'issue', 'comment', item.id,
      '--repo', this.#repo,
      '--body', body,
    ]);
  }

  async updateWorkItem(item, patch) {
    const args = ['issue', 'edit', item.id, '--repo', this.#repo];
    if (patch.addLabels) for (const l of patch.addLabels) args.push('--add-label', l);
    if (patch.removeLabels) for (const l of patch.removeLabels) args.push('--remove-label', l);
    if (patch.assignee) args.push('--add-assignee', patch.assignee);
    await this.#gh(args);
  }

  async closeWorkItem(item, resolution) {
    await this.#gh([
      'issue', 'close', item.id,
      '--repo', this.#repo,
      ...(resolution ? ['--comment', resolution] : []),
    ]);
  }

  async getWorkItem(item) {
    const raw = await this.#gh([
      'issue', 'view', item.id,
      '--repo', this.#repo,
      '--json', 'state,title,labels,assignees,url',
    ]);
    const data = JSON.parse(raw);
    return {
      ref: { adapter: 'github', id: item.id, url: data.url },
      title: data.title,
      status: data.state?.toLowerCase() === 'closed' ? 'closed' : 'open',
      labels: (data.labels ?? []).map((l) => l.name),
      assignee: data.assignees?.[0]?.login,
    };
  }

  async listWorkItems(query = {}) {
    const args = ['issue', 'list', '--repo', this.#repo, '--json', 'number,state,title,labels,assignees,url', '--limit', String(query.limit ?? 100)];
    if (query.label) args.push('--label', query.label);
    if (query.state) args.push('--state', query.state);
    const raw = await this.#gh(args);
    const list = JSON.parse(raw);
    return list.map((d) => ({
      ref: { adapter: 'github', id: String(d.number), url: d.url },
      title: d.title,
      status: d.state?.toLowerCase() === 'closed' ? 'closed' : 'open',
      labels: (d.labels ?? []).map((l) => l.name),
      assignee: d.assignees?.[0]?.login,
    }));
  }
}
