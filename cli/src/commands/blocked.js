import { listChanges, findBlockedTasks } from '../tracking.js';

export async function runBlocked() {
  const changes = await listChanges();
  const blocked = findBlockedTasks(changes);
  out(`openspecpm blocked — ${blocked.length} task(s) waiting on dependencies\n`);
  if (!blocked.length) return;
  for (const { change, task, unmet } of blocked) {
    const tag = task.external_id ? ` [${task.external_id}]` : ' [unsynced]';
    out(`  • ${change} — ${task.title}${tag}`);
    for (const u of unmet) out(`      ↳ ${u.reason}: ${u.dep}`);
  }
}

function out(s) {
  process.stdout.write(s + '\n');
}
