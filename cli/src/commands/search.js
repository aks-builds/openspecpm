import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { OPENSPEC_CHANGES_DIR } from '../openspec-bridge.js';

export async function runSearch({ query, limit = 50, caseSensitive = false } = {}) {
  if (!query) throw new Error('query is required');
  const flags = caseSensitive ? '' : 'i';
  const re = new RegExp(escapeRegex(query), flags);
  const root = process.cwd();
  const dir = join(root, OPENSPEC_CHANGES_DIR);
  if (!existsSync(dir)) {
    process.stdout.write('No OpenSpec changes to search.\n');
    return;
  }
  const hits = [];
  await walk(dir, async (path) => {
    if (!/\.md$/i.test(path)) return;
    const lines = (await readFile(path, 'utf8')).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        hits.push({ path: relative(root, path), line: i + 1, text: lines[i].trim().slice(0, 200) });
        if (hits.length >= limit * 2) return;
      }
    }
  });
  if (!hits.length) {
    process.stdout.write(`No matches for /${query}/${flags}.\n`);
    return;
  }
  for (const h of hits.slice(0, limit)) {
    process.stdout.write(`${h.path}:${h.line}: ${h.text}\n`);
  }
  if (hits.length > limit) process.stdout.write(`…and ${hits.length - limit} more.\n`);
}

async function walk(dir, fn) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, fn);
    } else if (e.isFile()) {
      await fn(full);
    }
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
