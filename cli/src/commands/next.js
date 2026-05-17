import { listChanges, findNextTasks } from '../tracking.js';

export async function runNext({ limit = 5 } = {}) {
  const changes = await listChanges();
  const candidates = findNextTasks(changes);
  out(`openspecpm next — ${candidates.length} task(s) ready to start\n`);
  if (!candidates.length) return;
  for (const { change, task } of candidates.slice(0, limit)) {
    const tag = task.external_id ? ` [${task.external_id}]` : ` [unsynced]`;
    const parallel = task.parallel ? ' parallel' : '';
    out(`  • ${change} — ${task.title}${tag}${parallel}`);
  }
  if (candidates.length > limit) out(`  …and ${candidates.length - limit} more.`);
}

function out(s) {
  process.stdout.write(s + '\n');
}
