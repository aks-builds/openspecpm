import { readConfig } from '../config.js';
import { loadAdapter } from '../adapters/index.js';
import { loadChange } from '../tracking.js';
import { changeExists } from '../openspec-bridge.js';

/**
 * Generic "set fields on this work item" command. Wraps adapter.updateWorkItem
 * so users don't have to know per-adapter field names.
 *
 * Examples:
 *   openspecpm assign demo "Add toggle" --assignee alice
 *   openspecpm assign demo "Add toggle" --sprint S5 --story-points 3
 *   openspecpm assign demo "Add toggle" --iteration Sprint-12 --area Web/Mobile
 */
export async function runAssign({
  feature,
  task: taskRef,
  assignee,
  sprint,
  iteration,
  area,
  storyPoints,
} = {}) {
  if (!feature) throw new Error('feature name is required');
  if (!taskRef) throw new Error('task title or external_id is required');
  const config = await readConfig();
  if (!config) {
    const err = new Error('No .openspecpm/config.json found.');
    err.remediation = 'Run `openspecpm init` first.';
    throw err;
  }
  if (!changeExists(feature)) throw new Error(`OpenSpec change "${feature}" not found.`);

  const change = await loadChange(feature);
  const task = change.items.find((t) => t.title === taskRef) ?? change.items.find((t) => String(t.external_id) === String(taskRef));
  if (!task) {
    const err = new Error(`Task "${taskRef}" not found in feature "${feature}".`);
    err.remediation = 'Run `openspecpm status` to see available tasks.';
    throw err;
  }
  if (!task.external_id) {
    const err = new Error(`Task "${task.title}" has no external_id — it hasn't been synced yet.`);
    err.remediation = `Run \`openspecpm sync ${feature}\` first.`;
    throw err;
  }

  const adapter = loadAdapter(config.adapter, config);
  await adapter.init();

  // Per-adapter field translation. Each adapter accepts the keys it supports
  // and ignores the rest; this is a deliberate "best-effort" surface.
  const patch = {};
  if (assignee) patch.assignee = assignee;
  if (sprint) {
    // Jira sprint id, ADO iteration path, Linear cycle id, GitLab milestone id
    patch.sprint = sprint;
    patch.iterationPath = sprint;
    patch.milestoneId = sprint;
    patch.cycleId = sprint;
  }
  if (iteration) {
    patch.iterationPath = iteration;
    patch.sprint = iteration;
  }
  if (area) patch.areaPath = area;
  if (storyPoints !== undefined) {
    patch.estimate = Number(storyPoints);    // Linear / Jira customField map externally
    patch.weight = Number(storyPoints);      // GitLab
    patch.storyPoints = Number(storyPoints); // semantic key for future adapters
  }

  await adapter.updateWorkItem({ adapter: config.adapter, id: task.external_id }, patch);
  process.stdout.write(`✓ Updated ${task.external_id} on ${config.adapter}.\n`);
  const fields = Object.entries({ assignee, sprint, iteration, area, storyPoints })
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`).join(', ');
  if (fields) process.stdout.write(`  Set: ${fields}\n`);
}
