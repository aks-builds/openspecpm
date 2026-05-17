import { Adapter, AdapterError } from './base.js';

export class JiraAdapter extends Adapter {
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

  async doctor() {
    return [
      {
        ok: false,
        msg: 'Jira adapter is alpha (Sprint 2).',
        remediation: 'Use --experimental, or pick the GitHub adapter for v0.1.',
      },
    ];
  }

  #notReady(method) {
    throw new AdapterError(`Jira adapter is alpha; ${method}() lands in Sprint 2.`, {
      remediation: 'Use the GitHub adapter, or run with --experimental once Sprint 2 lands.',
    });
  }

  async init() { this.#notReady('init'); }
  async createEpic() { this.#notReady('createEpic'); }
  async createWorkItem() { this.#notReady('createWorkItem'); }
  async linkWorkItems() { this.#notReady('linkWorkItems'); }
  async addProgressComment() { this.#notReady('addProgressComment'); }
  async updateWorkItem() { this.#notReady('updateWorkItem'); }
  async closeWorkItem() { this.#notReady('closeWorkItem'); }
  async getWorkItem() { this.#notReady('getWorkItem'); }
  async listWorkItems() { this.#notReady('listWorkItems'); }
}
