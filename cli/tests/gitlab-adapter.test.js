import test from 'node:test';
import assert from 'node:assert/strict';
import { GitLabAdapter } from '../src/adapters/gitlab.js';

function mockFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    for (const [matcher, response] of routes) {
      const match = typeof matcher === 'function' ? matcher(url, init) : matcher.test(url);
      if (match) {
        const r = typeof response === 'function' ? response(url, init) : response;
        return new Response(JSON.stringify(r.body ?? r), {
          status: r.status ?? 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    throw new Error(`mockFetch: no route for ${init.method ?? 'GET'} ${url}`);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const baseConfig = { projectId: '123' };

function withToken(fn) {
  return async () => {
    const prev = process.env.GITLAB_TOKEN;
    process.env.GITLAB_TOKEN = 'glpat-fake';
    try { await fn(); } finally {
      if (prev === undefined) delete process.env.GITLAB_TOKEN; else process.env.GITLAB_TOKEN = prev;
    }
  };
}

test('capabilities reports milestones as sprints', () => {
  const a = new GitLabAdapter(baseConfig);
  const c = a.capabilities();
  assert.equal(c.supportsSprints, true);
  assert.equal(c.fieldMap.sprint, 'Milestone');
});

test('doctor flags missing GITLAB_TOKEN', async () => {
  const prev = process.env.GITLAB_TOKEN;
  delete process.env.GITLAB_TOKEN;
  try {
    const a = new GitLabAdapter(baseConfig);
    const findings = await a.doctor();
    assert.equal(findings[0].ok, false);
    assert.match(findings[0].msg, /GITLAB_TOKEN/);
  } finally {
    if (prev !== undefined) process.env.GITLAB_TOKEN = prev;
  }
});

test('doctor reports username on success', withToken(async () => {
  const fetchImpl = mockFetch([[/\/user$/, { body: { username: 'aks' } }]]);
  const a = new GitLabAdapter(baseConfig, { fetch: fetchImpl });
  const findings = await a.doctor();
  assert.equal(findings[0].ok, true);
  assert.match(findings[0].msg, /aks/);
}));

test('createEpic creates a labeled issue and returns iid', withToken(async () => {
  const fetchImpl = mockFetch([
    [/\/issues$/, { body: { iid: 7, web_url: 'https://gitlab.com/x/-/issues/7' } }],
  ]);
  const a = new GitLabAdapter(baseConfig, { fetch: fetchImpl });
  const ref = await a.createEpic({ name: 'demo', summary: 's' });
  assert.equal(ref.id, '7');
  assert.equal(ref.adapter, 'gitlab');
}));

test('closeWorkItem PUTs state_event=close', withToken(async () => {
  let captured;
  const fetchImpl = mockFetch([
    [(url, init) => init.method === 'PUT' && /\/issues\/3$/.test(url), (url, init) => {
      captured = JSON.parse(init.body);
      return { body: { iid: 3 } };
    }],
  ]);
  const a = new GitLabAdapter(baseConfig, { fetch: fetchImpl });
  await a.closeWorkItem({ id: '3' });
  assert.equal(captured.state_event, 'close');
}));

test('getWorkItem normalizes state', withToken(async () => {
  const fetchImpl = mockFetch([
    [/\/issues\/9$/, { body: { iid: 9, title: 'X', state: 'closed', web_url: 'u', labels: ['l'], assignee: { username: 'a' } } }],
  ]);
  const a = new GitLabAdapter(baseConfig, { fetch: fetchImpl });
  const v = await a.getWorkItem({ id: '9' });
  assert.equal(v.status, 'closed');
  assert.equal(v.assignee, 'a');
}));

test('linkWorkItems POSTs to /links with link_type', withToken(async () => {
  let body;
  const fetchImpl = mockFetch([
    [/\/issues\/2\/links$/, (url, init) => { body = JSON.parse(init.body); return { body: {} }; }],
  ]);
  const a = new GitLabAdapter(baseConfig, { fetch: fetchImpl });
  await a.linkWorkItems({ id: '1' }, { id: '2' }, 'blocks');
  assert.equal(body.link_type, 'blocks');
  assert.equal(body.target_issue_iid, '1');
}));
