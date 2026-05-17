import { execa } from 'execa';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const OPENSPEC_MIN_VERSION = '0.4.0';
export const OPENSPEC_CHANGES_DIR = 'openspec/changes';
export const OPENSPEC_ARCHIVE_DIR = 'openspec/archive';

export class OpenSpecError extends Error {
  constructor(message, { remediation } = {}) {
    super(message);
    this.name = 'OpenSpecError';
    this.remediation = remediation;
  }
}

function compareSemver(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10));
  const pb = b.split('.').map((n) => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export async function probe({ runner = execa } = {}) {
  let stdout;
  try {
    ({ stdout } = await runner('openspec', ['--version']));
  } catch (err) {
    throw new OpenSpecError('OpenSpec CLI not found on PATH.', {
      remediation: 'Install it with `npm install -g @fission-ai/openspec`, then re-run.',
    });
  }
  const m = stdout.match(/(\d+\.\d+\.\d+)/);
  if (!m) {
    throw new OpenSpecError(`Could not parse OpenSpec version from: ${stdout}`, {
      remediation: 'Upgrade OpenSpec to a version that supports `openspec --version`.',
    });
  }
  const version = m[1];
  if (compareSemver(version, OPENSPEC_MIN_VERSION) < 0) {
    throw new OpenSpecError(`OpenSpec ${version} is below the required minimum ${OPENSPEC_MIN_VERSION}.`, {
      remediation: `Upgrade with \`npm install -g @fission-ai/openspec@>=${OPENSPEC_MIN_VERSION}\`.`,
    });
  }
  return { version };
}

export function changeDir(feature, cwd = process.cwd()) {
  return join(cwd, OPENSPEC_CHANGES_DIR, feature);
}

export function changeExists(feature, cwd = process.cwd()) {
  return existsSync(changeDir(feature, cwd));
}

export async function propose(feature, prompt, { runner = execa, cwd = process.cwd() } = {}) {
  await probe({ runner });
  await runner('openspec', ['propose', feature, '--prompt', prompt], { cwd, stdio: 'inherit' });
  return changeDir(feature, cwd);
}
