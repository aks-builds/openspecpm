import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { judgeChange } from '../src/bdd/judge.js';

async function withFeature(specs, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'openspecpm-judge-'));
  try {
    const specsDir = join(dir, 'specs');
    await mkdir(specsDir, { recursive: true });
    for (const [name, body] of Object.entries(specs)) {
      await writeFile(join(specsDir, name), body, 'utf8');
    }
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function stubClient(responses) {
  const calls = [];
  let i = 0;
  const client = {
    messages: {
      create: async (opts) => {
        calls.push(opts);
        const resp = typeof responses === 'function' ? responses(opts, i) : responses[Math.min(i, responses.length - 1)];
        i++;
        return resp;
      },
    },
  };
  return { client, calls };
}

function toolUseResponse(findings, usage = {}) {
  return {
    content: [
      { type: 'tool_use', name: 'report_findings', input: { findings } },
    ],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      ...usage,
    },
  };
}

test('judgeChange returns findings in LintFinding shape', async () => {
  await withFeature({ 'a.md': '# Spec\nScenario: X\n  Given a\n  When b\n  Then c\n' }, async (dir) => {
    const { client } = stubClient([
      toolUseResponse([
        {
          severity: 'error',
          line: 2,
          scenario: 'X',
          rule: 'bdd/llm-contradiction',
          message: 'Contradicts spec b.md scenario Y',
        },
      ]),
    ]);
    const findings = await judgeChange(dir, { client, model: 'claude-haiku-4-5', proposal: 'p' });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.severity, 'error');
    assert.equal(f.rule, 'bdd/llm-contradiction');
    assert.equal(f.scenario, 'X');
    assert.equal(f.line, 2);
    assert.ok(f.file.endsWith('a.md'));
    assert.ok(typeof f.message === 'string');
  });
});

test('judgeChange degrades gracefully on missing tool_use', async () => {
  await withFeature({ 'a.md': 'Scenario: X\n' }, async (dir) => {
    const { client } = stubClient([{ content: [{ type: 'text', text: 'sorry' }], usage: {} }]);
    const findings = await judgeChange(dir, { client, proposal: '' });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, 'bdd/llm-parse-error');
    assert.equal(findings[0].severity, 'warning');
  });
});

test('judgeChange degrades gracefully on SDK error', async () => {
  await withFeature({ 'a.md': 'Scenario: X\n' }, async (dir) => {
    const client = {
      messages: { create: async () => { throw new Error('rate limited'); } },
    };
    const findings = await judgeChange(dir, { client, proposal: '' });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, 'bdd/llm-parse-error');
    assert.match(findings[0].message, /rate limited/);
  });
});

test('judgeChange filters findings with unknown rule names', async () => {
  await withFeature({ 'a.md': 'Scenario: X\n' }, async (dir) => {
    const { client } = stubClient([
      toolUseResponse([
        { severity: 'error', line: 1, scenario: 'X', rule: 'bdd/llm-contradiction', message: 'real' },
        { severity: 'error', line: 1, scenario: 'X', rule: 'bdd/made-up-rule', message: 'fake' },
        { severity: 'critical', line: 1, scenario: 'X', rule: 'bdd/llm-vague-then', message: 'bad severity' },
      ]),
    ]);
    const findings = await judgeChange(dir, { client, proposal: '' });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, 'bdd/llm-contradiction');
  });
});

test('judgeChange calls onUsage once per spec with token counts', async () => {
  await withFeature(
    { 'a.md': 'Scenario: X\n', 'b.md': 'Scenario: Y\n' },
    async (dir) => {
      const { client } = stubClient([
        toolUseResponse([], { input_tokens: 100, cache_creation_input_tokens: 50 }),
        toolUseResponse([], { input_tokens: 20, cache_read_input_tokens: 80 }),
      ]);
      const usages = [];
      await judgeChange(dir, { client, proposal: 'p', onUsage: (u) => usages.push(u) });
      assert.equal(usages.length, 2);
      assert.ok(usages.every((u) => u.model && typeof u.input_tokens === 'number'));
    },
  );
});

test('judgeChange sets cache_control on the proposal system block', async () => {
  await withFeature({ 'a.md': 'Scenario: X\n' }, async (dir) => {
    const { client, calls } = stubClient([toolUseResponse([])]);
    await judgeChange(dir, { client, proposal: 'proposal body' });
    assert.equal(calls.length, 1);
    const system = calls[0].system;
    assert.ok(Array.isArray(system));
    const proposalBlock = system.find((b) => b.text.includes('proposal body'));
    assert.ok(proposalBlock, 'proposal block exists');
    assert.deepEqual(proposalBlock.cache_control, { type: 'ephemeral' });
  });
});

test('judgeChange fans out across multiple specs', async () => {
  await withFeature(
    { 'a.md': 'Scenario: A\n', 'b.md': 'Scenario: B\n', 'c.md': 'Scenario: C\n' },
    async (dir) => {
      const { client, calls } = stubClient([toolUseResponse([])]);
      await judgeChange(dir, { client, proposal: '' });
      assert.equal(calls.length, 3);
    },
  );
});

test('judgeChange returns empty when no specs/ directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openspecpm-judge-empty-'));
  try {
    const { client, calls } = stubClient([toolUseResponse([])]);
    const findings = await judgeChange(dir, { client, proposal: '' });
    assert.deepEqual(findings, []);
    assert.equal(calls.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
