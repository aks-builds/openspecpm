import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeReadFile } from '../src/io.js';

async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'openspecpm-io-'));
  try { await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('safeReadFile returns content for existing file', async () => {
  await withTmp(async (dir) => {
    const p = join(dir, 'hello.txt');
    await writeFile(p, 'hi there', 'utf8');
    assert.equal(await safeReadFile(p), 'hi there');
  });
});

test('safeReadFile returns null for missing file (ENOENT swallowed)', async () => {
  await withTmp(async (dir) => {
    assert.equal(await safeReadFile(join(dir, 'nope.txt')), null);
  });
});

test('safeReadFile propagates non-ENOENT errors (e.g. EISDIR on a directory)', async () => {
  await withTmp(async (dir) => {
    // Reading a directory as a file throws EISDIR on Linux/Mac.
    // On Windows it returns the directory bytes — either way safeReadFile
    // must NOT silently return null, since the file in question DID exist.
    let threw = false;
    try {
      const result = await safeReadFile(dir);
      // Windows: the read succeeds; that's fine — we just confirm it's not null
      // (which would imply ENOENT swallowing). Result might be empty string or
      // garbage bytes — either way it's distinguishable from "no such file".
      assert.notEqual(result, null);
    } catch (err) {
      threw = true;
      // Linux/Mac: must be the OS error, not silently masked.
      assert.match(err.code ?? '', /EISDIR|EACCES|EPERM/);
    }
    // One of the two branches must hold; assertion is in the catch / else above.
    void threw;
  });
});
