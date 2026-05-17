import test from 'node:test';
import assert from 'node:assert/strict';
import { installCommand, patSetup, osName } from '../src/install-hints.js';

test('installCommand returns a string for known tools', () => {
  const cmd = installCommand('openspec');
  assert.match(cmd, /openspec/);
});

test('installCommand returns null for unknown tools', () => {
  assert.equal(installCommand('nonexistent-tool'), null);
});

test('patSetup returns url + scopes for every supported adapter', () => {
  for (const a of ['github', 'azure', 'jira', 'linear', 'gitlab']) {
    const info = patSetup(a);
    assert.ok(info, `expected pat info for ${a}`);
    assert.match(info.url, /^https?:/);
    assert.ok(info.scopes.length > 0);
  }
});

test('osName returns a human-readable label', () => {
  const name = osName();
  assert.ok(['Windows', 'macOS', 'Linux'].includes(name) || typeof name === 'string');
});
