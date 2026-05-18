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
  // AbortSignal.timeout in Node 20+ uses an unref'd internal timer — meaning it
  // does NOT keep the event loop alive. In production this is fine because
  // fetch's socket is ref'd. In this test the mock fetch has nothing ref'd, so
  // we install a small ref'd backup timer to keep the loop alive past the 50ms
  // timeout. The backup is cleared when the abort listener fires (the normal
  // path) and only rejects on its own if the abort never arrives (1s safety).
  const fetchImpl = (url, init) => new Promise((_, reject) => {
    const backup = setTimeout(() => reject(new Error('backup timer: abort never fired')), 1000);
    const sig = init.signal;
    if (sig?.aborted) {
      clearTimeout(backup);
      const e = new Error('aborted');
      e.name = 'AbortError';
      reject(e);
      return;
    }
    sig?.addEventListener('abort', () => {
      clearTimeout(backup);
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
