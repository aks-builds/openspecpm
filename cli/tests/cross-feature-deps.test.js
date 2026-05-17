import test from 'node:test';
import assert from 'node:assert/strict';
import { findNextTasks, findBlockedTasks, unmetDeps } from '../src/tracking.js';

function change(name, items) {
  return { name, dir: `/${name}`, proposal: {}, items, mtime: new Date(0) };
}

test('cross-feature dep that is open is reported blocked', () => {
  const a = change('alpha', [{ title: 'Build base', sync_state: 'pending' }]);
  const b = change('beta', [{ title: 'Add UI', sync_state: 'pending', depends_on: ['alpha/Build base'] }]);
  const blocked = findBlockedTasks([a, b]);
  const target = blocked.find((x) => x.task.title === 'Add UI');
  assert.ok(target);
  assert.equal(target.unmet[0].reason, 'dep-open');
});

test('cross-feature dep that is done unblocks dependent', () => {
  const a = change('alpha', [{ title: 'Build base', sync_state: 'created', done: true }]);
  const b = change('beta', [{ title: 'Add UI', sync_state: 'pending', depends_on: ['alpha/Build base'] }]);
  const next = findNextTasks([a, b]);
  const target = next.find((x) => x.task.title === 'Add UI');
  assert.ok(target, 'Add UI should be next-ready when alpha/Build base is done');
});

test('cross-feature dep that points to a missing feature is not-found', () => {
  const b = change('beta', [{ title: 'Add UI', sync_state: 'pending', depends_on: ['ghost/something'] }]);
  const blocked = findBlockedTasks([b]);
  assert.equal(blocked[0].unmet[0].reason, 'not-found');
});

test('legacy same-change deps still work', () => {
  const a = change('alpha', [
    { title: 'A', sync_state: 'pending' },
    { title: 'B', sync_state: 'pending', depends_on: ['A'] },
  ]);
  const blocked = findBlockedTasks([a]);
  const target = blocked.find((x) => x.task.title === 'B');
  assert.ok(target);
  assert.equal(target.unmet[0].reason, 'dep-open');
});

test('unmetDeps with options.change + options.allChanges supports cross-feature', () => {
  const a = change('alpha', [{ title: 'X', sync_state: 'pending' }]);
  const b = change('beta', [{ title: 'Y', sync_state: 'pending', depends_on: ['alpha/X'] }]);
  const unmet = unmetDeps(b.items[0], b.items, { change: b, allChanges: [a, b] });
  assert.equal(unmet.length, 1);
  assert.equal(unmet[0].reason, 'dep-open');
});
