import test from 'node:test';
import assert from 'node:assert/strict';
import { notify } from '../src/notify.js';

function mockFetch() {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response('', { status: 200 });
  };
  fn.calls = calls;
  return fn;
}

test('no targets configured → no-op', async () => {
  const fetchImpl = mockFetch();
  const r = await notify({ config: {}, title: 't', body: 'b', fetchImpl });
  assert.equal(r.sent, 0);
  assert.equal(fetchImpl.calls.length, 0);
});

test('slack payload uses { text } shape', async () => {
  const fetchImpl = mockFetch();
  const r = await notify({
    config: { notify: { slack: 'https://hooks.slack/abc' } },
    title: 'Standup',
    body: 'all good',
    fetchImpl,
  });
  assert.equal(r.sent, 1);
  assert.equal(fetchImpl.calls[0].url, 'https://hooks.slack/abc');
  assert.match(fetchImpl.calls[0].body.text, /Standup/);
});

test('teams payload uses MessageCard shape', async () => {
  const fetchImpl = mockFetch();
  await notify({
    config: { notify: { teams: 'https://teams.webhook/x' } },
    title: 'Standup', body: 'b', fetchImpl,
  });
  const payload = fetchImpl.calls[0].body;
  assert.equal(payload['@type'], 'MessageCard');
  assert.equal(payload.title, 'Standup');
});

test('generic payload includes source + ts', async () => {
  const fetchImpl = mockFetch();
  await notify({
    config: { notify: { generic: ['https://my.endpoint'] } },
    title: 't', body: 'b', fetchImpl,
  });
  assert.equal(fetchImpl.calls[0].body.source, 'openspecpm');
  assert.match(fetchImpl.calls[0].body.ts, /^\d{4}-/);
});

test('failures across targets are collected without throwing', async () => {
  const fetchImpl = async () => { throw new Error('nope'); };
  const r = await notify({
    config: { notify: { slack: 'a', teams: 'b' } },
    title: 't', body: 'b', fetchImpl,
  });
  assert.equal(r.sent, 0);
  assert.equal(r.errors.length, 2);
});

test('non-2xx response counts as error, not sent', async () => {
  // Slack returns 403 for a revoked webhook. Previously this would have
  // been counted as a successful send.
  const fetchImpl = async () => new Response('invalid_token', { status: 403, statusText: 'Forbidden' });
  const r = await notify({
    config: { notify: { slack: 'https://hooks.slack.com/services/abc' } },
    title: 't', body: 'b', fetchImpl,
  });
  assert.equal(r.sent, 0);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].target, 'slack');
  assert.match(r.errors[0].error, /HTTP 403/);
  assert.match(r.errors[0].error, /invalid_token/);
});
