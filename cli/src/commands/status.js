import { readConfig } from '../config.js';
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { OPENSPEC_CHANGES_DIR } from '../openspec-bridge.js';

export async function runStatus() {
  const config = await readConfig();
  process.stdout.write('openspecpm status\n\n');
  process.stdout.write(`Adapter: ${config?.adapter ?? '(not configured — run `openspecpm init`)'}\n`);

  const dir = join(process.cwd(), OPENSPEC_CHANGES_DIR);
  if (!existsSync(dir)) {
    process.stdout.write('No OpenSpec changes yet.\n');
    return;
  }
  const entries = await readdir(dir, { withFileTypes: true });
  const changes = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  process.stdout.write(`Changes: ${changes.length}\n`);
  for (const name of changes) process.stdout.write(`  - ${name}\n`);
  process.stdout.write('\nFull standup/blocked/next reports land in Sprint 3.\n');
}
