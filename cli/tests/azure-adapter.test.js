import test from 'node:test';
import assert from 'node:assert/strict';
import { AzureAdapter } from '../src/adapters/azure.js';

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

const baseConfig = { organization: 'contoso', project: 'MyProject', baseUrl: 'https://dev.azure.com/contoso' };

function withPat(fn) {
  return async () => {
    const prev = process.env.AZURE_DEVOPS_EXT_PAT;
    process.env.AZURE_DEVOPS_EXT_PAT = 'fake-pat';
    try {
      await fn();
    } finally {
      if (prev === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT;
      else process.env.AZURE_DEVOPS_EXT_PAT = prev;
    }
  };
}

test('capabilities reports depth 4 with sprint support', () => {
  const a = new AzureAdapter(baseConfig);
  const c = a.capabilities();
  assert.equal(c.hierarchyDepth, 4);
  assert.equal(c.supportsSprints, true);
});

test('doctor flags missing PAT', async () => {
  const prev = process.env.AZURE_DEVOPS_EXT_PAT;
  delete process.env.AZURE_DEVOPS_EXT_PAT;
  try {
    const a = new AzureAdapter(baseConfig);
    const findings = await a.doctor();
    assert.equal(findings[0].ok, false);
    assert.match(findings[0].msg, /AZURE_DEVOPS_EXT_PAT/);
  } finally {
    if (prev !== undefined) process.env.AZURE_DEVOPS_EXT_PAT = prev;
  }
});

test('doctor returns ok when connectionData succeeds', withPat(async () => {
  const fetchImpl = mockFetch([[/connectionData/, { body: { authenticatedUser: { providerDisplayName: 'aks' } } }]]);
  const a = new AzureAdapter(baseConfig, { fetch: fetchImpl });
  const findings = await a.doctor();
  assert.equal(findings[0].ok, true);
}));

test('createEpic POSTs JSON-Patch and returns ref', withPat(async () => {
  const fetchImpl = mockFetch([
    [/workitems\/\$Epic/, (url, init) => {
      const body = JSON.parse(init.body);
      assert.ok(Array.isArray(body), 'JSON-Patch body must be array');
      assert.equal(init.headers['Content-Type'], 'application/json-patch+json');
      const title = body.find((op) => op.path === '/fields/System.Title');
      assert.equal(title.value, 'dark-mode');
      return { body: { id: 100, _links: { html: { href: 'https://dev.azure.com/contoso/MyProject/_workitems/edit/100' } } } };
    }],
  ]);
  const a = new AzureAdapter(baseConfig, { fetch: fetchImpl });
  const ref = await a.createEpic({ name: 'dark-mode', summary: 'theme switching' });
  assert.equal(ref.id, '100');
  assert.equal(ref.adapter, 'azure');
}));

test('createWorkItem links to parent via PATCH', withPat(async () => {
  let patchCalled = false;
  const fetchImpl = mockFetch([
    [/workitems\/\$Task/, { body: { id: 200, _links: { html: { href: 'x' } } } }],
    [/workitems\/200/, (url, init) => {
      patchCalled = true;
      assert.equal(init.method, 'PATCH');
      const ops = JSON.parse(init.body);
      assert.match(ops[0].value.url, /workItems\/100$/);
      return { body: { id: 200 } };
    }],
  ]);
  const a = new AzureAdapter(baseConfig, { fetch: fetchImpl });
  const ref = await a.createWorkItem({ id: '100', feature: 'dark-mode' }, { title: 'Add toggle' });
  assert.equal(ref.id, '200');
  assert.equal(patchCalled, true);
}));

test('closeWorkItem patches state to Closed', withPat(async () => {
  let patchOps;
  const fetchImpl = mockFetch([
    [/workitems\/300/, (url, init) => {
      patchOps = JSON.parse(init.body);
      return { body: { id: 300 } };
    }],
  ]);
  const a = new AzureAdapter(baseConfig, { fetch: fetchImpl });
  await a.closeWorkItem({ id: '300' });
  assert.equal(patchOps.find((o) => o.path === '/fields/System.State').value, 'Closed');
}));

test('getWorkItem normalizes status', withPat(async () => {
  const fetchImpl = mockFetch([
    [/workitems\/400/, {
      body: {
        id: 400,
        fields: { 'System.Title': 'X', 'System.State': 'Closed', 'System.Tags': 'openspec; foo' },
        _links: { html: { href: 'h' } },
      },
    }],
  ]);
  const a = new AzureAdapter(baseConfig, { fetch: fetchImpl });
  const view = await a.getWorkItem({ id: '400' });
  assert.equal(view.status, 'closed');
  assert.deepEqual(view.labels, ['openspec', 'foo']);
}));

test('listWorkItems queries WIQL then fetches batch', withPat(async () => {
  const fetchImpl = mockFetch([
    [/\/wiql/, { body: { workItems: [{ id: 1 }, { id: 2 }] } }],
    [/\/workitems\?/, {
      body: {
        value: [
          { id: 1, fields: { 'System.Title': 'A', 'System.State': 'New', 'System.Tags': 'openspec' }, _links: { html: { href: 'a' } } },
          { id: 2, fields: { 'System.Title': 'B', 'System.State': 'Active', 'System.Tags': 'openspec' }, _links: { html: { href: 'b' } } },
        ],
      },
    }],
  ]);
  const a = new AzureAdapter(baseConfig, { fetch: fetchImpl });
  const items = await a.listWorkItems();
  assert.equal(items.length, 2);
  assert.equal(items[0].status, 'open');
  assert.equal(items[1].status, 'in_progress');
}));
