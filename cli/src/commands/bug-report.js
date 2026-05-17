import { readConfig } from '../config.js';
import { loadAdapter } from '../adapters/index.js';
import { loadChange } from '../tracking.js';
import { changeExists } from '../openspec-bridge.js';

export async function runBugReport({ feature, task: taskRef, title, body } = {}) {
  if (!feature) throw new Error('feature name is required');
  if (!taskRef) throw new Error('task title or external_id is required');
  if (!title) throw new Error('bug title is required (use --title)');
  const config = await readConfig();
  if (!config) {
    const err = new Error('No .openspecpm/config.json found.');
    err.remediation = 'Run `openspecpm init` first.';
    throw err;
  }
  if (!changeExists(feature)) throw new Error(`OpenSpec change "${feature}" not found.`);

  const change = await loadChange(feature);
  const orig = change.items.find((t) => t.title === taskRef) ?? change.items.find((t) => String(t.external_id) === String(taskRef));
  if (!orig) {
    const err = new Error(`Task "${taskRef}" not found in feature "${feature}".`);
    err.remediation = 'Run `openspecpm status` to see available tasks.';
    throw err;
  }
  if (!orig.external_id) {
    const err = new Error(`Cannot file a bug against an unsynced task.`);
    err.remediation = `Run \`openspecpm sync ${feature}\` first.`;
    throw err;
  }

  const adapter = loadAdapter(config.adapter, config);
  await adapter.init();

  const epicRef = change.proposal.external?.[config.adapter];

  const bugTitle = `[bug] ${title}`;
  const bugBody = [
    body ?? '',
    '',
    `Reported against task "${orig.title}" (${orig.external_id})`,
    epicRef ? `Epic: ${epicRef.url ?? epicRef.id}` : '',
    `Feature: ${feature}`,
    '',
    'Reproduce:',
    '1. <steps>',
    '',
    'Expected:',
    '',
    'Actual:',
    '',
    `Filed via \`openspecpm bug-report\`.`,
  ].filter(Boolean).join('\n');

  const bugRef = await adapter.createWorkItem(
    epicRef ?? { id: orig.external_id, feature },
    { title: bugTitle, body: bugBody, type: 'Bug' },
  );
  process.stdout.write(`✓ Created bug ${bugRef.url ?? bugRef.id}\n`);

  // Link bug ↔ original.
  try {
    await adapter.linkWorkItems({ adapter: config.adapter, id: orig.external_id }, bugRef, 'Relates');
  } catch (err) {
    process.stdout.write(`  (warning: failed to link to original: ${err.message})\n`);
  }

  // Comment on the original referencing the bug.
  try {
    await adapter.addProgressComment(
      { adapter: config.adapter, id: orig.external_id },
      `<!-- SYNCED: ${new Date().toISOString()} -->\nFollow-up bug filed: ${bugRef.url ?? bugRef.id} — ${title}`,
    );
  } catch (err) {
    process.stdout.write(`  (warning: failed to comment on original: ${err.message})\n`);
  }

  process.stdout.write(`Done. Bug is now visible in your PM tool, linked to ${orig.external_id}.\n`);
}
