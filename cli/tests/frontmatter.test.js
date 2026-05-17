import test from 'node:test';
import assert from 'node:assert/strict';
import * as fm from '../src/frontmatter.js';

test('parse extracts data and body', () => {
  const src = `---\nname: foo\nstatus: open\n---\n\n# Body\n`;
  const { data, body } = fm.parse(src);
  assert.equal(data.name, 'foo');
  assert.equal(data.status, 'open');
  assert.match(body, /# Body/);
});

test('parse returns empty data when no fence', () => {
  const { data, body } = fm.parse('plain markdown\n');
  assert.deepEqual(data, {});
  assert.equal(body, 'plain markdown\n');
});

test('serialize round-trips data and body', () => {
  const out = fm.serialize({ name: 'x', n: 2 }, '\n# Body\n');
  const { data, body } = fm.parse(out);
  assert.equal(data.name, 'x');
  assert.equal(data.n, 2);
  assert.match(body, /# Body/);
});

test('patch merges keys', () => {
  const src = `---\nname: foo\n---\nbody\n`;
  const patched = fm.patch(src, { status: 'closed' });
  const { data } = fm.parse(patched);
  assert.equal(data.name, 'foo');
  assert.equal(data.status, 'closed');
});
