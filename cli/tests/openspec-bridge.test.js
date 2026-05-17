import test from 'node:test';
import assert from 'node:assert/strict';
import { probe, OpenSpecError, OPENSPEC_MIN_VERSION } from '../src/openspec-bridge.js';

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
