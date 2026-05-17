export class AdapterError extends Error {
  constructor(message, { remediation, cause } = {}) {
    super(message, { cause });
    this.name = 'AdapterError';
    this.remediation = remediation;
  }
}

/**
 * Abstract PM-tool adapter. Subclasses implement every method.
 * Capabilities surface the differences between backends so the sync layer
 * can degrade gracefully (e.g. collapse a 4-level task tree for GitHub).
 */
export class Adapter {
  constructor(config = {}) {
    this.config = config;
  }

  get name() {
    return 'base';
  }

  capabilities() {
    return {
      hierarchyDepth: 1,
      supportsSubIssues: false,
      supportsSprints: false,
      supportsLabels: false,
      fieldMap: {},
    };
  }

  async init() {
    throw new AdapterError(`${this.name} adapter does not implement init()`);
  }

  async createEpic(/* feature */) {
    throw new AdapterError(`${this.name} adapter does not implement createEpic()`);
  }

  async createWorkItem(/* epic, task, opts */) {
    throw new AdapterError(`${this.name} adapter does not implement createWorkItem()`);
  }

  async linkWorkItems(/* parent, child, type */) {
    throw new AdapterError(`${this.name} adapter does not implement linkWorkItems()`);
  }

  async addProgressComment(/* item, body */) {
    throw new AdapterError(`${this.name} adapter does not implement addProgressComment()`);
  }

  async updateWorkItem(/* item, patch */) {
    throw new AdapterError(`${this.name} adapter does not implement updateWorkItem()`);
  }

  async closeWorkItem(/* item, resolution */) {
    throw new AdapterError(`${this.name} adapter does not implement closeWorkItem()`);
  }

  async getWorkItem(/* item */) {
    throw new AdapterError(`${this.name} adapter does not implement getWorkItem()`);
  }

  async listWorkItems(/* query */) {
    throw new AdapterError(`${this.name} adapter does not implement listWorkItems()`);
  }

  async doctor() {
    throw new AdapterError(`${this.name} adapter does not implement doctor()`);
  }
}

/**
 * @typedef {Object} WorkItemRef
 * @property {string} adapter
 * @property {string} id          External work-item identifier (issue number, ADO ID, Jira key)
 * @property {string} [url]
 *
 * @typedef {Object} StatusView
 * @property {WorkItemRef} ref
 * @property {string} title
 * @property {'open'|'in_progress'|'blocked'|'closed'} status
 * @property {string[]} labels
 * @property {string} [assignee]
 */
