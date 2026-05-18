import { join } from 'node:path';
import { loadChange, unmetDeps } from '../tracking.js';
import { changeDir, changeExists } from '../openspec-bridge.js';
import { record } from '../audit.js';
import { safeReadFile } from '../io.js';

export async function runFanOut({ feature, limit = 5 } = {}) {
  if (!feature) throw new Error('feature name is required');
  if (!changeExists(feature)) throw new Error(`OpenSpec change "${feature}" not found.`);
  const change = await loadChange(feature);

  const candidates = change.items.filter(
    (t) => !t.done && !t.closed && t.parallel === true && unmetDeps(t, change.items).length === 0,
  );
  if (!candidates.length) {
    process.stdout.write('No tasks ready for parallel fan-out.\n');
    process.stdout.write('  Tip: mark tasks with `parallel: true` in tasks.md and ensure depends_on are met.\n');
    return;
  }

  const proposal = (await safeReadFile(join(changeDir(feature), 'proposal.md'))) ?? '';
  const design = (await safeReadFile(join(changeDir(feature), 'design.md'))) ?? '';
  const tasks = candidates.slice(0, limit);

  process.stdout.write(`openspecpm fan-out ${feature} — ${tasks.length} parallel task(s) ready\n\n`);
  process.stdout.write(`Copy each prompt below into a separate agent session. The agent should treat\n`);
  process.stdout.write(`the BDD scenarios in specs/ as acceptance criteria.\n`);
  process.stdout.write(`${'='.repeat(72)}\n\n`);

  for (const [i, task] of tasks.entries()) {
    const specFile = task.spec ? join(changeDir(feature), 'specs', task.spec) : null;
    const specBlock = (specFile && (await safeReadFile(specFile))) ?? '(no spec file linked — read all of specs/)';
    process.stdout.write(`--- Agent ${i + 1} of ${tasks.length} ---\n`);
    process.stdout.write(`Task: ${task.title}${task.external_id ? ` [#${task.external_id}]` : ''}\n\n`);
    process.stdout.write(`Prompt to paste:\n\n`);
    process.stdout.write([
      `Implement the task "${task.title}" from feature "${feature}".`,
      ``,
      `Context (proposal):`,
      truncate(proposal, 1200),
      ``,
      `Design notes:`,
      truncate(design, 800),
      ``,
      `Acceptance criteria (BDD scenarios):`,
      truncate(specBlock, 1200),
      ``,
      `Rules:`,
      `- Only modify files relevant to this task. Leave other parallel streams alone.`,
      `- When done, append progress notes to openspec/changes/${feature}/updates/${slugify(task.title)}/progress.md.`,
      `- If you discover the spec is ambiguous, stop and ask before guessing.`,
    ].join('\n') + '\n\n');
  }
  process.stdout.write(`${'='.repeat(72)}\n`);
  process.stdout.write(`After dispatching, run \`openspecpm standup\` to see updates as agents post progress.\n`);

  try {
    await record({
      command: 'fan-out',
      args: { feature, dispatched: tasks.map((t) => t.title) },
      result: 'ok',
    });
  } catch { /* never break the user */ }
}

function truncate(s, max) {
  if (!s) return '(none)';
  return s.length > max ? s.slice(0, max) + '\n…' : s;
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'task';
}
