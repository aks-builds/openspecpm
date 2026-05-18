import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findNextTasks, findBlockedTasks, listChanges, summarizeChange } from '../src/tracking.js';

async function withFixture(setup, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'openspecpm-track-'));
  try {
    await setup(dir);
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeChange(root, name, { proposal = {}, items = [] } = {}) {
  const d = join(root, 'openspec', 'changes', name);
  await mkdir(d, { recursive: true });
  const propMd = `---\n${yaml(proposal)}\n---\n\n# ${name}\n`;
  await writeFile(join(d, 'proposal.md'), propMd, 'utf8');
  const tasksMd = `---\nschema_version: 1\nitems:\n${items.map(yamlListItem).join('')}---\n\nbody\n`;
  await writeFile(join(d, 'tasks.md'), tasksMd, 'utf8');
}

function yaml(obj) {
  return Object.entries(obj).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
}
function yamlListItem(item) {
  const fields = Object.entries(item).map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`).join('\n');
  return `  -\n${fields}\n`;
}

test('listChanges + summarizeChange counts by state', async () => {
  await withFixture(
    async (root) => {
      await writeChange(root, 'alpha', {
        proposal: { name: 'alpha', status: 'in_review' },
        items: [
          { title: 'A1', sync_state: 'created' },
          { title: 'A2', sync_state: 'pending' },
          { title: 'A3', sync_state: 'failed' },
        ],
      });
    },
    async (root) => {
      const changes = await listChanges(root);
      assert.equal(changes.length, 1);
      const summary = summarizeChange(changes[0]);
      assert.equal(summary.total, 3);
      assert.equal(summary.counts.created, 1);
      assert.equal(summary.counts.pending, 1);
      assert.equal(summary.counts.failed, 1);
    },
  );
});

test('findNextTasks excludes tasks with unmet deps', async () => {
  await withFixture(
    async (root) => {
      await writeChange(root, 'beta', {
        items: [
          { title: 'A', sync_state: 'pending', depends_on: [] },
          { title: 'B', sync_state: 'pending', depends_on: ['A'] },
        ],
      });
    },
    async (root) => {
      const changes = await listChanges(root);
      const next = findNextTasks(changes);
      assert.equal(next.length, 1);
      assert.equal(next[0].task.title, 'A');
    },
  );
});

test('findBlockedTasks reports unmet dep name and reason', async () => {
  await withFixture(
    async (root) => {
      await writeChange(root, 'gamma', {
        items: [
          { title: 'A', sync_state: 'pending', depends_on: [] },
          { title: 'B', sync_state: 'pending', depends_on: ['A'] },
          { title: 'C', sync_state: 'pending', depends_on: ['missing'] },
        ],
      });
    },
    async (root) => {
      const changes = await listChanges(root);
      const blocked = findBlockedTasks(changes);
      assert.equal(blocked.length, 2);
      const C = blocked.find((b) => b.task.title === 'C');
      assert.equal(C.unmet[0].reason, 'not-found');
      const B = blocked.find((b) => b.task.title === 'B');
      assert.equal(B.unmet[0].reason, 'dep-open');
    },
  );
});

test('loadChange rejects when tasks.md items: is not an array', async () => {
  await withFixture(
    async (root) => {
      const d = join(root, 'openspec', 'changes', 'bad');
      await mkdir(d, { recursive: true });
      await writeFile(join(d, 'proposal.md'), '---\nname: bad\n---\n\nbody\n', 'utf8');
      // items: is a string, not a list. Previously this crashed downstream
      // with `TypeError: items is not iterable`. Now it must raise a clear error.
      await writeFile(join(d, 'tasks.md'), '---\nschema_version: 1\nitems: "oops not a list"\n---\n\n', 'utf8');
    },
    async (root) => {
      await assert.rejects(listChanges(root), (err) => {
        assert.match(err.message, /items.*must be a YAML array/);
        assert.match(err.remediation, /Edit openspec\/changes\/bad\/tasks\.md/);
        return true;
      });
    },
  );
});

test('loadChange surfaces malformed YAML with file context', async () => {
  await withFixture(
    async (root) => {
      const d = join(root, 'openspec', 'changes', 'broken');
      await mkdir(d, { recursive: true });
      await writeFile(join(d, 'proposal.md'), '---\nname: broken\n---\n\nbody\n', 'utf8');
      // Frontmatter that the YAML parser will reject — unclosed flow sequence + bad indent.
      await writeFile(join(d, 'tasks.md'), '---\nitems: [\n  - title: "x\n---\n\n', 'utf8');
    },
    async (root) => {
      await assert.rejects(listChanges(root), (err) => {
        assert.match(err.message, /tasks\.md: YAML frontmatter is malformed/);
        assert.match(err.remediation, /Repair the YAML/);
        return true;
      });
    },
  );
});

test('loadChange filters out malformed item entries (missing title) without crashing', async () => {
  await withFixture(
    async (root) => {
      const d = join(root, 'openspec', 'changes', 'mixed');
      await mkdir(d, { recursive: true });
      await writeFile(join(d, 'proposal.md'), '---\nname: mixed\n---\n\nbody\n', 'utf8');
      await writeFile(
        join(d, 'tasks.md'),
        '---\nschema_version: 1\nitems:\n  - title: "good one"\n    sync_state: pending\n  - sync_state: pending\n  - title: "another good one"\n    sync_state: created\n---\n\n',
        'utf8',
      );
    },
    async (root) => {
      const changes = await listChanges(root);
      assert.equal(changes.length, 1);
      // Middle entry has no `title:` — must be dropped, not crash.
      assert.equal(changes[0].items.length, 2);
      assert.equal(changes[0].items[0].title, 'good one');
      assert.equal(changes[0].items[1].title, 'another good one');
    },
  );
});

test('done dep unblocks its dependent', async () => {
  await withFixture(
    async (root) => {
      await writeChange(root, 'delta', {
        items: [
          { title: 'A', sync_state: 'created', done: true, depends_on: [] },
          { title: 'B', sync_state: 'pending', depends_on: ['A'] },
        ],
      });
    },
    async (root) => {
      const changes = await listChanges(root);
      const blocked = findBlockedTasks(changes);
      assert.equal(blocked.length, 0);
      const next = findNextTasks(changes);
      assert.equal(next.length, 1);
      assert.equal(next[0].task.title, 'B');
    },
  );
});
