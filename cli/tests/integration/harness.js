import { randomBytes } from 'node:crypto';

export function shouldRun() {
  return process.env.OPENSPECPM_INTEGRATION === '1';
}

export function requireEnv(...keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    return { ok: false, msg: `skipping: missing env ${missing.join(', ')}` };
  }
  return { ok: true };
}

export function uniqueSuffix() {
  return randomBytes(4).toString('hex');
}

export function shouldSkip(testName, ...envKeys) {
  if (!shouldRun()) return { skip: true, reason: 'OPENSPECPM_INTEGRATION not set' };
  const check = requireEnv(...envKeys);
  if (!check.ok) return { skip: true, reason: check.msg };
  return { skip: false };
}
