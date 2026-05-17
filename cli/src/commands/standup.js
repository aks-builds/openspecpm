import { readFile } from 'node:fs/promises';
import { listChanges, findRecentUpdates } from '../tracking.js';
import { readConfig } from '../config.js';
import { notify } from '../notify.js';

export async function runStandup({ since = '24h', broadcast = false } = {}) {
  const sinceMs = parseWindow(since);
  const changes = await listChanges();
  const recent = await findRecentUpdates(changes, sinceMs);
  const lines = [`openspecpm standup — last ${since}`];
  if (!recent.length) {
    lines.push('No progress updates in window.');
    process.stdout.write(lines.join('\n') + '\n');
    return;
  }
  let lastChange = null;
  for (const r of recent) {
    if (r.change !== lastChange) {
      lines.push(`\n[${r.change}]`);
      lastChange = r.change;
    }
    const snippet = (await readFile(r.path, 'utf8')).split(/\r?\n/).slice(0, 5).join(' ').slice(0, 240);
    lines.push(`  ${r.mtime.toISOString().slice(0, 16).replace('T', ' ')}  ${r.task}: ${snippet}`);
  }
  const text = lines.join('\n');
  process.stdout.write(text + '\n');

  if (broadcast) {
    const config = await readConfig();
    const r = await notify({ config, title: `OpenSpecPM standup (${since})`, body: text });
    process.stdout.write(`\nBroadcast: ${r.sent} target(s)` + (r.errors.length ? `, ${r.errors.length} error(s)` : '') + '\n');
    for (const e of r.errors) process.stdout.write(`  ✖ ${e.target}: ${e.error}\n`);
  }
}

function parseWindow(s) {
  const m = String(s).match(/^(\d+)([hdw])$/i);
  if (!m) return 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  return n * (unit === 'h' ? 3600e3 : unit === 'd' ? 86400e3 : 7 * 86400e3);
}
