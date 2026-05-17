import { propose, changeExists, changeDir, OpenSpecError } from '../openspec-bridge.js';
import { lintChange, summarize, formatFindings } from '../bdd/linter.js';

export async function runPropose({ feature, prompt } = {}) {
  if (!feature) throw new Error('feature name is required');
  if (changeExists(feature)) {
    process.stdout.write(`Change "${feature}" already exists at ${changeDir(feature)}. Skipping propose.\n`);
    await softLint(changeDir(feature));
    return changeDir(feature);
  }
  const seed = prompt ?? `Author a BDD-shaped proposal for ${feature}. Use Given/When/Then scenarios in specs/.`;
  try {
    const dir = await propose(feature, seed);
    process.stdout.write(`\nProposal created at ${dir}.\n`);
    await softLint(dir);
    process.stdout.write(`Next: review proposal.md + specs/, then run \`openspecpm sync ${feature}\`.\n`);
    return dir;
  } catch (err) {
    if (err instanceof OpenSpecError) throw err;
    throw new OpenSpecError(`openspec propose failed: ${err.message}`, {
      remediation: 'Run `openspecpm doctor` to verify OpenSpec is installed and on PATH.',
    });
  }
}

async function softLint(dir) {
  const findings = await lintChange(dir);
  const sum = summarize(findings);
  if (!sum.total) return;
  process.stdout.write(`\nBDD lint (soft): ${sum.errors} errors, ${sum.warnings} warnings\n`);
  process.stdout.write(formatFindings(findings));
  process.stdout.write('These will block `sync` unless you pass --force. Refine scenarios before pushing.\n');
}
