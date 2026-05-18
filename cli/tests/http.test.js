import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpClient, basicAuth } from '../src/http.js';

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

test('basicAuth produces RFC 7617 header', () => {
  assert.equal(basicAuth('user', 'pw'), 'Basic ' + Buffer.from('user:pw').toString('base64'));
});

test('request sends auth header and parses JSON', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return jsonResponse({ ok: true, url });
  };
  const c = new HttpClient({ baseUrl: 'https://example.test', auth: basicAuth('a', 'b'), fetch: fetchImpl });
  const out = await c.request('GET', '/v1/things', { query: { x: 1 } });
  assert.deepEqual(out, { ok: true, url: 'https://example.test/v1/things?x=1' });
  assert.match(seen[0].init.headers.Authorization, /^Basic /);
});

test('non-2xx response throws AdapterError with remediation', async () => {
  const fetchImpl = async () => jsonResponse({ message: 'forbidden' }, { status: 403 });
  const c = new HttpClient({ baseUrl: 'https://example.test', fetch: fetchImpl, remediationHint: 'check PAT scopes' });
  await assert.rejects(c.request('GET', '/v1/x'), (err) => {
    assert.match(err.message, /403/);
    assert.equal(err.remediation, 'check PAT scopes');
    return true;
  });
});

test('network error is wrapped', async () => {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  const c = new HttpClient({ baseUrl: 'https://example.test', fetch: fetchImpl });
  await assert.rejects(c.request('GET', '/v1/x'), /Network error/);
});

test('request rejects with TimeoutError when fetch hangs past timeoutMs', async () => {
  // fetch that never resolves on its own, but rejects when the abort signal fires.
  const fetchImpl = (url, init) => new Promise((_, reject) => {
    init.signal?.addEventListener('abort', () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      reject(e);
    });
  });
  const c = new HttpClient({ baseUrl: 'https://example.test', fetch: fetchImpl, timeoutMs: 50 });
  const t0 = Date.now();
  await assert.rejects(c.request('GET', '/v1/slow'), (err) => {
    assert.match(err.message, /timed out after 50ms/);
    assert.match(err.remediation, /timeoutMs/);
    return true;
  });
  assert.ok(Date.now() - t0 < 500, 'rejection should happen within ~timeoutMs, not wall-clock max');
});

test('body JSON-serializes when object', async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = init;
    return jsonResponse({});
  };
  const c = new HttpClient({ baseUrl: 'https://example.test', fetch: fetchImpl });
  await c.request('POST', '/v1/x', { body: { foo: 1 } });
  assert.equal(captured.body, JSON.stringify({ foo: 1 }));
  assert.equal(captured.headers['Content-Type'], 'application/json');
});
