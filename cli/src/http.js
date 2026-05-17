import { AdapterError } from './adapters/base.js';

export class HttpClient {
  #baseUrl;
  #authHeader;
  #fetchImpl;
  #defaultHeaders;
  #remediationHint;

  constructor({ baseUrl, auth, fetch: fetchImpl = globalThis.fetch, defaultHeaders = {}, remediationHint } = {}) {
    if (!baseUrl) throw new Error('HttpClient requires baseUrl');
    if (typeof fetchImpl !== 'function') throw new Error('global fetch not available; pass {fetch} explicitly');
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#authHeader = auth ?? null;
    this.#fetchImpl = fetchImpl;
    this.#defaultHeaders = defaultHeaders;
    this.#remediationHint = remediationHint;
  }

  async request(method, path, { query, body, headers, contentType = 'application/json', accept = 'application/json' } = {}) {
    const url = this.#buildUrl(path, query);
    const finalHeaders = {
      Accept: accept,
      ...(this.#defaultHeaders ?? {}),
      ...(this.#authHeader ? { Authorization: this.#authHeader } : {}),
      ...(headers ?? {}),
    };
    let payload;
    if (body !== undefined && body !== null) {
      if (typeof body === 'string' || body instanceof ArrayBuffer || body instanceof Uint8Array) {
        payload = body;
      } else {
        payload = JSON.stringify(body);
      }
      finalHeaders['Content-Type'] = contentType;
    }

    let res;
    try {
      res = await this.#fetchImpl(url, { method, headers: finalHeaders, body: payload });
    } catch (err) {
      throw new AdapterError(`Network error calling ${method} ${url}: ${err.message}`, {
        remediation: this.#remediationHint ?? 'Check connectivity and base URL.',
        cause: err,
      });
    }

    const text = await res.text();
    let parsed;
    if (text && /^application\/json/i.test(res.headers.get('content-type') ?? '')) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    } else {
      parsed = text;
    }

    if (!res.ok) {
      const detail = typeof parsed === 'string' ? parsed.slice(0, 500) : JSON.stringify(parsed).slice(0, 500);
      throw new AdapterError(`${method} ${path} failed: ${res.status} ${res.statusText} — ${detail}`, {
        remediation: this.#statusRemediation(res.status),
      });
    }
    return parsed;
  }

  #buildUrl(path, query) {
    const base = path.startsWith('http') ? path : this.#baseUrl + (path.startsWith('/') ? path : '/' + path);
    if (!query) return base;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
  }

  #statusRemediation(status) {
    if (status === 401 || status === 403) return this.#remediationHint ?? 'Check authentication credentials and required scopes.';
    if (status === 404) return 'The resource does not exist or your account lacks visibility.';
    if (status === 429) return 'Rate-limited by the backend; retry after a backoff or lower request volume.';
    if (status >= 500) return 'Backend error; retry, then check the service status page.';
    return this.#remediationHint;
  }
}

export function basicAuth(user, password) {
  return 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
}
