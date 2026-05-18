import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const DIR = '.openspecpm';
const FILE = 'audit.log';

export function auditPath(cwd = process.cwd()) {
  return join(cwd, DIR, FILE);
}

export async function record({ command, args = {}, result = null, error = null, meta = null, cwd = process.cwd() } = {}) {
  if (!command) return;
  const path = auditPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  const errorText = error ? (typeof error === 'string' ? error : error.message ?? String(error)) : null;
  const entry = {
    ts: new Date().toISOString(),
    command,
    args: scrub(args),
    // result + error can carry user-supplied strings (e.g. a failing-fetch
    // message containing a webhook URL). Run them through scrubValue too.
    result: result ? truncate(scrubValue(String(result)), 500) : null,
    error: errorText ? truncate(scrubValue(errorText), 500) : null,
  };
  if (meta && typeof meta === 'object') entry.meta = scrub(meta);
  await appendFile(path, JSON.stringify(entry) + '\n', 'utf8');
}

export async function tail(n = 50, cwd = process.cwd()) {
  const path = auditPath(cwd);
  if (!existsSync(path)) return [];
  const raw = await readFile(path, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  return lines.slice(-n).map((l) => {
    try { return JSON.parse(l); } catch { return { raw: l }; }
  });
}

const SECRET_SEGMENTS = new Set([
  // Original set.
  'token', 'secret', 'password', 'pat', 'auth', 'credential',
  // Added: real-world key naming a CLI accumulates over time.
  // bearer/cookie/session — bearer credentials by name.
  // webhook — Slack/Teams URLs ARE the credential.
  // signature — webhook HMAC sigs, request-signing headers.
  // assertion — SAML / OIDC.
  'bearer', 'cookie', 'session', 'webhook', 'signature', 'assertion',
]);

// Webhook URLs that act as bearer credentials. Anyone holding the URL can
// post to the channel. Redact in any string value so accidental logging
// (e.g. a failing-fetch error message embedding the URL) never leaks.
const WEBHOOK_URL_RE = /https:\/\/(?:hooks\.slack\.com\/services|[^\/\s"'`]*\.webhook\.office(?:365)?\.com|outlook\.office(?:365)?\.com\/webhook)[^\s"'`]+/gi;

function isSecretKey(k) {
  if (/api[_-]?key/i.test(k)) return true;
  for (const seg of k.toLowerCase().split(/[^a-z]+/)) {
    if (seg && SECRET_SEGMENTS.has(seg)) return true;
  }
  return false;
}

function scrubValue(s) {
  if (typeof s !== 'string') return s;
  return s.replace(WEBHOOK_URL_RE, '<redacted-webhook>');
}

function scrub(obj) {
  if (typeof obj === 'string') return scrubValue(obj);
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrub);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isSecretKey(k)) {
      out[k] = '<redacted>';
    } else if (v && typeof v === 'object') {
      out[k] = scrub(v);
    } else if (typeof v === 'string' && v.length > 200) {
      out[k] = scrubValue(v).slice(0, 200) + '…';
    } else {
      out[k] = scrubValue(v);
    }
  }
  return out;
}

function truncate(s, max) {
  if (s == null) return s;
  const str = String(s);
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/**
 * Wrap a command runner so it auto-records to the audit log.
 * Captures success/failure but never throws *from* the audit layer.
 */
export function audited(command, fn) {
  return async (args) => {
    const safeArgs = args ?? {};
    try {
      const result = await fn(safeArgs);
      try { await record({ command, args: safeArgs, result: result === undefined ? 'ok' : 'ok' }); } catch { /* never break the command */ }
      return result;
    } catch (err) {
      try { await record({ command, args: safeArgs, error: err }); } catch { /* same */ }
      throw err;
    }
  };
}
