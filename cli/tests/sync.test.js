import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSync } from '../src/commands/sync.js';
import { registerAdapter } from '../src/adapters/index.js';
import * as fm from '../src/frontmatter.js';

// Fake adapter that records every call and can be configured to fail on
// specific task titles. Registered once at module load; tests configure
// per-instance behavior via static state reset in beforeEach-style setup.
class FakeAdapter {
  static lastInstance = null;
  static failOnTitles = new Set();
  static nextEpicId = 'epic-1';
  static nextTaskCounter = 0;

  constructor(config = {}) {
    this.config = config;
    this.calls = [];
    FakeAdapter.lastInstance = this;
  }
  get name() { return 'fake'; }
  capabilities() { return { hierarchyDepth: 2, supportsSubIssues: false, supportsLabels: true, supportsSprints: false, fieldMap: {} }; }
  async doctor() { return [{ ok: true, msg: 'fake' }]; }
  async init() { return this.capabilities(); }
  async createEpic(feature) {
    this.calls.push({ op: 'createEpic', feature });
    return { adapter: 'fake', id: FakeAdapter.nextEpicId, url: `fake://epic/${FakeAdapter.nextEpicId}` };
  }
  async createWorkItem(epic, task) {
    this.calls.push({ op: 'createWorkItem', epic, task });
    if (FakeAdapter.failOnTitles.has(task.title)) {
      throw new Error(`fake: scripted failure for ${task.title}`);
    }
    const id = `t-${++FakeAdapter.nextTaskCounter}`;
    return { adapter: 'fake', id, url: `fake://task/${id}` };
  }
  async linkWorkItems() {}
  async addProgressComment() {}
  async closeWorkItem() {}
  async updateWorkItem() {}
  async getWorkItem() { return { ref: { adapter: 'fake', id: 'x' }, status: 'open', labels: [] }; }
  async listWorkItems() { return []; }
}

// Register once. Subsequent test runs in the same process inherit the
// registration; the static state on FakeAdapter is what we reset.
try { registerAdapter('fake', FakeAdapter); } catch { /* already registered */ }

function resetFake() {
  FakeAdapter.lastInstance = null;
  FakeAdapter.failOnTitles = new Set();
  FakeAdapter.nextEpicId = 'epic-1';
  FakeAdapter.nextTaskCounter = 0;
}

async function withProject({ proposal, tasks, spec, configExtras = {} }, fn) {
  resetFake();
  const root = await mkdtemp(join(tmpdir(), 'openspecpm-sync-'));
  const origCwd = process.cwd();
  try {
    await mkdir(join(root, '.openspecpm'), { recursive: true });
    await writeFile(
      join(root, '.openspecpm', 'config.json'),
      JSON.stringify({ schema_version: 1, adapter: 'fake', ...configExtras }, null, 2),
      'utf8',
    );
    const dir = join(root, 'openspec', 'changes', 'feat');
    await mkdir(join(dir, 'specs'), { recursive: true });
    await writeFile(join(dir, 'proposal.md'), proposal, 'utf8');
    await writeFile(join(dir, 'tasks.md'), tasks, 'utf8');
    await writeFile(join(dir, 'specs', 'main.md'), spec ?? CLEAN_SPEC, 'utf8');
    process.chdir(root);
    await fn(root, dir);
  } finally {
    process.chdir(origCwd);
    await rm(root, { recursive: true, force: true });
  }
}

const CLEAN_PROPOSAL = '---\nname: feat\n---\n\nA crisp summary that becomes the epic body.\n';
const CLEAN_SPEC = 'Scenario: User saves a preference\n  Given the user is signed in\n  When they click Save\n  Then the system stores the new preference\n';
const TASKS_TWO = '---\nschema_version: 1\nitems:\n  - title: "Task A"\n    sync_state: pending\n  - title: "Task B"\n    sync_state: pending\n---\n\n# Tasks\n';

test('sync creates epic + work items and patches tasks.md with sync_state=created', async () => {
  await withProject(
    { proposal: CLEAN_PROPOSAL, tasks: TASKS_TWO },
    async (root, dir) => {
      await runSync({ feature: 'feat' });
      const fake = FakeAdapter.lastInstance;
      assert.ok(fake, 'fake adapter was instantiated');
      assert.equal(fake.calls[0].op, 'createEpic');
      assert.equal(fake.calls[1].op, 'createWorkItem');
      assert.equal(fake.calls[1].task.title, 'Task A');
      assert.equal(fake.calls[2].task.title, 'Task B');

      // tasks.md must have been patched with sync_state: created and external_ids.
      const patched = await readFile(join(dir, 'tasks.md'), 'utf8');
      const { data } = fm.parse(patched);
      assert.equal(data.items[0].sync_state, 'created');
      assert.equal(data.items[0].external_id, 't-1');
      assert.equal(data.items[1].sync_state, 'created');
      assert.equal(data.items[1].external_id, 't-2');
    },
  );
});

test('sync throws BDD lint error when scenario has errors and --force is absent', async () => {
  await withProject(
    {
      proposal: CLEAN_PROPOSAL,
      tasks: TASKS_TWO,
      spec: 'Scenario: Vague\n  Given x\n  When y\n  Then it should work\n',  // "should work" trips deny-list
    },
    async () => {
      await assert.rejects(runSync({ feature: 'feat' }), (err) => {
        assert.match(err.message, /Sync blocked by .* BDD lint errors/);
        assert.match(err.remediation ?? '', /--force/);
        return true;
      });
    },
  );
});

test('sync exits non-zero when adapter fails on any task (H5 regression coverage)', async () => {
  await withProject(
    { proposal: CLEAN_PROPOSAL, tasks: TASKS_TWO },
    async (root, dir) => {
      FakeAdapter.failOnTitles = new Set(['Task B']);
      await assert.rejects(runSync({ feature: 'feat' }), (err) => {
        assert.match(err.message, /1 task\(s\) failed to sync in "feat"/);
        assert.match(err.remediation ?? '', /last_error/);
        return true;
      });
      // tasks.md must still have been patched — last_error preserved for retry.
      const patched = await readFile(join(dir, 'tasks.md'), 'utf8');
      const { data } = fm.parse(patched);
      const failed = data.items.find((t) => t.title === 'Task B');
      assert.equal(failed.sync_state, 'failed');
      assert.match(failed.last_error, /scripted failure/);
      // The successful one before the failure still got created.
      const ok = data.items.find((t) => t.title === 'Task A');
      assert.equal(ok.sync_state, 'created');
    },
  );
});

test('sync is idempotent — already-created tasks are skipped, not re-created', async () => {
  await withProject(
    {
      proposal: CLEAN_PROPOSAL,
      tasks: '---\nschema_version: 1\nitems:\n  - title: "Task A"\n    sync_state: created\n    external_id: t-old\n  - title: "Task B"\n    sync_state: pending\n---\n\n# Tasks\n',
    },
    async () => {
      await runSync({ feature: 'feat' });
      const fake = FakeAdapter.lastInstance;
      // Epic creation runs (no external on proposal frontmatter); then only
      // Task B should be createWorkItem'd. Task A was already created.
      const created = fake.calls.filter((c) => c.op === 'createWorkItem');
      assert.equal(created.length, 1);
      assert.equal(created[0].task.title, 'Task B');
    },
  );
});
