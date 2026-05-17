#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from '../src/commands/init.js';
import { runDoctor } from '../src/commands/doctor.js';
import { runPropose } from '../src/commands/propose.js';
import { runSync } from '../src/commands/sync.js';
import { runStatus } from '../src/commands/status.js';
import { runStandup } from '../src/commands/standup.js';
import { runNext } from '../src/commands/next.js';
import { runBlocked } from '../src/commands/blocked.js';
import { runShip } from '../src/commands/ship.js';

const program = new Command();

program
  .name('openspecpm')
  .description('Spec-driven, BDD-shaped project management for AI agents.')
  .version('0.1.0-alpha.0');

program
  .command('init')
  .description('Interactive wizard: pick a PM tool and write .openspecpm/config.json')
  .option('--non-interactive', 'Fail instead of prompting when input is required')
  .action((opts) => runInit(opts).catch(fatal));

program
  .command('doctor [adapter]')
  .description('Check auth + tooling health for one or all adapters')
  .action((adapter) => runDoctor({ adapter }).catch(fatal));

program
  .command('propose <feature>')
  .description('Create an OpenSpec proposal (proposal.md, design.md, tasks.md, specs/) for <feature>')
  .option('-p, --prompt <text>', 'One-line description for the AI to seed the proposal')
  .action((feature, opts) => runPropose({ feature, prompt: opts.prompt }).catch(fatal));

program
  .command('sync <feature>')
  .description('Push an OpenSpec change to the configured PM tool (idempotent; BDD-linted)')
  .option('--dry-run', 'Print the call plan without making remote changes')
  .option('--force', 'Bypass BDD lint errors')
  .action((feature, opts) => runSync({ feature, dryRun: opts.dryRun, force: opts.force }).catch(fatal));

program
  .command('status')
  .description('Local snapshot: configured adapter + per-change task counts')
  .action(() => runStatus().catch(fatal));

program
  .command('standup')
  .description('Show progress updates within a recent window')
  .option('--since <window>', 'Time window: e.g. 12h, 2d, 1w', '24h')
  .action((opts) => runStandup({ since: opts.since }).catch(fatal));

program
  .command('next')
  .description('List tasks ready to start (no unmet dependencies)')
  .option('-l, --limit <n>', 'Max items to show', (v) => parseInt(v, 10), 5)
  .action((opts) => runNext({ limit: opts.limit }).catch(fatal));

program
  .command('blocked')
  .description('List tasks waiting on unmet dependencies')
  .action(() => runBlocked().catch(fatal));

program
  .command('ship <feature>')
  .description('Close all work items for <feature> and archive the OpenSpec change')
  .option('-y, --yes', 'Skip the confirmation prompt')
  .option('--skip-archive', 'Close work items but leave openspec/changes/<feature>/ in place')
  .action((feature, opts) => runShip({ feature, yes: opts.yes, skipArchive: opts.skipArchive }).catch(fatal));

program.parseAsync(process.argv);

function fatal(err) {
  process.stderr.write(`\n✖ ${err.message}\n`);
  if (err.remediation) process.stderr.write(`  → ${err.remediation}\n`);
  process.exit(1);
}
