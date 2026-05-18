import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readConfig } from '../config.js';
import { loadAdapter } from '../adapters/index.js';
import { changeDir, changeExists } from '../openspec-bridge.js';
import { lintChange, summarize, formatFindings } from '../bdd/linter.js';
import { judgeChange, defaultClient, DEFAULT_MODEL } from '../bdd/judge.js';
import * as fm from '../frontmatter.js';
import { record } from '../audit.js';

export async function runSync({ feature, dryRun = false, force = false, diff = false, llm = false } = {}) {
  if (!feature) throw new Error('feature name is required');
  const config = await readConfig();
  if (!config) {
    const err = new Error('No .openspecpm/config.json found.');
    err.remediation = 'Run `openspecpm init` first.';
    throw err;
  }
  if (!changeExists(feature)) {
    const err = new Error(`OpenSpec change "${feature}" not found.`);
    err.remediation = `Run \`openspecpm propose ${feature}\` first.`;
    throw err;
  }

  const dir = changeDir(feature);
  const findings = await lintChange(dir);
  if (llm || config?.judge?.enabled) {
    try {
      const model = config?.judge?.model ?? DEFAULT_MODEL;
      const proposalPath = join(dir, 'proposal.md');
      const proposalForJudge = existsSync(proposalPath) ? await readFile(proposalPath, 'utf8') : '';
      const client = await defaultClient();
      const judgeFindings = await judgeChange(dir, {
        client,
        model,
        proposal: proposalForJudge,
        onUsage: (u) => {
          record({ command: 'judge', args: { feature }, meta: u }).catch(() => {});
        },
      });
      findings.push(...judgeFindings);
    } catch (err) {
      if (!force) {
        const e = new Error(`LLM judge failed: ${err.message}`);
        e.remediation = 'Run `openspecpm doctor` to check ANTHROPIC_API_KEY, or pass --force to skip the LLM judge.';
        throw e;
      }
      process.stdout.write(`  (LLM judge skipped under --force: ${err.message})\n`);
    }
  }
  const sum = summarize(findings);
  if (sum.errors > 0 && !force) {
    process.stderr.write(`BDD lint: ${sum.errors} errors, ${sum.warnings} warnings\n`);
    process.stderr.write(formatFindings(findings));
    const err = new Error(`Sync blocked by ${sum.errors} BDD lint errors.`);
    err.remediation = 'Refine the scenarios, or pass --force to override.';
    throw err;
  }
  if (sum.total > 0) {
    process.stdout.write(`BDD lint: ${sum.errors} errors, ${sum.warnings} warnings (${force && sum.errors ? 'overridden by --force' : 'soft'})\n`);
    process.stdout.write(formatFindings(findings));
  }

  const adapter = loadAdapter(config.adapter, config);
  if (!dryRun) await adapter.init();

  if (diff) {
    out(`\n[diff] adapter: ${config.adapter}`);
    out(`[diff] hierarchy depth: ${adapter.capabilities().hierarchyDepth}`);
  }

  const proposalPath = join(dir, 'proposal.md');
  const proposalRaw = existsSync(proposalPath) ? await readFile(proposalPath, 'utf8') : '';
  const { data: pdata } = fm.parse(proposalRaw);

  // Idempotency: re-use existing epic ref if present.
  let epicRef = pdata.external?.[config.adapter];
  const featureSpec = { name: feature, summary: extractSummary(proposalRaw) || `OpenSpec change: ${feature}` };

  if (!epicRef) {
    if (dryRun) {
      out(`[dry-run] would create epic for "${feature}" via ${config.adapter}`);
      epicRef = { adapter: config.adapter, id: '<new>', url: '<new>' };
    } else {
      epicRef = await adapter.createEpic(featureSpec);
      const patched = fm.patch(proposalRaw, {
        ...pdata,
        external: { ...(pdata.external ?? {}), [config.adapter]: epicRef },
      });
      await writeFile(proposalPath, patched, 'utf8');
      out(`Created epic ${epicRef.url ?? epicRef.id}`);
    }
  } else {
    out(`Epic already synced: ${epicRef.url ?? epicRef.id} (skipping)`);
  }

  // Walk tasks. OpenSpec stores them in tasks.md (a checklist) and/or specs/*.md.
  // Sprint 1: read tasks.md as a flat list "- [ ] title" entries; create one work item per unchecked task.
  const tasksPath = join(dir, 'tasks.md');
  if (!existsSync(tasksPath)) {
    out('No tasks.md found — only the epic was synced.');
    return;
  }
  const tasksRaw = await readFile(tasksPath, 'utf8');
  const { data: tdata, body: tbody } = fm.parse(tasksRaw);
  const items = tdata.items ?? parseChecklist(tbody);
  const updatedItems = [];

  for (const task of items) {
    if (task.sync_state === 'created' && task.external_id) {
      out(`✓ ${task.title} (already created: ${task.external_id})`);
      updatedItems.push(task);
      continue;
    }
    if (dryRun) {
      out(`[dry-run] would create work item: ${task.title}`);
      updatedItems.push({ ...task, sync_state: 'pending' });
      continue;
    }
    try {
      const ref = await adapter.createWorkItem({ ...epicRef, feature }, { title: task.title, body: task.body ?? '' });
      out(`+ ${task.title} → ${ref.url ?? ref.id}`);
      updatedItems.push({ ...task, sync_state: 'created', external_id: ref.id, external_url: ref.url });
    } catch (err) {
      out(`✖ ${task.title} — ${err.message}`);
      updatedItems.push({ ...task, sync_state: 'failed', last_error: err.message });
    }
  }

  if (!dryRun) {
    const patched = fm.serialize({ ...tdata, items: updatedItems }, tbody);
    await writeFile(tasksPath, patched, 'utf8');
  }
}

function out(s) {
  process.stdout.write(s + '\n');
}

function extractSummary(md) {
  const { body } = fm.parse(md);
  const firstPara = body.split(/\r?\n\r?\n/).find((p) => p.trim() && !p.startsWith('#'));
  return (firstPara ?? '').trim().slice(0, 1000);
}

function parseChecklist(body) {
  const items = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*\[( |x|X)\]\s+(.+?)\s*$/);
    if (m) items.push({ title: m[2], done: m[1].toLowerCase() === 'x', sync_state: 'pending' });
  }
  return items;
}
