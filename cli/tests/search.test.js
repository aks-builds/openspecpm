import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSearch } from '../src/commands/search.js';

async function withProject(setup, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'openspecpm-search-'));
  const origCwd = process.cwd();
  try { await setup(dir); process.chdir(dir); await fn(dir); }
  finally { process.chdir(origCwd); await rm(dir, { recursive: true, force: true }); }
}

function captureStdout(fn) {
  const orig = process.stdout.write.bind(process.stdout);
  const chunks = [];
  process.stdout.write = (s) => { chunks.push(String(s)); return true; };
  return Promise.resolve(fn())
    .then(() => chunks.join(''))
    .finally(() => { process.stdout.write = orig; });
}

test('search finds matches across changes and specs', async () => {
  await withProject(
    async (root) => {
      const d1 = join(root, 'openspec', 'changes', 'alpha');
      const d2 = join(root, 'openspec', 'changes', 'beta', 'specs');
      await mkdir(d1, { recursive: true });
      await mkdir(d2, { recursive: true });
      await writeFile(join(d1, 'proposal.md'), '# Alpha\n\nthis mentions dark mode toggle\n', 'utf8');
      await writeFile(join(d2, 'theme.md'), 'Scenario: dark mode\n', 'utf8');
    },
    async () => {
      const out = await captureStdout(() => runSearch({ query: 'dark mode' }));
      assert.match(out, /alpha[\\/]proposal\.md/);
      assert.match(out, /beta[\\/]specs[\\/]theme\.md/);
    },
  );
});

test('search reports zero matches cleanly', async () => {
  await withProject(
    async (root) => {
      const d = join(root, 'openspec', 'changes', 'alpha');
      await mkdir(d, { recursive: true });
      await writeFile(join(d, 'proposal.md'), '# Alpha\n', 'utf8');
    },
    async () => {
      const out = await captureStdout(() => runSearch({ query: 'nonexistent' }));
      assert.match(out, /No matches/);
    },
  );
});
