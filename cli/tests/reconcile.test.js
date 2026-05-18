import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runReconcile } from '../src/commands/reconcile.js';
import { registerAdapter } from '../src/adapters/index.js';
import * as fm from '../src/frontmatter.js';

// Tiny fake adapter for reconcile. Returns scripted statuses via static map.
class FakeReconcileAdapter {
  static remoteStatus = new Map();   // external_id -> 'closed' | 'open' | 'in_progress'

  constructor(config = {}) { this.config = config; }
  get name() { return 'fake-rec'; }
  capabilities() { return { hierarchyDepth: 2, supportsLabels: true }; }
  async doctor() { return [{ ok: true }]; }
  async init() {}
  async getWorkItem(item) {
    const status = FakeReconcileAdapter.remoteStatus.get(String(item.id)) ?? 'open';
    return { ref: { adapter: 'fake-rec', id: item.id }, status, labels: [], title: '', assignee: null };
  }
  async createEpic() { throw new Error('not used'); }
  async createWorkItem() { throw new Error('not used'); }
  async closeWorkItem() {}
  async updateWorkItem() {}
  async addProgressComment() {}
  async listWorkItems() { return []; }
  async linkWorkItems() {}
}
try { registerAdapter('fake-rec', FakeReconcileAdapter); } catch { /* already registered */ }

async function withProject(tasksMd, remoteStatus, fn) {
  FakeReconcileAdapter.remoteStatus = new Map(Object.entries(remoteStatus ?? {}));
  const root = await mkdtemp(join(tmpdir(), 'openspecpm-recon-'));
  const origCwd = process.cwd();
  try {
    await mkdir(join(root, '.openspecpm'), { recursive: true });
    await writeFile(join(root, '.openspecpm', 'config.json'), JSON.stringify({ schema_version: 1, adapter: 'fake-rec' }), 'utf8');
    const dir = join(root, 'openspec', 'changes', 'feat');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'proposal.md'), '---\nname: feat\n---\n\nbody\n', 'utf8');
    await writeFile(join(dir, 'tasks.md'), tasksMd, 'utf8');
    process.chdir(root);
    await fn(root, dir);
  } finally {
    process.chdir(origCwd);
    await rm(root, { recursive: true, force: true });
  }
}

test('reconcile detects remote close and writes done:true locally', async () => {
  const tasksMd = '---\nschema_version: 1\nitems:\n  - title: "A"\n    sync_state: created\n    external_id: "100"\n  - title: "B"\n    sync_state: created\n    external_id: "101"\n---\n\nbody\n';
  await withProject(tasksMd, { '100': 'closed', '101': 'open' }, async (_root, dir) => {
    await runReconcile({ feature: 'feat' });
    const patched = await readFile(join(dir, 'tasks.md'), 'utf8');
    const { data } = fm.parse(patched);
    const a = data.items.find((t) => t.title === 'A');
    const b = data.items.find((t) => t.title === 'B');
    assert.equal(a.closed, true, 'remote-closed task gets closed locally');
    assert.equal(a.done, true, 'remote-closed task gets done:true locally');
    // B was open remotely — must not be marked closed.
    assert.notEqual(b.closed, true);
  });
});

test('reconcile dry-run does not write changes to tasks.md', async () => {
  const tasksMd = '---\nschema_version: 1\nitems:\n  - title: "A"\n    sync_state: created\n    external_id: "200"\n---\n\nbody\n';
  await withProject(tasksMd, { '200': 'closed' }, async (_root, dir) => {
    const before = await readFile(join(dir, 'tasks.md'), 'utf8');
    await runReconcile({ feature: 'feat', dryRun: true });
    const after = await readFile(join(dir, 'tasks.md'), 'utf8');
    assert.equal(before, after, 'dry-run must not modify tasks.md');
  });
});
