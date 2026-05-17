import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listChanges } from '../src/tracking.js';

async function withFixture(setup, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'openspecpm-validate-'));
  try { await setup(dir); await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

async function writeChange(root, name, proposal, items) {
  const d = join(root, 'openspec', 'changes', name);
  await mkdir(d, { recursive: true });
  const propMd = `---\n${Object.entries(proposal).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n# ${name}\n`;
  await writeFile(join(d, 'proposal.md'), propMd, 'utf8');
  const itemsYaml = items
    .map((i) => '  -\n' + Object.entries(i).map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`).join('\n'))
    .join('\n');
  const tasksMd = `---\nschema_version: 1\nitems:\n${itemsYaml}\n---\n\nbody\n`;
  await writeFile(join(d, 'tasks.md'), tasksMd, 'utf8');
}

test('listChanges roundtrips through validate inputs', async () => {
  await withFixture(
    async (root) => {
      await writeChange(
        root,
        'good',
        { name: 'good', status: 'draft' },
        [{ title: 'A', sync_state: 'pending' }, { title: 'B', sync_state: 'pending', depends_on: ['A'] }],
      );
    },
    async (root) => {
      const changes = await listChanges(root);
      assert.equal(changes.length, 1);
      assert.equal(changes[0].items.length, 2);
      const dep = changes[0].items[1].depends_on;
      assert.deepEqual(dep, ['A']);
    },
  );
});

test('orphan depends_on is detectable from parsed items', async () => {
  await withFixture(
    async (root) => {
      await writeChange(
        root,
        'bad',
        { name: 'bad' },
        [{ title: 'A', sync_state: 'pending', depends_on: ['missing'] }],
      );
    },
    async (root) => {
      const changes = await listChanges(root);
      const dep = changes[0].items[0].depends_on[0];
      const resolved = changes[0].items.some((t) => t.title === dep);
      assert.equal(resolved, false);
    },
  );
});
