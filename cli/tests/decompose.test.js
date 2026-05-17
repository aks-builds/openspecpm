import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDecompose } from '../src/commands/decompose.js';
import * as fm from '../src/frontmatter.js';

async function withProject(setup, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'openspecpm-decomp-'));
  const origCwd = process.cwd();
  try {
    await setup(dir);
    process.chdir(dir);
    await fn(dir);
  } finally {
    process.chdir(origCwd);
    await rm(dir, { recursive: true, force: true });
  }
}

test('decompose extracts checklist items + tasks section + BDD scenarios', async () => {
  await withProject(
    async (root) => {
      const d = join(root, 'openspec', 'changes', 'demo');
      await mkdir(join(d, 'specs'), { recursive: true });
      await writeFile(
        join(d, 'proposal.md'),
        `---\nname: demo\n---\n\n# Demo\n\n- [ ] Add user model\n- [x] Already done thing\n\n## Tasks\n- Write migration\n- Update README\n\n## Other\n- Not a task\n`,
        'utf8',
      );
      await writeFile(
        join(d, 'specs', 'theme.md'),
        `Scenario: User toggles dark mode\n  Given a user\n  When they click toggle\n  Then the UI re-renders\n`,
        'utf8',
      );
    },
    async (root) => {
      await runDecompose({ feature: 'demo' });
      const tasksMd = await readFile(join(root, 'openspec', 'changes', 'demo', 'tasks.md'), 'utf8');
      const { data } = fm.parse(tasksMd);
      const titles = data.items.map((i) => i.title);
      assert.ok(titles.includes('Add user model'));
      assert.ok(titles.includes('Already done thing'));
      assert.ok(titles.includes('Write migration'));
      assert.ok(titles.includes('Update README'));
      assert.ok(titles.some((t) => t.includes('User toggles dark mode')));
      // No duplicates
      assert.equal(new Set(titles).size, titles.length);
    },
  );
});

test('decompose refuses to overwrite tasks.md without --force', async () => {
  await withProject(
    async (root) => {
      const d = join(root, 'openspec', 'changes', 'demo');
      await mkdir(d, { recursive: true });
      await writeFile(join(d, 'proposal.md'), `---\nname: demo\n---\n\n- [ ] X\n`, 'utf8');
      await writeFile(join(d, 'tasks.md'), `---\nschema_version: 1\nitems:\n  -\n    title: "Existing"\n---\nbody\n`, 'utf8');
    },
    async (root) => {
      await runDecompose({ feature: 'demo' });
      const tasksMd = await readFile(join(root, 'openspec', 'changes', 'demo', 'tasks.md'), 'utf8');
      assert.match(tasksMd, /Existing/);
      assert.doesNotMatch(tasksMd, /\bX\b/);
    },
  );
});
