import test from 'node:test';
import assert from 'node:assert/strict';
import { LinearAdapter } from '../src/adapters/linear.js';

function mockFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    let body;
    try { body = JSON.parse(init.body); } catch { body = {}; }
    for (const [matcher, response] of routes) {
      if (matcher(body)) {
        const r = typeof response === 'function' ? response(body) : response;
        return new Response(JSON.stringify(r.payload ?? { data: r.data }), {
          status: r.status ?? 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    throw new Error(`mockFetch: no route for query: ${body.query?.slice(0, 60)}`);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function withKey(fn) {
  return async () => {
    const prev = process.env.LINEAR_API_KEY;
    process.env.LINEAR_API_KEY = 'lin_api_key';
    try { await fn(); } finally {
      if (prev === undefined) delete process.env.LINEAR_API_KEY; else process.env.LINEAR_API_KEY = prev;
    }
  };
}

test('capabilities reports cycles + sub-issues', () => {
  const a = new LinearAdapter({ teamId: 't1' });
  const c = a.capabilities();
  assert.equal(c.supportsSprints, true);
  assert.equal(c.supportsSubIssues, true);
});

test('doctor flags missing api key', async () => {
  const prev = process.env.LINEAR_API_KEY;
  delete process.env.LINEAR_API_KEY;
  try {
    const a = new LinearAdapter({ teamId: 't1' });
    const findings = await a.doctor();
    assert.equal(findings[0].ok, false);
    assert.match(findings[0].msg, /LINEAR_API_KEY/);
  } finally {
    if (prev !== undefined) process.env.LINEAR_API_KEY = prev;
  }
});

test('doctor reports identity on success', withKey(async () => {
  const fetchImpl = mockFetch([
    [(b) => /viewer/.test(b.query), { data: { viewer: { id: 'u1', name: 'AKS' } } }],
  ]);
  const a = new LinearAdapter({ teamId: 't1' }, { fetch: fetchImpl });
  const findings = await a.doctor();
  assert.equal(findings[0].ok, true);
  assert.match(findings[0].msg, /AKS/);
}));

test('createEpic calls projectCreate', withKey(async () => {
  const fetchImpl = mockFetch([
    [(b) => /projectCreate/.test(b.query), {
      data: { projectCreate: { success: true, project: { id: 'p1', name: 'demo', url: 'https://lin/p1' } } },
    }],
  ]);
  const a = new LinearAdapter({ teamId: 't1' }, { fetch: fetchImpl });
  const ref = await a.createEpic({ name: 'demo', summary: 's' });
  assert.equal(ref.id, 'p1');
  assert.equal(ref.adapter, 'linear');
}));

test('createWorkItem calls issueCreate and returns identifier', withKey(async () => {
  const fetchImpl = mockFetch([
    [(b) => /issueCreate/.test(b.query), {
      data: { issueCreate: { success: true, issue: { id: 'i1', identifier: 'DEM-1', url: 'https://lin/DEM-1' } } },
    }],
  ]);
  const a = new LinearAdapter({ teamId: 't1' }, { fetch: fetchImpl });
  const ref = await a.createWorkItem({ id: 'p1', feature: 'demo' }, { title: 'Add toggle' });
  assert.equal(ref.id, 'DEM-1');
}));

test('closeWorkItem looks up completed state then updates', withKey(async () => {
  let updated = false;
  const fetchImpl = mockFetch([
    [(b) => /workflowStates/.test(b.query), {
      data: { workflowStates: { nodes: [{ id: 's1', name: 'Done', type: 'completed' }] } },
    }],
    [(b) => /issueUpdate/.test(b.query), (b) => {
      updated = true;
      assert.equal(b.variables.input.stateId, 's1');
      return { data: { issueUpdate: { success: true } } };
    }],
  ]);
  const a = new LinearAdapter({ teamId: 't1' }, { fetch: fetchImpl });
  await a.closeWorkItem({ id: 'DEM-1' });
  assert.equal(updated, true);
}));

test('getWorkItem normalizes state type', withKey(async () => {
  const fetchImpl = mockFetch([
    [(b) => /issue\(id/.test(b.query), {
      data: { issue: { id: 'i1', identifier: 'DEM-2', url: 'u', title: 't', state: { type: 'started' }, labels: { nodes: [{ name: 'l' }] }, assignee: { email: 'a@b' } } },
    }],
  ]);
  const a = new LinearAdapter({ teamId: 't1' }, { fetch: fetchImpl });
  const v = await a.getWorkItem({ id: 'DEM-2' });
  assert.equal(v.status, 'in_progress');
  assert.equal(v.assignee, 'a@b');
}));
