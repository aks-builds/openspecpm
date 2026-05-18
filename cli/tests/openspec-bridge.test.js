import test from 'node:test';
import assert from 'node:assert/strict';
import { probe, OpenSpecError, OPENSPEC_MIN_VERSION, assertSafeFeatureName, changeDir, changeExists } from '../src/openspec-bridge.js';

function fakeRunner(map) {
  return async (cmd, args) => {
    const key = `${cmd} ${args.join(' ')}`;
    if (map[key] instanceof Error) throw map[key];
    if (map[key]) return { stdout: map[key], stderr: '' };
    throw new Error(`unexpected: ${key}`);
  };
}

test('probe accepts version >= min', async () => {
  const runner = fakeRunner({ 'openspec --version': '99.0.0' });
  const { version } = await probe({ runner });
  assert.equal(version, '99.0.0');
});

test('probe rejects version below min', async () => {
  const runner = fakeRunner({ 'openspec --version': '0.0.1' });
  await assert.rejects(probe({ runner }), (err) => {
    assert.ok(err instanceof OpenSpecError);
    assert.match(err.message, new RegExp(OPENSPEC_MIN_VERSION));
    return true;
  });
});

test('probe surfaces install hint when missing', async () => {
  const runner = fakeRunner({ 'openspec --version': new Error('ENOENT') });
  await assert.rejects(probe({ runner }), (err) => {
    assert.match(err.remediation ?? '', /openspec/);
    return true;
  });
});

test('assertSafeFeatureName accepts safe slugs', () => {
  for (const ok of ['dark-mode', 'auth_rate.limit', 'feat1', 'X', 'a-b-c-d']) {
    assertSafeFeatureName(ok); // does not throw
  }
});

test('assertSafeFeatureName rejects path-traversal and separators', () => {
  const bad = [
    '../etc',
    '..',
    '.',
    'a/b',
    'a\\b',
    'C:\\Windows',
    'c:relative',
    '/abs',
    '.hidden',     // leading dot is disallowed (first char must be alnum)
    '-leading',    // leading dash disallowed
    '',
    'has space',
    'em‮dash',
    'with;semicolon',
  ];
  for (const f of bad) {
    assert.throws(() => assertSafeFeatureName(f), (err) => {
      assert.match(err.message, /(required|Invalid)/);
      assert.ok(err.remediation, 'every rejection must carry remediation');
      return true;
    }, `expected rejection for ${JSON.stringify(f)}`);
  }
});

test('changeDir + changeExists also reject traversal input (defense in depth)', () => {
  assert.throws(() => changeDir('../escape'), /Invalid feature name/);
  assert.throws(() => changeExists('../escape'), /Invalid feature name/);
});
