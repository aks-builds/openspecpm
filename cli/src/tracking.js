import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { OPENSPEC_CHANGES_DIR } from './openspec-bridge.js';
import * as fm from './frontmatter.js';

/**
 * @typedef {Object} TaskItem
 * @property {string} title
 * @property {'pending'|'created'|'failed'} sync_state
 * @property {string} [external_id]
 * @property {string} [external_url]
 * @property {string[]} [depends_on]
 * @property {boolean} [done]
 *
 * @typedef {Object} ChangeView
 * @property {string} name
 * @property {string} dir
 * @property {Object} proposal     // frontmatter from proposal.md
 * @property {TaskItem[]} items
 * @property {Date} mtime          // most recent mtime across change files
 */

export async function listChanges(cwd = process.cwd()) {
  const dir = join(cwd, OPENSPEC_CHANGES_DIR);
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const names = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const out = [];
  for (const name of names) out.push(await loadChange(name, cwd));
  return out;
}

export async function loadChange(name, cwd = process.cwd()) {
  const dir = join(cwd, OPENSPEC_CHANGES_DIR, name);
  let proposal = {};
  const proposalPath = join(dir, 'proposal.md');
  if (existsSync(proposalPath)) {
    const parsed = await safeParseFrontmatter(proposalPath, name, 'proposal.md');
    proposal = parsed.data ?? {};
  }
  let items = [];
  const tasksPath = join(dir, 'tasks.md');
  if (existsSync(tasksPath)) {
    const { data, body } = await safeParseFrontmatter(tasksPath, name, 'tasks.md');
    items = coerceItems(data.items, body, name);
  }
  const mtime = await mostRecentMtime(dir);
  return { name, dir, proposal, items, mtime };
}

export async function safeParseFrontmatter(path, changeName, fileLabel) {
  const raw = await readFile(path, 'utf8');
  try {
    return fm.parse(raw);
  } catch (err) {
    const e = new Error(`${changeName}/${fileLabel}: YAML frontmatter is malformed (${err.message?.split('\n')[0] ?? err.name}).`);
    e.remediation = `Repair the YAML in openspec/changes/${changeName}/${fileLabel}. Validate with \`openspecpm validate\` after fixing.`;
    throw e;
  }
}

export function coerceItems(rawItems, body, changeName) {
  if (rawItems === undefined || rawItems === null) {
    // No items: in frontmatter — fall back to the checklist body parser.
    return parseChecklist(body);
  }
  if (!Array.isArray(rawItems)) {
    const e = new Error(`${changeName}/tasks.md: frontmatter "items:" must be a YAML array, got ${Array.isArray(rawItems) ? 'array' : typeof rawItems}.`);
    e.remediation = `Edit openspec/changes/${changeName}/tasks.md so "items:" is a list (each entry starts with "- title: ...").`;
    throw e;
  }
  // Filter out malformed entries (silently skipping is better than crashing
  // deep in a downstream consumer with `TypeError: items is not iterable`).
  return rawItems.filter((t) => t && typeof t === 'object' && typeof t.title === 'string');
}

/**
 * Resolve a dep token against a change. Tokens may be:
 *   "task title"                — same-change reference by title
 *   "<external-id>"             — same-change reference by remote id
 *   "<feature>/<task title>"    — cross-change reference by title
 *   "<feature>/<external-id>"   — cross-change reference by remote id
 */
function resolveDep(dep, change, allChanges) {
  const cross = String(dep).match(/^([^/]+)\/(.+)$/);
  if (cross) {
    const [, featureName, rest] = cross;
    const target = allChanges.find((c) => c.name === featureName);
    if (!target) return { found: false };
    const ref = target.items.find((t) => t.title === rest) ?? target.items.find((t) => String(t.external_id) === String(rest));
    return ref ? { found: true, ref } : { found: false };
  }
  const ref = change.items.find((t) => t.title === dep) ?? change.items.find((t) => String(t.external_id) === String(dep));
  return ref ? { found: true, ref } : { found: false };
}

