import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readConfig } from '../config.js';
import { loadAdapter } from '../adapters/index.js';
import { changeDir, changeExists } from '../openspec-bridge.js';
import * as fm from '../frontmatter.js';
import { coerceItems, safeParseFrontmatter } from '../tracking.js';

export async function runReconcile({ feature, dryRun = false } = {}) {
  if (!feature) throw new Error('feature name is required');
  const config = await readConfig();
  if (!config) {
    const err = new Error('No .openspecpm/config.json found.');
    err.remediation = 'Run `openspecpm init` first.';
    throw err;
  }
  if (!changeExists(feature)) throw new Error(`OpenSpec change "${feature}" not found.`);

  const dir = changeDir(feature);
  const tasksPath = join(dir, 'tasks.md');
  // Read + validate through the same helpers loadChange uses, so a non-array
  // items: (or malformed YAML) raises a clear error instead of iterating
  // character-by-character.
  let tdata = {};
  let tbody = '';
  try {
    ({ data: tdata, body: tbody } = await safeParseFrontmatter(tasksPath, feature, 'tasks.md'));
  } catch (err) {
    if (err.code === 'ENOENT' || /no such file/i.test(err.message)) {
      // tasks.md missing — nothing to reconcile.
      process.stdout.write('No items in tasks.md to reconcile.\n');
      return;
    }
    throw err;
  }
  const items = coerceItems(tdata.items, tbody, feature);
  if (!items.length) {
    process.stdout.write('No items in tasks.md to reconcile.\n');
    return;
  }

  const adapter = loadAdapter(config.adapter, config);
  await adapter.init();

  let drift = 0;
  const updated = [];
  for (const task of items) {
    if (!task.external_id) {
      updated.push(task);
      continue;
    }
    try {
      const view = await adapter.getWorkItem({ adapter: config.adapter, id: task.external_id });
      const remoteClosed = view.status === 'closed';
      const next = { ...task };
      if (remoteClosed && !task.closed) {
        next.closed = true;
        next.done = true;
        drift++;
        process.stdout.write(`! ${task.title} [${task.external_id}] closed remotely — marking done locally\n`);
      } else if (!remoteClosed && task.closed) {
        next.closed = false;
        next.done = false;
        drift++;
        process.stdout.write(`! ${task.title} [${task.external_id}] re-opened remotely — clearing local closed flag\n`);
      }
      next.remote_status = view.status;
      next.remote_assignee = view.assignee ?? null;
      updated.push(next);
    } catch (err) {
      process.stdout.write(`✖ ${task.title} [${task.external_id}] — ${err.message}\n`);
      updated.push({ ...task, last_reconcile_error: err.message });
    }
  }

  if (dryRun) {
    process.stdout.write(`\n[dry-run] ${drift} item(s) would be updated locally.\n`);
    return;
  }
  if (!drift && !updated.some((t, i) => t.remote_status !== items[i].remote_status)) {
    process.stdout.write('Already in sync.\n');
    return;
  }
  const patched = fm.serialize({ ...tdata, items: updated }, tbody);
  await writeFile(tasksPath, patched, 'utf8');
  process.stdout.write(`\n✓ Reconciled ${drift} drifted item(s); remote_status mirrored on every synced task.\n`);
}
