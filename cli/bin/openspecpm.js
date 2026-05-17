#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from '../src/commands/init.js';
import { runDoctor } from '../src/commands/doctor.js';
import { runPropose } from '../src/commands/propose.js';
import { runSync } from '../src/commands/sync.js';
import { runStatus } from '../src/commands/status.js';

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
  .description('Push an OpenSpec change to the configured PM tool (idempotent)')
  .option('--dry-run', 'Print the call plan without making remote changes')
  .option('--force', 'Bypass BDD lint blocks (Sprint 3+)')
  .action((feature, opts) => runSync({ feature, dryRun: opts.dryRun, force: opts.force }).catch(fatal));

program
  .command('status')
  .description('Local + remote status snapshot')
  .action(() => runStatus().catch(fatal));

program.parseAsync(process.argv);

function fatal(err) {
  process.stderr.write(`\n✖ ${err.message}\n`);
  if (err.remediation) process.stderr.write(`  → ${err.remediation}\n`);
  process.exit(1);
}
