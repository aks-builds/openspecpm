import test from 'node:test';
import assert from 'node:assert/strict';
import { JiraAdapter } from '../src/adapters/jira.js';

function mockFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    for (const [matcher, response] of routes) {
      const match = typeof matcher === 'function' ? matcher(url, init) : matcher.test(url);
      if (match) {
        const r = typeof response === 'function' ? response(url, init) : response;
        return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), {
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

const baseConfig = { baseUrl: 'https://acme.atlassian.net', projectKey: 'PROJ' };

function withCreds(fn) {
  return async () => {
    const prevE = process.env.JIRA_EMAIL;
    const prevT = process.env.JIRA_API_TOKEN;
    process.env.JIRA_EMAIL = 'me@acme.test';
    process.env.JIRA_API_TOKEN = 'tok';
    try {
      await fn();
    } finally {
      if (prevE === undefined) delete process.env.JIRA_EMAIL; else process.env.JIRA_EMAIL = prevE;
      if (prevT === undefined) delete process.env.JIRA_API_TOKEN; else process.env.JIRA_API_TOKEN = prevT;
    }
  };
}

test('capabilities reports depth 3', () => {
  const a = new JiraAdapter(baseConfig);
  assert.equal(a.capabilities().hierarchyDepth, 3);
});

test('doctor flags missing creds', async () => {
  const prevE = process.env.JIRA_EMAIL;
  const prevT = process.env.JIRA_API_TOKEN;
  delete process.env.JIRA_EMAIL;
  delete process.env.JIRA_API_TOKEN;
  try {
    const a = new JiraAdapter(baseConfig);
    const findings = await a.doctor();
    assert.equal(findings[0].ok, false);
    assert.match(findings[0].msg, /JIRA_EMAIL/);
  } finally {
    if (prevE !== undefined) process.env.JIRA_EMAIL = prevE;
    if (prevT !== undefined) process.env.JIRA_API_TOKEN = prevT;
  }
});

test('doctor reports identity on success', withCreds(async () => {
  const fetchImpl = mockFetch([[/\/myself/, { body: { emailAddress: 'me@acme.test', displayName: 'Me' } }]]);
  const a = new JiraAdapter(baseConfig, { fetch: fetchImpl });
  const findings = await a.doctor();
  assert.equal(findings[0].ok, true);
  assert.match(findings[0].msg, /me@acme.test/);
}));

test('createEpic POSTs ADF description and returns key', withCreds(async () => {
  const fetchImpl = mockFetch([
    [/\/rest\/api\/3\/issue$/, (url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.fields.project.key, 'PROJ');
      assert.equal(body.fields.issuetype.name, 'Epic');
      assert.equal(body.fields.description.type, 'doc');
      return { body: { id: '10001', key: 'PROJ-1', self: 'x' } };
    }],
  ]);
  const a = new JiraAdapter(baseConfig, { fetch: fetchImpl });
  const ref = await a.createEpic({ name: 'dark-mode', summary: 's' });
  assert.equal(ref.id, 'PROJ-1');
  assert.equal(ref.url, 'https://acme.atlassian.net/browse/PROJ-1');
}));

test('createWorkItem creates Story by default and best-effort links', withCreds(async () => {
  let createCalled = false;
  let linkCalled = false;
  const fetchImpl = mockFetch([
    [/\/rest\/api\/3\/issue$/, (url, init) => {
      createCalled = true;
      const body = JSON.parse(init.body);
      assert.equal(body.fields.issuetype.name, 'Story');
      return { body: { key: 'PROJ-2' } };
    }],
    [/\/issueLink/, (url, init) => {
      linkCalled = true;
      const body = JSON.parse(init.body);
      assert.equal(body.outwardIssue.key, 'PROJ-1');
      assert.equal(body.inwardIssue.key, 'PROJ-2');
      return { body: {} };
    }],
  ]);
  const a = new JiraAdapter(baseConfig, { fetch: fetchImpl });
  const ref = await a.createWorkItem({ id: 'PROJ-1', feature: 'dark-mode' }, { title: 'Add toggle' });
  assert.equal(ref.id, 'PROJ-2');
  assert.equal(createCalled, true);
  assert.equal(linkCalled, true);
}));

test('closeWorkItem looks up Done transition then posts it', withCreds(async () => {
  let transitionPosted = false;
  const fetchImpl = mockFetch([
    [(url, init) => /\/transitions$/.test(url) && (init.method ?? 'GET') === 'GET',
      { body: { transitions: [{ id: '5', name: 'Pending' }, { id: '7', name: 'Done' }] } }],
    [(url, init) => /\/transitions$/.test(url) && init.method === 'POST', (url, init) => {
      transitionPosted = true;
      const body = JSON.parse(init.body);
      assert.equal(body.transition.id, '7');
      return { body: {} };
    }],
  ]);
  const a = new JiraAdapter(baseConfig, { fetch: fetchImpl });
  await a.closeWorkItem({ id: 'PROJ-3' });
  assert.equal(transitionPosted, true);
}));

test('getWorkItem normalizes status from name', withCreds(async () => {
  const fetchImpl = mockFetch([
    [/\/issue\/PROJ-9/, {
      body: { key: 'PROJ-9', fields: { summary: 'X', status: { name: 'In Progress' }, labels: ['a'], assignee: { emailAddress: 'a@b' } } },
    }],
  ]);
  const a = new JiraAdapter(baseConfig, { fetch: fetchImpl });
  const view = await a.getWorkItem({ id: 'PROJ-9' });
  assert.equal(view.status, 'in_progress');
  assert.equal(view.assignee, 'a@b');
  assert.deepEqual(view.labels, ['a']);
}));

test('listWorkItems posts JQL search', withCreds(async () => {
  let postedJql;
  const fetchImpl = mockFetch([
    [/\/search\/jql/, (url, init) => {
      postedJql = JSON.parse(init.body).jql;
      return {
        body: {
          issues: [
            { key: 'PROJ-1', fields: { summary: 'A', status: { name: 'Done' }, labels: [], assignee: null } },
            { key: 'PROJ-2', fields: { summary: 'B', status: { name: 'To Do' }, labels: [], assignee: null } },
          ],
        },
      };
    }],
  ]);
  const a = new JiraAdapter(baseConfig, { fetch: fetchImpl });
  const items = await a.listWorkItems();
  assert.match(postedJql, /labels = "openspec"/);
  assert.equal(items.length, 2);
  assert.equal(items[0].status, 'closed');
  assert.equal(items[1].status, 'open');
}));