export function unmetDeps(task, allTasks, options = {}) {
  // Backwards compat: when called with a flat task list, treat as same-change.
  // When called with options.change + options.allChanges, support cross-feature deps.
  const deps = task.depends_on ?? [];
  if (!deps.length) return [];

  const unmet = [];
  if (options.change && options.allChanges) {
    for (const dep of deps) {
      const r = resolveDep(dep, options.change, options.allChanges);
      if (!r.found) { unmet.push({ dep, reason: 'not-found' }); continue; }
      const ref = r.ref;
      if (ref.done || (ref.sync_state === 'created' && ref.closed)) continue;
      unmet.push({ dep, reason: ref.sync_state === 'failed' ? 'dep-failed' : 'dep-open' });
    }
    return unmet;
  }

  // Legacy path
  const byTitle = new Map(allTasks.map((t) => [t.title, t]));
  const byId = new Map(allTasks.filter((t) => t.external_id).map((t) => [String(t.external_id), t]));
  for (const dep of deps) {
    const cross = String(dep).match(/^([^/]+)\/(.+)$/);
    if (cross) {
      // Cross-feature dep with legacy callsite — we can't resolve, mark not-found.
      unmet.push({ dep, reason: 'cross-feature-unresolved' });
      continue;
    }
    const ref = byTitle.get(dep) ?? byId.get(String(dep));
    if (!ref) { unmet.push({ dep, reason: 'not-found' }); continue; }
    if (ref.done || (ref.sync_state === 'created' && ref.closed)) continue;
    if (!ref.done) unmet.push({ dep, reason: ref.sync_state === 'failed' ? 'dep-failed' : 'dep-open' });
  }
  return unmet;
}

export function findNextTasks(changes) {
  const candidates = [];
  for (const change of changes) {
    for (const task of change.items) {
      if (task.done) continue;
      if (task.sync_state === 'created' && task.closed) continue;
      const unmet = unmetDeps(task, change.items, { change, allChanges: changes });
      if (unmet.length === 0) candidates.push({ change: change.name, task });
    }
  }
  return candidates;
}

export function findBlockedTasks(changes) {
  const blocked = [];
  for (const change of changes) {
    for (const task of change.items) {
      if (task.done) continue;
      const unmet = unmetDeps(task, change.items, { change, allChanges: changes });
      if (unmet.length > 0) blocked.push({ change: change.name, task, unmet });
    }
  }
  return blocked;
}

export async function findRecentUpdates(changes, sinceMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - sinceMs;
  const recent = [];
  for (const change of changes) {
    const updatesDir = join(change.dir, 'updates');
    if (!existsSync(updatesDir)) continue;
    const tasks = await readdir(updatesDir, { withFileTypes: true });
    for (const t of tasks) {
      if (!t.isDirectory()) continue;
      const progressPath = join(updatesDir, t.name, 'progress.md');
      if (!existsSync(progressPath)) continue;
      const s = await stat(progressPath);
      if (s.mtimeMs >= cutoff) {
        recent.push({ change: change.name, task: t.name, path: progressPath, mtime: s.mtime });
      }
    }
  }
  recent.sort((a, b) => b.mtime - a.mtime);
  return recent;
}

export function summarizeChange(change) {
  const total = change.items.length;
  const counts = { pending: 0, created: 0, failed: 0, done: 0 };
  for (const t of change.items) {
    if (t.done) counts.done++;
    else counts[t.sync_state ?? 'pending']++;
  }
  return { total, counts };
}

function parseChecklist(body) {
  const items = [];
  for (const line of (body ?? '').split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*\[( |x|X)\]\s+(.+?)\s*$/);
    if (m) items.push({ title: m[2], done: m[1].toLowerCase() === 'x', sync_state: 'pending' });
  }
  return items;
}

async function mostRecentMtime(dir) {
  let latest = 0;
  async function walk(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else {
        try {
          const s = await stat(p);
          if (s.mtimeMs > latest) latest = s.mtimeMs;
        } catch { /* ignore */ }
      }
    }
  }
  await walk(dir);
  return latest ? new Date(latest) : new Date(0);
}
