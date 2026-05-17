import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubAdapter } from '../src/adapters/github.js';

function recordingRunner() {
  const calls = [];
  const handlers = new Map();
  const runner = async (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    const key = `${cmd} ${args.join(' ')}`;
    if (handlers.has(key)) return handlers.get(key);
    return { stdout: '', stderr: '' };
  };
  runner.calls = calls;
  runner.respond = (key, value) => handlers.set(key, value);
  return runner;
}

test('capabilities surfaces hierarchy depth 2', () => {
  const a = new GitHubAdapter({ repo: 'aks-builds/openspecpm' });
  const c = a.capabilities();
  assert.equal(c.hierarchyDepth, 2);
  assert.equal(c.supportsSubIssues, true);
});

test('createEpic shells out to gh and parses url', async () => {
  const runner = recordingRunner();
  runner.respond(
    'gh issue create --repo aks-builds/openspecpm --title Epic: dark-mode --body theme switching --label openspec-epic,openspec:dark-mode',
    { stdout: 'https://github.com/aks-builds/openspecpm/issues/42\n', stderr: '' },
  );
  const a = new GitHubAdapter({ repo: 'aks-builds/openspecpm' }, { runner });
  const ref = await a.createEpic({ name: 'dark-mode', summary: 'theme switching' });
  assert.equal(ref.adapter, 'github');
  assert.equal(ref.id, '42');
  assert.match(ref.url, /issues\/42$/);
});

test('createWorkItem rejects when repo missing', async () => {
  const runner = recordingRunner();
  const a = new GitHubAdapter({}, { runner });
  await assert.rejects(a.createEpic({ name: 'x' }), /requires config\.repo/);
});

test('doctor reports missing gh CLI', async () => {
  const runner = async () => {
    throw new Error('ENOENT');
  };
  const a = new GitHubAdapter({ repo: 'aks-builds/openspecpm' }, { runner });
  const findings = await a.doctor();
  assert.equal(findings[0].ok, false);
  assert.match(findings[0].msg, /not installed/);
});
