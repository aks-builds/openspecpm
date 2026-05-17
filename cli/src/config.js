import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const CONFIG_DIR = '.openspecpm';
const CONFIG_FILE = 'config.json';
const STATE_FILE = 'state.json';

export const SCHEMA_VERSION = 1;

export function configPath(cwd = process.cwd()) {
  return join(cwd, CONFIG_DIR, CONFIG_FILE);
}

export function statePath(cwd = process.cwd()) {
  return join(cwd, CONFIG_DIR, STATE_FILE);
}

export async function readConfig(cwd = process.cwd()) {
  const p = configPath(cwd);
  if (!existsSync(p)) return null;
  return JSON.parse(await readFile(p, 'utf8'));
}

export async function writeConfig(config, cwd = process.cwd()) {
  const p = configPath(cwd);
  await mkdir(dirname(p), { recursive: true });
  const payload = { schema_version: SCHEMA_VERSION, ...config };
  await writeFile(p, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return p;
}

export async function readState(cwd = process.cwd()) {
  const p = statePath(cwd);
  if (!existsSync(p)) return {};
  return JSON.parse(await readFile(p, 'utf8'));
}

export async function writeState(state, cwd = process.cwd()) {
  const p = statePath(cwd);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(state, null, 2) + '\n', 'utf8');
}
