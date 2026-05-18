import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readConfig } from '../config.js';
import { loadAdapter } from '../adapters/index.js';
import { loadChange } from '../tracking.js';
import { changeDir, changeExists } from '../openspec-bridge.js';
import { safeReadFile } from '../io.js';

export async function runComment({ feature, task: taskRef, message, dryRun = false } = {}) {
  if (!feature) throw new Error('feature name is required');
  if (!taskRef) throw new Error('task title or external_id is required');
  const config = await readConfig();
  if (!config) {
    const err = new Error('No .openspecpm/config.json found.');
    err.remediation = 'Run `openspecpm init` first.';
    throw err;
  }
  if (!changeExists(feature)) {
    const err = new Error(`OpenSpec change "${feature}" not found.`);
    throw err;
  }

  const change = await loadChange(feature);
  const task = resolveTask(change.items, taskRef);
  if (!task) {
    const err = new Error(`Task "${taskRef}" not found in feature "${feature}".`);
    err.remediation = `Run \`openspecpm status\` to see available tasks.`;
    throw err;
  }
  if (!task.external_id) {
    const err = new Error(`Task "${task.title}" has no external_id — it hasn't been synced yet.`);
    err.remediation = `Run \`openspecpm sync ${feature}\` first.`;
    throw err;
  }

  const body = await resolveBody({ message, feature, taskRef, taskTitle: task.title });
  const stamped = `<!-- SYNCED: ${new Date().toISOString()} -->\n${body}`;

  if (dryRun) {
    process.stdout.write(`[dry-run] would post to ${config.adapter} item ${task.external_id}:\n`);
    process.stdout.write(stamped + '\n');
    return;
  }

  const adapter = loadAdapter(config.adapter, config);
  await adapter.init();
  await adapter.addProgressComment({ adapter: config.adapter, id: task.external_id }, stamped);
  process.stdout.write(`✓ Comment posted to ${task.external_id}.\n`);

  // Append to local progress.md so the local narrative reflects the broadcast.
  await appendLocalProgress(feature, taskRef, stamped);
}

function resolveTask(items, ref) {
  return items.find((t) => t.title === ref) ?? items.find((t) => String(t.external_id) === String(ref));
}

async function resolveBody({ message, feature, taskRef, taskTitle }) {
  if (message) return message;
  const slug = slugify(taskRef === taskTitle ? taskTitle : taskRef);
  const progressPath = join(changeDir(feature), 'updates', slug, 'progress.md');
  const raw = await safeReadFile(progressPath);
  if (raw !== null) {
    return raw.trim() || `(progress.md is empty)`;
  }
  const err = new Error('No --message provided and no local progress.md to post.');
  err.remediation = `Either pass --message "..." or create ${progressPath}.`;
  throw err;
}

async function appendLocalProgress(feature, taskRef, body) {
  const slug = slugify(taskRef);
  const dir = join(changeDir(feature), 'updates', slug);
  await mkdir(dir, { recursive: true });
  const file = join(dir, 'progress.md');
  const existing = (await safeReadFile(file)) ?? '';
  const sep = existing && !existing.endsWith('\n') ? '\n\n' : '\n';
  await writeFile(file, existing + sep + body + '\n', 'utf8');
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'task';
}
