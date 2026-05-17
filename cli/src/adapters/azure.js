import { Adapter, AdapterError } from './base.js';

export class AzureAdapter extends Adapter {
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

  async doctor() {
    return [
      {
        ok: false,
        msg: 'Azure DevOps adapter is alpha (Sprint 2).',
        remediation: 'Use --experimental, or pick the GitHub adapter for v0.1.',
      },
    ];
  }

  #notReady(method) {
    throw new AdapterError(`Azure DevOps adapter is alpha; ${method}() lands in Sprint 2.`, {
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
