import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { record, tail, audited } from '../src/audit.js';

async function withTmp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'openspecpm-audit-'));
  try { await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('record writes JSONL entry with timestamp', async () => {
  await withTmp(async (dir) => {
    await record({ command: 'sync', args: { feature: 'x' }, result: 'ok', cwd: dir });
    const raw = await readFile(join(dir, '.openspecpm', 'audit.log'), 'utf8');
    const lines = raw.trim().split('\n');
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.command, 'sync');
    assert.equal(entry.args.feature, 'x');
    assert.match(entry.ts, /^\d{4}-\d{2}-\d{2}T/);
  });
});

test('record scrubs token-like keys', async () => {
  await withTmp(async (dir) => {
    await record({
      command: 'sync',
      args: { feature: 'x', api_token: 'secret123', JIRA_PASSWORD: 'p', repo: 'a/b' },
      cwd: dir,
    });
    const [entry] = await tail(1, dir);
    assert.equal(entry.args.api_token, '<redacted>');
    assert.equal(entry.args.JIRA_PASSWORD, '<redacted>');
    assert.equal(entry.args.repo, 'a/b');
  });
});

test('scrubber redacts webhook URLs from string values (M11)', async () => {
  await withTmp(async (dir) => {
    await record({
      command: 'standup',
      args: { since: '24h' },
      // Result string accidentally contains a Slack webhook URL — must redact.
      result: 'fetch failed: https://hooks.slack.com/services/T0/B0/abc123secret then continued',
      cwd: dir,
    });
    const [entry] = await tail(1, dir);
    assert.ok(!entry.result.includes('hooks.slack.com'), `webhook URL leaked: ${entry.result}`);
    assert.match(entry.result, /<redacted-webhook>/);
    assert.match(entry.result, /then continued/);
  });
});

test('scrubber catches extended segment keys (M6/LOW-4)', async () => {
  await withTmp(async (dir) => {
    await record({
      command: 'x',
      args: {
        cookie: 'sid=abc',
        session_id: 'xyz',
        bearer_token: 't',
        webhook_url: 'https://anything',
        hmac_signature: 's',
        saml_assertion: 'a',
        plain: 'keep me',
      },
      cwd: dir,
    });
    const [entry] = await tail(1, dir);
    for (const k of ['cookie', 'session_id', 'bearer_token', 'webhook_url', 'hmac_signature', 'saml_assertion']) {
      assert.equal(entry.args[k], '<redacted>', `${k} should be redacted`);
    }
    assert.equal(entry.args.plain, 'keep me');
  });
});

test('record persists meta when provided', async () => {
  await withTmp(async (dir) => {
    await record({
      command: 'judge',
      args: { feature: 'dark-mode' },
      meta: { model: 'claude-haiku-4-5', input_tokens: 1234, cache_read_input_tokens: 800 },
      cwd: dir,
    });
    const [entry] = await tail(1, dir);
    assert.equal(entry.command, 'judge');
    assert.equal(entry.meta.model, 'claude-haiku-4-5');
    assert.equal(entry.meta.input_tokens, 1234);
    assert.equal(entry.meta.cache_read_input_tokens, 800);
  });
});

test('audited wrapper records success and failure', async () => {
  await withTmp(async (dir) => {
    const origCwd = process.cwd();
    process.chdir(dir);
    try {
      const ok = audited('hello', async () => 'done');
      const result = await ok({ a: 1 });
      assert.equal(result, 'done');
      const bad = audited('boom', async () => { throw new Error('nope'); });
      await assert.rejects(bad({}));
      const log = await tail(10, dir);
      const cmds = log.map((e) => e.command);
      assert.deepEqual(cmds, ['hello', 'boom']);
      assert.equal(log[1].error, 'nope');
    } finally {
      process.chdir(origCwd);
    }
  });
});
