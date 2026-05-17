import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { propose, changeExists, changeDir, OpenSpecError } from '../openspec-bridge.js';
import { lintChange, summarize, formatFindings } from '../bdd/linter.js';
import { CHANGE_TYPES, proposalTemplate, specsTemplate, STARTER_TASKS } from '../bdd/templates.js';

export async function runPropose({ feature, prompt, type = 'feature', offline = false } = {}) {
  if (!feature) throw new Error('feature name is required');
  if (!CHANGE_TYPES.includes(type)) {
    const err = new Error(`Unknown change type "${type}".`);
    err.remediation = `Use one of: ${CHANGE_TYPES.join(', ')}`;
    throw err;
  }

  if (changeExists(feature)) {
    process.stdout.write(`Change "${feature}" already exists at ${changeDir(feature)}. Skipping propose.\n`);
    await softLint(changeDir(feature));
    return changeDir(feature);
  }

  if (offline) {
    const dir = await scaffoldOffline(feature, type);
    process.stdout.write(`\nProposal scaffolded offline at ${dir} (type=${type}).\n`);
    await softLint(dir);
    process.stdout.write(`Next: refine the templates, then run \`openspecpm sync ${feature}\`.\n`);
    return dir;
  }

  const seed = prompt ?? `Author a BDD-shaped ${type} proposal for ${feature}. Use Given/When/Then scenarios in specs/.`;
  try {
    const dir = await propose(feature, seed);
    process.stdout.write(`\nProposal created at ${dir}.\n`);
    await softLint(dir);
    process.stdout.write(`Next: review proposal.md + specs/, then run \`openspecpm sync ${feature}\`.\n`);
    return dir;
  } catch (err) {
    if (err instanceof OpenSpecError) throw err;
    throw new OpenSpecError(`openspec propose failed: ${err.message}`, {
      remediation: 'Run `openspecpm doctor` to verify OpenSpec is installed, or pass --offline to scaffold from a template.',
    });
  }
}

async function scaffoldOffline(feature, type) {
  const dir = changeDir(feature);
  await mkdir(join(dir, 'specs'), { recursive: true });
  if (!existsSync(join(dir, 'proposal.md'))) {
    await writeFile(join(dir, 'proposal.md'), proposalTemplate(type, feature), 'utf8');
  }
  if (!existsSync(join(dir, 'tasks.md'))) {
    await writeFile(join(dir, 'tasks.md'), STARTER_TASKS, 'utf8');
  }
  if (!existsSync(join(dir, 'specs', 'main.md'))) {
    await writeFile(join(dir, 'specs', 'main.md'), specsTemplate(type), 'utf8');
  }
  return dir;
}

async function softLint(dir) { // eslint-disable-line
  const findings = await lintChange(dir);
  const sum = summarize(findings);
  if (!sum.total) return;
  process.stdout.write(`\nBDD lint (soft): ${sum.errors} errors, ${sum.warnings} warnings\n`);
  process.stdout.write(formatFindings(findings));
  process.stdout.write('These will block `sync` unless you pass --force. Refine scenarios before pushing.\n');
}
