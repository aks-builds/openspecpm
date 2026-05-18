import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runShip } from '../src/commands/ship.js';
import { registerAdapter } from '../src/adapters/index.js';

// Fake adapter for ship. Records each closeWorkItem call so we can assert
// that the open synced tasks + the epic all get closed.
class FakeShipAdapter {
  static closed = [];
  constructor(config = {}) { this.config = config; }
  get name() { return 'fake-ship'; }
  capabilities() { return { hierarchyDepth: 2 }; }
  async doctor() { return [{ ok: true }]; }
  async init() {}
  async closeWorkItem(item, resolution) {
    FakeShipAdapter.closed.push({ id: item.id, resolution });
  }
  async createEpic() {}
  async createWorkItem() {}
  async updateWorkItem() {}
  async addProgressComment() {}
  async getWorkItem() { return { ref: { id: 'x' }, status: 'open' }; }
  async listWorkItems() { return []; }
  async linkWorkItems() {}
}
try { registerAdapter('fake-ship', FakeShipAdapter); } catch { /* already registered */ }

async function withProject({ tasksMd, proposalMd }, fn) {
  FakeShipAdapter.closed = [];
  const root = await mkdtemp(join(tmpdir(), 'openspecpm-ship-'));
  const origCwd = process.cwd();
  try {
    await mkdir(join(root, '.openspecpm'), { recursive: true });
    await writeFile(join(root, '.openspecpm', 'config.json'), JSON.stringify({ schema_version: 1, adapter: 'fake-ship' }), 'utf8');
    const dir = join(root, 'openspec', 'changes', 'feat');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'proposal.md'), proposalMd, 'utf8');
    await writeFile(join(dir, 'tasks.md'), tasksMd, 'utf8');
    process.chdir(root);
    await fn(root, dir);
  } finally {
    process.chdir(origCwd);
    await rm(root, { recursive: true, force: true });
  }
}

test('ship --yes --skip-archive closes every open synced task and the epic', async () => {
  const proposalMd = '---\nname: feat\nexternal:\n  fake-ship:\n    adapter: fake-ship\n    id: epic-99\n    url: fake://epic/99\n---\n\nbody\n';
  const tasksMd = '---\nschema_version: 1\nitems:\n  - title: "A"\n    sync_state: created\n    external_id: "10"\n  - title: "B"\n    sync_state: created\n    external_id: "11"\n  - title: "C-done-already"\n    sync_state: created\n    external_id: "12"\n    done: true\n---\n\nbody\n';
  await withProject({ proposalMd, tasksMd }, async () => {
    await runShip({ feature: 'feat', yes: true, skipArchive: true });
    const closed = FakeShipAdapter.closed;
    // Should close: A (10), B (11), and the epic (epic-99). C is already done — skipped.
    const ids = closed.map((c) => c.id).sort();
    assert.deepEqual(ids, ['10', '11', 'epic-99'].sort());
    // Resolution for tasks vs epic differs in shape (ship.js emits per-feature
    // text); just confirm each call had a resolution string.
    for (const c of closed) assert.equal(typeof c.resolution, 'string');
  });
});

test('ship --yes --skip-archive is a no-op when no synced tasks exist', async () => {
  const proposalMd = '---\nname: feat\n---\n\nbody\n';   // no `external:`
  const tasksMd = '---\nschema_version: 1\nitems:\n  - title: "A"\n    sync_state: pending\n---\n\nbody\n';
  await withProject({ proposalMd, tasksMd }, async () => {
    await runShip({ feature: 'feat', yes: true, skipArchive: true });
    assert.equal(FakeShipAdapter.closed.length, 0, 'no closeWorkItem calls when nothing is synced');
  });
});
