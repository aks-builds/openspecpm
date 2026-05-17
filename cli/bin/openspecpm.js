#!/usr/bin/env node
import { Command } from 'commander';
import { audited } from '../src/audit.js';
import { runInit } from '../src/commands/init.js';
import { runDoctor } from '../src/commands/doctor.js';
import { runPropose } from '../src/commands/propose.js';
import { runDecompose } from '../src/commands/decompose.js';
import { runSync } from '../src/commands/sync.js';
import { runComment } from '../src/commands/comment.js';
import { runReconcile } from '../src/commands/reconcile.js';
import { runStatus } from '../src/commands/status.js';
import { runStandup } from '../src/commands/standup.js';
import { runNext } from '../src/commands/next.js';
import { runBlocked } from '../src/commands/blocked.js';
import { runValidate } from '../src/commands/validate.js';
import { runSearch } from '../src/commands/search.js';
import { runFanOut } from '../src/commands/fan-out.js';
import { runBugReport } from '../src/commands/bug-report.js';
import { runShip } from '../src/commands/ship.js';
import { runHelp } from '../src/commands/help.js';

const program = new Command();

program
  .name('openspecpm')
  .description('Spec-driven, BDD-shaped project management for AI agents.')
  .version('0.1.0-alpha.0');

program
  .command('init')
  .description('Interactive wizard: pick a PM tool and write .openspecpm/config.json')
  .option('--non-interactive', 'Fail instead of prompting when input is required')
  .action((opts) => audited('init', runInit)(opts).catch(fatal));

program
  .command('doctor [adapter]')
  .description('Check auth + tooling health for one or all adapters')
  .action((adapter) => audited('doctor', runDoctor)({ adapter }).catch(fatal));

program
  .command('propose <feature>')
  .description('Create an OpenSpec proposal (proposal.md, design.md, tasks.md, specs/) for <feature>')
  .option('-p, --prompt <text>', 'One-line description for the AI to seed the proposal')
  .action((feature, opts) => audited('propose', runPropose)({ feature, prompt: opts.prompt }).catch(fatal));

program
  .command('decompose <feature>')
  .description('Extract tasks from proposal + BDD scenarios into tasks.md')
  .option('--force', 'Merge into an existing tasks.md instead of refusing')
  .action((feature, opts) => audited('decompose', runDecompose)({ feature, force: opts.force }).catch(fatal));

program
  .command('sync <feature>')
  .description('Push an OpenSpec change to the configured PM tool (idempotent; BDD-linted)')
  .option('--dry-run', 'Print the call plan without making remote changes')
  .option('--force', 'Bypass BDD lint errors')
  .action((feature, opts) => audited('sync', runSync)({ feature, dryRun: opts.dryRun, force: opts.force }).catch(fatal));

program
  .command('comment <feature> <task>')
  .description('Post a progress comment to the PM tool work item')
  .option('-m, --message <text>', 'Inline message (otherwise reads from local progress.md)')
  .option('--dry-run', 'Print the comment instead of posting')
  .action((feature, task, opts) =>
    audited('comment', runComment)({ feature, task, message: opts.message, dryRun: opts.dryRun }).catch(fatal),
  );

program
  .command('reconcile <feature>')
  .description('Pull remote state back into local task frontmatter')
  .option('--dry-run', 'Show drift without writing local changes')
  .action((feature, opts) => audited('reconcile', runReconcile)({ feature, dryRun: opts.dryRun }).catch(fatal));

program
  .command('status')
  .description('Local snapshot: configured adapter + per-change task counts')
  .action(() => audited('status', runStatus)().catch(fatal));

program
  .command('standup')
  .description('Show progress updates within a recent window')
  .option('--since <window>', 'Time window: e.g. 12h, 2d, 1w', '24h')
  .action((opts) => audited('standup', runStandup)({ since: opts.since }).catch(fatal));

program
  .command('next')
  .description('List tasks ready to start (no unmet dependencies)')
  .option('-l, --limit <n>', 'Max items to show', (v) => parseInt(v, 10), 5)
  .action((opts) => audited('next', runNext)({ limit: opts.limit }).catch(fatal));

program
  .command('blocked')
  .description('List tasks waiting on unmet dependencies')
  .action(() => audited('blocked', runBlocked)().catch(fatal));

program
  .command('validate')
  .description('Schema + dependency + BDD-lint sweep across every change')
  .action(() => audited('validate', runValidate)().catch(fatal));

program
  .command('search <query>')
  .description('Grep across proposals, specs, tasks, and progress notes')
  .option('-l, --limit <n>', 'Max matches to show', (v) => parseInt(v, 10), 50)
  .option('--case-sensitive', 'Match case')
  .action((query, opts) =>
    audited('search', runSearch)({ query, limit: opts.limit, caseSensitive: opts.caseSensitive }).catch(fatal),
  );

program
  .command('fan-out <feature>')
  .description('Emit ready-to-paste agent prompts for parallel:true tasks')
  .option('-l, --limit <n>', 'Max prompts to emit', (v) => parseInt(v, 10), 5)
  .action((feature, opts) => audited('fan-out', runFanOut)({ feature, limit: opts.limit }).catch(fatal));

program
  .command('bug-report <feature> <task>')
  .description('File a regression bug linked to a shipped task')
  .option('-t, --title <text>', 'Bug title (required)')
  .option('-b, --body <text>', 'Bug body')
  .action((feature, task, opts) =>
    audited('bug-report', runBugReport)({ feature, task, title: opts.title, body: opts.body }).catch(fatal),
  );

program
  .command('ship <feature>')
  .description('Close all work items for <feature> and archive the OpenSpec change')
  .option('-y, --yes', 'Skip the confirmation prompt')
  .option('--skip-archive', 'Close work items but leave openspec/changes/<feature>/ in place')
  .action((feature, opts) =>
    audited('ship', runShip)({ feature, yes: opts.yes, skipArchive: opts.skipArchive }).catch(fatal),
  );

program
  .command('help-table [topic]')
  .description('Context-aware help grouped by workflow phase')
  .action((topic) => { runHelp({ topic }); });

program.parseAsync(process.argv);

function fatal(err) {
  process.stderr.write(`\n✖ ${err.message}\n`);
  if (err.remediation) process.stderr.write(`  → ${err.remediation}\n`);
  process.exit(1);
}
