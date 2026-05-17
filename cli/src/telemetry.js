/**
 * Telemetry for OpenSpecPM.
 *
 * Off by default. Users opt in via:
 *   .openspecpm/config.json:
 *     { "telemetry": { "enabled": true } }
 *
 * In alpha, this module records to the audit log only and never sends anything
 * over the network — the future endpoint isn't built yet, but the opt-in flow
 * and the data shape are. Setting OPENSPECPM_TELEMETRY_DRY=1 forces dry mode
 * even if config has enabled=true.
 *
 * What we'd send if enabled: command name, success/fail, duration_ms, OS,
 * Node version. Never: feature names, task titles, repo identifiers, tokens,
 * or any user-authored content.
 */

import { record } from './audit.js';

export function isEnabled(config) {
  if (process.env.OPENSPECPM_TELEMETRY_DRY === '1') return false;
  return Boolean(config?.telemetry?.enabled);
}

export async function track(event, config) {
  if (!isEnabled(config)) return;
  // In alpha: only mirror to the audit log so users can inspect what *would*
  // be sent. No network calls.
  try {
    await record({
      command: '__telemetry__',
      args: scrub(event),
      result: 'mirrored-only-no-network-in-alpha',
    });
  } catch { /* never raise */ }
}

function scrub(event) {
  if (!event || typeof event !== 'object') return event;
  const out = {};
  for (const k of ['name', 'success', 'duration_ms', 'adapter', 'node', 'os']) {
    if (event[k] !== undefined) out[k] = event[k];
  }
  return out;
}
