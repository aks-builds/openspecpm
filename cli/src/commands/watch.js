import { watch } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { changeDir, changeExists } from '../openspec-bridge.js';
import { lintChange, summarize, formatFindings } from '../bdd/linter.js';
import { runValidate } from './validate.js';

export async function runWatch({ feature, allChanges = false, debounceMs = 300 } = {}) {
  if (!feature && !allChanges) throw new Error('feature name is required (or pass --all)');
  if (feature && !changeExists(feature)) throw new Error(`OpenSpec change "${feature}" not found.`);

  const targets = allChanges ? [] : [feature];
  const watchedDir = allChanges
    ? join(process.cwd(), 'openspec', 'changes')
    : changeDir(feature);
  if (!existsSync(watchedDir)) {
    throw new Error(`Cannot watch — directory does not exist: ${watchedDir}`);
  }

  process.stdout.write(`openspecpm watch — ${allChanges ? 'all changes' : feature}\n`);
  process.stdout.write(`Watching ${watchedDir} (Ctrl-C to stop)\n\n`);

  let timer = null;
  let pending = new Set();

  const rerun = async () => {
    timer = null;
    const changed = [...pending];
    pending.clear();
    process.stdout.write(`\n[${new Date().toISOString().slice(11, 19)}] re-checking after change to: ${changed.slice(0, 3).join(', ')}${changed.length > 3 ? '…' : ''}\n`);
    try {
      if (allChanges) {
        await runValidate();
      } else {
        const findings = await lintChange(changeDir(feature));
        const sum = summarize(findings);
        if (sum.total === 0) {
          process.stdout.write('  ✓ BDD lint clean.\n');
        } else {
          process.stdout.write(`  ${sum.errors} errors, ${sum.warnings} warnings\n`);
          process.stdout.write(formatFindings(findings));
        }
      }
    } catch (err) {
      process.stderr.write(`  ✖ ${err.message}\n`);
    }
  };

  const watcher = watch(watchedDir, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    pending.add(filename);
    if (timer) clearTimeout(timer);
    timer = setTimeout(rerun, debounceMs);
  });

  // Initial run.
  await rerun();

  // Hold the process open until interrupted.
  await new Promise((resolve) => {
    process.on('SIGINT', () => {
      watcher.close();
      process.stdout.write('\n\nStopped watching.\n');
      resolve();
    });
  });
}
