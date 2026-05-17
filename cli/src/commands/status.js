import { readConfig } from '../config.js';
import { listChanges, summarizeChange } from '../tracking.js';

export async function runStatus() {
  const config = await readConfig();
  out('openspecpm status\n');
  out(`Adapter: ${config?.adapter ?? '(not configured — run `openspecpm init`)'}`);
  if (config?.repo) out(`Repo:    ${config.repo}`);
  if (config?.organization) out(`Org:     ${config.organization} / ${config.project}`);
  if (config?.baseUrl && config?.projectKey) out(`Jira:    ${config.baseUrl} / ${config.projectKey}`);

  const changes = await listChanges();
  out(`\nChanges: ${changes.length}`);
  if (!changes.length) {
    out('  (no OpenSpec changes yet — run `openspecpm propose <feature>`)');
    return;
  }
  for (const c of changes) {
    const { total, counts } = summarizeChange(c);
    const flags = [];
    if (c.proposal.status) flags.push(c.proposal.status);
    if (c.proposal.external) flags.push('synced');
    out(`  - ${c.name} (${total} tasks: ${counts.created} synced, ${counts.pending} pending, ${counts.failed} failed, ${counts.done} done)` + (flags.length ? ` [${flags.join(', ')}]` : ''));
  }
}

function out(s) {
  process.stdout.write(s + '\n');
}
