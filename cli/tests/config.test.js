import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig, writeConfig, SCHEMA_VERSION } from '../src/config.js';

async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'openspecpm-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('readConfig returns null when missing', async () => {
  await withTmp(async (dir) => {
    assert.equal(await readConfig(dir), null);
  });
});

test('write then read round-trips with schema_version', async () => {
  await withTmp(async (dir) => {
    await writeConfig({ adapter: 'github', repo: 'aks-builds/openspecpm' }, dir);
    const read = await readConfig(dir);
    assert.equal(read.adapter, 'github');
    assert.equal(read.repo, 'aks-builds/openspecpm');
    assert.equal(read.schema_version, SCHEMA_VERSION);
  });
});
