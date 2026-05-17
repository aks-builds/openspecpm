import * as p from '@clack/prompts';
import { listChanges, summarizeChange } from '../tracking.js';
import { runSync } from './sync.js';
import { runShip } from './ship.js';

export async function runSyncAll({ dryRun = false, force = false, yes = false } = {}) {
  const changes = await listChanges();
  if (!changes.length) {
    process.stdout.write('No OpenSpec changes to sync.\n');
    return;
  }

  if (!yes) {
    p.intro('openspecpm sync --all');
    p.note(`Will sync ${changes.length} change(s): ${changes.map((c) => c.name).join(', ')}`, 'plan');
    const ok = await p.confirm({ message: 'Proceed?', initialValue: false });
    if (p.isCancel(ok) || !ok) { p.cancel('Aborted.'); return; }
  }

  let synced = 0;
  let failed = 0;
  for (const change of changes) {
    process.stdout.write(`\n── ${change.name} ──\n`);
    try {
      await runSync({ feature: change.name, dryRun, force });
      synced++;
    } catch (err) {
      process.stderr.write(`✖ ${change.name} sync failed: ${err.message}\n`);
      if (err.remediation) process.stderr.write(`  → ${err.remediation}\n`);
      failed++;
    }
  }
  process.stdout.write(`\nSummary: ${synced} synced, ${failed} failed.\n`);
}

export async function runShipAllReady({ yes = false, skipArchive = false } = {}) {
  const changes = await listChanges();
  const ready = changes.filter((c) => {
    const s = summarizeChange(c);
    return s.total > 0 && s.counts.pending === 0 && s.counts.failed === 0;
  });
  if (!ready.length) {
    process.stdout.write('No changes are fully synced and ready to ship.\n');
    return;
  }

  if (!yes) {
    p.intro('openspecpm ship --all-ready');
    p.note(`Will ship ${ready.length} change(s): ${ready.map((c) => c.name).join(', ')}`, 'plan');
    const ok = await p.confirm({ message: 'Close all of these in the PM tool and archive?', initialValue: false });
    if (p.isCancel(ok) || !ok) { p.cancel('Aborted.'); return; }
  }

  let shipped = 0;
  let failed = 0;
  for (const change of ready) {
    process.stdout.write(`\n── ${change.name} ──\n`);
    try {
      await runShip({ feature: change.name, yes: true, skipArchive });
      shipped++;
    } catch (err) {
      process.stderr.write(`✖ ${change.name} ship failed: ${err.message}\n`);
      failed++;
    }
  }
  process.stdout.write(`\nSummary: ${shipped} shipped, ${failed} failed.\n`);
}
