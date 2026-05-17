import { readConfig } from '../config.js';
import { loadAdapter, listAdapters } from '../adapters/index.js';
import { probe, OpenSpecError } from '../openspec-bridge.js';

export async function runDoctor({ adapter } = {}) {
  process.stdout.write('openspecpm doctor\n\n');

  // OpenSpec health
  try {
    const { version } = await probe();
    line(true, `OpenSpec ${version} on PATH`);
  } catch (err) {
    if (err instanceof OpenSpecError) {
      line(false, err.message, err.remediation);
    } else {
      throw err;
    }
  }

  const config = await readConfig();
  const adapters = adapter ? [adapter] : (config ? [config.adapter] : listAdapters());

  for (const name of adapters) {
    process.stdout.write(`\n[${name}]\n`);
    const cfg = config && config.adapter === name ? config : {};
    const a = loadAdapter(name, cfg);
    const findings = await a.doctor();
    for (const f of findings) line(f.ok, f.msg, f.remediation);
  }
}

function line(ok, msg, remediation) {
  process.stdout.write(`  ${ok ? '✓' : '✖'} ${msg}\n`);
  if (!ok && remediation) process.stdout.write(`    → ${remediation}\n`);
}
