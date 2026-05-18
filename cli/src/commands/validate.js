import { join } from 'node:path';
import { listChanges } from '../tracking.js';
import { lintChange, summarize } from '../bdd/linter.js';
import { judgeChange, defaultClient, DEFAULT_MODEL } from '../bdd/judge.js';
import { readConfig } from '../config.js';
import { record } from '../audit.js';
import { safeReadFile } from '../io.js';

const REQUIRED_PROPOSAL = ['name'];
const TASK_STATES = ['pending', 'created', 'failed'];

export async function runValidate({ llm = false } = {}) {
  const changes = await listChanges();
  const config = await readConfig();
  const judgeEnabled = llm || Boolean(config?.judge?.enabled);
  const model = config?.judge?.model ?? DEFAULT_MODEL;
  const client = judgeEnabled ? await defaultClient().catch(() => null) : null;
  out(`openspecpm validate — ${changes.length} change(s)\n`);
  let totalIssues = 0;

  for (const change of changes) {
    const issues = [];

    // Proposal frontmatter
    for (const k of REQUIRED_PROPOSAL) {
      if (!change.proposal[k]) issues.push(`proposal.md missing required field "${k}"`);
    }
    if (change.proposal.name && change.proposal.name !== change.name) {
      issues.push(`proposal.md name="${change.proposal.name}" does not match directory "${change.name}"`);
    }

    // Task items
    const titles = new Set();
    for (const [i, task] of change.items.entries()) {
      const ref = `tasks.md item #${i + 1}`;
      if (!task.title) issues.push(`${ref}: missing title`);
      if (task.sync_state && !TASK_STATES.includes(task.sync_state)) {
        issues.push(`${ref} "${task.title}": invalid sync_state "${task.sync_state}" (expected ${TASK_STATES.join(' | ')})`);
      }
      if (task.sync_state === 'created' && !task.external_id) {
        issues.push(`${ref} "${task.title}": sync_state=created but external_id missing`);
      }
      if (task.title) {
        if (titles.has(task.title)) issues.push(`${ref}: duplicate title "${task.title}"`);
        titles.add(task.title);
      }
    }

    // depends_on references
    for (const task of change.items) {
      for (const dep of task.depends_on ?? []) {
        const byTitle = change.items.some((t) => t.title === dep);
        const byId = change.items.some((t) => String(t.external_id) === String(dep));
        if (!byTitle && !byId) {
          issues.push(`tasks.md "${task.title}": depends_on "${dep}" does not resolve`);
        }
      }
    }

    // BDD lint
    const findings = await lintChange(change.dir);
    if (judgeEnabled && client) {
      try {
        const proposalPath = join(change.dir, 'proposal.md');
        const proposal = (await safeReadFile(proposalPath)) ?? '';
        const judgeFindings = await judgeChange(change.dir, {
          client,
          model,
          proposal,
          onUsage: (u) => {
            record({ command: 'judge', args: { feature: change.name }, meta: u }).catch(() => {});
          },
        });
        findings.push(...judgeFindings);
      } catch (err) {
        findings.push({
          severity: 'warning',
          file: change.dir,
          scenario: '(judge failed)',
          rule: 'bdd/llm-parse-error',
          message: `LLM judge failed: ${err.message}`,
        });
      }
    }
    const { errors, warnings } = summarize(findings);

    const total = issues.length + errors;
    totalIssues += total;
    if (total === 0 && warnings === 0) {
      out(`  ✓ ${change.name}`);
    } else {
      out(`  ${total > 0 ? '✖' : '⚠'} ${change.name}: ${issues.length} schema, ${errors} BDD errors, ${warnings} BDD warnings`);
      for (const i of issues) out(`      - ${i}`);
      for (const f of findings.filter((x) => x.severity === 'error')) {
        out(`      - BDD ${f.rule}: ${f.scenario} — ${f.message}`);
      }
    }
  }

  if (totalIssues) {
    const err = new Error(`${totalIssues} issue(s) found across ${changes.length} change(s).`);
    err.remediation = 'Fix the items above, then re-run validate.';
    throw err;
  }
}

function out(s) {
  process.stdout.write(s + '\n');
}
