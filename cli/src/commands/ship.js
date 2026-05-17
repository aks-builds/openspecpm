import * as p from '@clack/prompts';
import { execa } from 'execa';
import { readConfig } from '../config.js';
import { loadAdapter } from '../adapters/index.js';
import { loadChange } from '../tracking.js';
import { changeExists } from '../openspec-bridge.js';

export async function runShip({ feature, yes = false, skipArchive = false } = {}) {
  if (!feature) throw new Error('feature name is required');
  const config = await readConfig();
  if (!config) {
    const err = new Error('No .openspecpm/config.json found.');
    err.remediation = 'Run `openspecpm init` first.';
    throw err;
  }
  if (!changeExists(feature)) {
    const err = new Error(`OpenSpec change "${feature}" not found.`);
    err.remediation = `Did you mean another feature? Run \`openspecpm status\`.`;
    throw err;
  }

  const change = await loadChange(feature);
  const epicRef = change.proposal.external?.[config.adapter];
  const synced = change.items.filter((t) => t.sync_state === 'created' && t.external_id);
  const open = synced.filter((t) => !t.done && !t.closed);

  p.intro(`openspecpm ship ${feature}`);
  p.note(
    `Adapter: ${config.adapter}\nEpic: ${epicRef ? `${epicRef.id} (${epicRef.url ?? '?'})` : 'unsynced'}\nWork items: ${synced.length} total, ${open.length} still open`,
    'plan',
  );

  if (!yes) {
    const ok = await p.confirm({
      message: `Close ${open.length} open work item(s) and ${epicRef ? 'the epic' : '(no epic)'}, then ${skipArchive ? 'leave the OpenSpec change in place' : 'archive the OpenSpec change'}?`,
      initialValue: false,
    });
    if (p.isCancel(ok) || !ok) {
      p.cancel('Ship aborted.');
      return;
    }
  }

  const adapter = loadAdapter(config.adapter, config);
  await adapter.init();

  for (const t of open) {
    try {
      await adapter.closeWorkItem({ adapter: config.adapter, id: t.external_id }, `Shipped via openspecpm ship ${feature}`);
      out(`✓ closed ${t.external_id} — ${t.title}`);
    } catch (err) {
      out(`✖ failed to close ${t.external_id}: ${err.message}`);
    }
  }

  if (epicRef) {
    try {
      await adapter.closeWorkItem({ adapter: config.adapter, id: epicRef.id }, `Shipped: all tasks closed for ${feature}.`);
      out(`✓ closed epic ${epicRef.id}`);
    } catch (err) {
      out(`✖ failed to close epic: ${err.message}`);
    }
  }

  if (!skipArchive) {
    try {
      await execa('openspec', ['archive', feature], { stdio: 'inherit' });
      out(`✓ archived ${feature}`);
    } catch (err) {
      out(`! openspec archive failed: ${err.message}. The change folder still exists at openspec/changes/${feature}/.`);
    }
  }

  p.outro(`Shipped ${feature}.`);
}

function out(s) {
  process.stdout.write(s + '\n');
}
