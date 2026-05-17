import { readConfig } from '../config.js';
import { loadAdapter, listAdapters, resolveAdapter } from '../adapters/index.js';
import { probe, OpenSpecError } from '../openspec-bridge.js';
import { installCommand, patSetup, osName } from '../install-hints.js';

export async function runDoctor({ adapter, install = false, setupAuth = false } = {}) {
  process.stdout.write('openspecpm doctor\n\n');

  // OpenSpec health
  try {
    const { version } = await probe();
    line(true, `OpenSpec ${version} on PATH`);
  } catch (err) {
    if (err instanceof OpenSpecError) {
      line(false, err.message, err.remediation);
      if (install) suggestInstall('openspec');
    } else {
      throw err;
    }
  }

  const config = await readConfig();
  const adapters = adapter
    ? [resolveAdapter(adapter)]
    : (config ? [resolveAdapter(config.adapter)] : listAdapters());

  for (const name of adapters) {
    process.stdout.write(`\n[${name}]\n`);
    const cfg = config && resolveAdapter(config.adapter) === name ? config : {};
    const a = loadAdapter(name, cfg);
    const findings = await a.doctor();
    for (const f of findings) line(f.ok, f.msg, f.remediation);
    if (install) suggestAdapterInstall(name);
    if (setupAuth) suggestAuth(name);
  }
}

function line(ok, msg, remediation) {
  process.stdout.write(`  ${ok ? '✓' : '✖'} ${msg}\n`);
  if (!ok && remediation) process.stdout.write(`    → ${remediation}\n`);
}

function suggestInstall(tool) {
  const cmd = installCommand(tool);
  if (!cmd) return;
  process.stdout.write(`    → on ${osName()}: ${cmd}\n`);
}

function suggestAdapterInstall(name) {
  if (name === 'github') suggestInstall('gh');
  if (name === 'azure') suggestInstall('az');
  // Linear, GitLab, Jira use REST directly — no CLI required.
}

function suggestAuth(adapterName) {
  const info = patSetup(adapterName);
  if (!info) return;
  process.stdout.write(`    auth setup:\n`);
  process.stdout.write(`      • create token at: ${info.url}\n`);
  process.stdout.write(`      • required scopes: ${info.scopes}\n`);
}
