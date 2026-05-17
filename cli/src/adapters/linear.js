import { Adapter, AdapterError } from './base.js';
import { TokenBucket } from '../ratelimit.js';

const ENDPOINT = 'https://api.linear.app/graphql';

const STATE_TO_NORMALIZED = (typeName) => {
  const v = (typeName ?? '').toLowerCase();
  if (v === 'completed' || v === 'canceled') return 'closed';
  if (v === 'started') return 'in_progress';
  if (v === 'unstarted' || v === 'backlog' || v === 'triage') return 'open';
  return 'open';
};

export class LinearAdapter extends Adapter {
  #fetch;
  #bucket;

  constructor(config = {}, { fetch: fetchImpl = globalThis.fetch } = {}) {
    super(config);
    this.#fetch = fetchImpl;
    // Linear publishes 1500 req/hour soft limit on personal API keys.
    this.#bucket = new TokenBucket({ capacity: 30, refillPerSec: 0.4 });
  }

  get name() {
    return 'linear';
  }

  capabilities() {
    return {
      hierarchyDepth: 2,
      supportsSubIssues: true,
      supportsSprints: true,    // Cycles
      supportsLabels: true,
      fieldMap: { epic: 'Project', task: 'Issue', sprint: 'Cycle' },
    };
  }

  #apiKey() {
    const key = process.env.LINEAR_API_KEY;
    if (!key) {
      throw new AdapterError('LINEAR_API_KEY not set.', {
        remediation: 'Create a Personal API Key at linear.app/settings/api and export LINEAR_API_KEY.',
      });
    }
    return key;
  }

  #teamId() {
    const id = this.config.teamId;
    if (!id) {
      throw new AdapterError('Linear adapter requires config.teamId.', {
        remediation: 'Re-run `openspecpm init`; team ID is shown in your Linear team settings URL.',
      });
    }
    return id;
  }

  async #gql(query, variables = {}) {
    await this.#bucket.take();
    let res;
    try {
      res = await this.#fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: this.#apiKey(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch (err) {
      throw new AdapterError(`Linear network error: ${err.message}`, {
        remediation: 'Check connectivity and LINEAR_API_KEY scope.',
        cause: err,
      });
    }
    const text = await res.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
    if (!res.ok || payload.errors) {
      const msg = payload.errors?.map((e) => e.message).join('; ') || `${res.status} ${res.statusText}`;
      throw new AdapterError(`Linear GraphQL error: ${msg}`, {
        remediation: res.status === 401 || res.status === 403
          ? 'Verify LINEAR_API_KEY has full scope (read+write).'
          : 'Inspect the GraphQL error and adjust the request.',
      });
    }
    return payload.data;
  }

  async doctor() {
    if (!process.env.LINEAR_API_KEY) {
      return [{ ok: false, msg: 'LINEAR_API_KEY not set.', remediation: 'Create a key at linear.app/settings/api.' }];
    }
    try {
      const data = await this.#gql(`query { viewer { id name } }`);
      return [{ ok: true, msg: `Authenticated as ${data.viewer?.name ?? data.viewer?.id}` }];
    } catch (err) {
      return [{ ok: false, msg: `Auth failed: ${err.message}`, remediation: err.remediation }];
    }
  }

  async init() {
    this.#apiKey();
    this.#teamId();
    return this.capabilities();
  }

  async createEpic(feature) {
    // Linear models "epic" as a Project.
    const data = await this.#gql(
      `mutation($input: ProjectCreateInput!) {
         projectCreate(input: $input) {
           success
           project { id name url }
         }
       }`,
      {
        input: {
          name: feature.name,
          description: feature.summary ?? '',
          teamIds: [this.#teamId()],
        },
      },
    );
    if (!data.projectCreate?.success) {
      throw new AdapterError('Linear projectCreate returned success=false.');
    }
    const p = data.projectCreate.project;
    return { adapter: 'linear', id: p.id, url: p.url };
  }

  async createWorkItem(epic, task /*, opts */) {
    const data = await this.#gql(
      `mutation($input: IssueCreateInput!) {
         issueCreate(input: $input) {
           success
           issue { id identifier url }
         }
       }`,
      {
        input: {
          teamId: this.#teamId(),
          title: task.title,
          description: task.body ?? '',
          projectId: epic?.id,
          labelIds: this.config.openspecLabelId ? [this.config.openspecLabelId] : undefined,
        },
      },
    );
    if (!data.issueCreate?.success) {
      throw new AdapterError('Linear issueCreate returned success=false.');
    }
    const i = data.issueCreate.issue;
    return { adapter: 'linear', id: i.identifier, url: i.url };
  }

  async linkWorkItems(parent, child /*, type */) {
    // Linear supports parent/child via Issue.parent. Sub-issue mapping.
    await this.#gql(
      `mutation($id: String!, $parentId: String!) {
         issueUpdate(id: $id, input: { parentId: $parentId }) {
           success
         }
       }`,
      { id: child.id, parentId: parent.id },
    );
  }

  async addProgressComment(item, body) {
    await this.#gql(
      `mutation($input: CommentCreateInput!) {
         commentCreate(input: $input) { success }
       }`,
      { input: { issueId: item.id, body } },
    );
  }

  async updateWorkItem(item, patch) {
    const input = {};
    if (patch.title) input.title = patch.title;
    if (patch.description) input.description = patch.description;
    if (patch.assignee) input.assigneeId = patch.assignee;
    if (patch.stateId) input.stateId = patch.stateId;
    if (patch.estimate !== undefined) input.estimate = patch.estimate;  // story points
    if (patch.cycleId) input.cycleId = patch.cycleId;                    // sprint
    if (!Object.keys(input).length) return;
    await this.#gql(
      `mutation($id: String!, $input: IssueUpdateInput!) {
         issueUpdate(id: $id, input: $input) { success }
       }`,
      { id: item.id, input },
    );
  }

  async closeWorkItem(item, resolution) {
    // Find a "Done"-like workflow state for the team.
    const data = await this.#gql(
      `query($teamId: String!) {
         workflowStates(filter: { team: { id: { eq: $teamId } } }) {
           nodes { id name type }
         }
       }`,
      { teamId: this.#teamId() },
    );
    const done = (data.workflowStates?.nodes ?? []).find((s) => s.type === 'completed');
    if (!done) {
      throw new AdapterError('No "completed" workflow state found for the team.', {
        remediation: 'Add a Done state in Linear team settings.',
      });
    }
    await this.updateWorkItem(item, { stateId: done.id });
    if (resolution) await this.addProgressComment(item, resolution);
  }

  async getWorkItem(item) {
    const data = await this.#gql(
      `query($id: String!) {
         issue(id: $id) {
           id identifier url title
           state { type }
           labels { nodes { name } }
           assignee { id name email }
         }
       }`,
      { id: item.id },
    );
    const i = data.issue;
    if (!i) throw new AdapterError(`Linear issue ${item.id} not found.`);
    return {
      ref: { adapter: 'linear', id: i.identifier, url: i.url },
      title: i.title,
      status: STATE_TO_NORMALIZED(i.state?.type),
      labels: (i.labels?.nodes ?? []).map((l) => l.name),
      assignee: i.assignee?.email ?? i.assignee?.name ?? null,
    };
  }

  async listWorkItems(query = {}) {
    const data = await this.#gql(
      `query($teamId: String!, $first: Int!) {
         issues(filter: { team: { id: { eq: $teamId } } }, first: $first) {
           nodes {
             identifier url title
             state { type }
             labels { nodes { name } }
             assignee { email name }
           }
         }
       }`,
      { teamId: this.#teamId(), first: query.limit ?? 50 },
    );
    return (data.issues?.nodes ?? []).map((i) => ({
      ref: { adapter: 'linear', id: i.identifier, url: i.url },
      title: i.title,
      status: STATE_TO_NORMALIZED(i.state?.type),
      labels: (i.labels?.nodes ?? []).map((l) => l.name),
      assignee: i.assignee?.email ?? i.assignee?.name ?? null,
    }));
  }
}
