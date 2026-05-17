import { readFile } from 'node:fs/promises';
import { listChanges, findRecentUpdates } from '../tracking.js';

export async function runStandup({ since = '24h' } = {}) {
  const sinceMs = parseWindow(since);
  const changes = await listChanges();
  const recent = await findRecentUpdates(changes, sinceMs);
  out(`openspecpm standup — last ${since}\n`);
  if (!recent.length) {
    out('No progress updates in window.');
    return;
  }
  let lastChange = null;
  for (const r of recent) {
    if (r.change !== lastChange) {
      out(`\n[${r.change}]`);
      lastChange = r.change;
    }
    const snippet = (await readFile(r.path, 'utf8')).split(/\r?\n/).slice(0, 5).join(' ').slice(0, 240);
    out(`  ${r.mtime.toISOString().slice(0, 16).replace('T', ' ')}  ${r.task}: ${snippet}`);
  }
}

function parseWindow(s) {
  const m = String(s).match(/^(\d+)([hdw])$/i);
  if (!m) return 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  return n * (unit === 'h' ? 3600e3 : unit === 'd' ? 86400e3 : 7 * 86400e3);
}

function out(s) {
  process.stdout.write(s + '\n');
}
