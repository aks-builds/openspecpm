import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_MODEL = 'claude-haiku-4-5';
export const DEFAULT_MAX_FINDINGS_PER_SPEC = 8;
const MAX_CONCURRENT = 5;

const ALLOWED_RULES = new Set([
  'bdd/llm-contradiction',
  'bdd/llm-missing-coverage',
  'bdd/llm-vague-then',
]);

const ALLOWED_SEVERITY = new Set(['error', 'warning']);

const REPORT_TOOL = {
  name: 'report_findings',
  description:
    'Report BDD scenario findings as a structured list. Each finding flags a specific defect that the heuristic linter cannot catch: cross-spec contradictions, missing coverage against success criteria, or vague Then predicates that pass regex checks but state no observable outcome.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            severity: { type: 'string', enum: ['error', 'warning'] },
            line: { type: 'integer', minimum: 1 },
            scenario: { type: 'string' },
            rule: {
              type: 'string',
              enum: ['bdd/llm-contradiction', 'bdd/llm-missing-coverage', 'bdd/llm-vague-then'],
            },
            message: { type: 'string' },
          },
          required: ['severity', 'scenario', 'rule', 'message'],
        },
      },
    },
    required: ['findings'],
  },
};

const SYSTEM_PROMPT = `You are a BDD scenario reviewer. You augment a heuristic linter by catching defects it cannot see: cross-spec contradictions, missing coverage of declared success criteria, and Then predicates that state no observable outcome. You are reviewing one spec file at a time, with the full feature proposal as context.

Rules:
- Use the report_findings tool exactly once.
- Only emit findings for the three rules: bdd/llm-contradiction, bdd/llm-missing-coverage, bdd/llm-vague-then.
- Each finding must name the specific scenario by title and include the line number where the issue appears.
- bdd/llm-contradiction: a scenario contradicts another scenario in the same file or another spec referenced in the proposal.
- bdd/llm-missing-coverage: the proposal's success criteria contain a requirement with no scenario covering it.
- bdd/llm-vague-then: a Then predicate uses an observable verb but its outcome is not actually checkable (e.g. "Then the user receives confirmation" with no detail on what confirmation).
- Severity error for contradictions and uncovered hard requirements; severity warning for vague Thens and uncovered nice-to-haves.
- Empty findings array is the correct output when the spec is clean.
- Never invent rule names. Never include findings outside the three rules above.`;

export async function judgeChange(featureDir, opts = {}) {
  const {
    client,
    model = DEFAULT_MODEL,
    proposal = '',
    maxFindingsPerSpec = DEFAULT_MAX_FINDINGS_PER_SPEC,
    onUsage,
  } = opts;

  if (!client) throw new Error('judge: client is required');

  const specsDir = join(featureDir, 'specs');
  if (!existsSync(specsDir)) return [];

  const files = (await readdir(specsDir)).filter((f) => f.endsWith('.md'));
  if (!files.length) return [];

  const tasks = files.map((f) => () =>
    judgeSpec(join(specsDir, f), { client, model, proposal, maxFindingsPerSpec, onUsage }),
  );

  const results = await runBounded(tasks, MAX_CONCURRENT);
  return results.flat();
}

async function judgeSpec(file, { client, model, proposal, maxFindingsPerSpec, onUsage }) {
  let specSource;
  try {
    specSource = await readFile(file, 'utf8');
  } catch (err) {
    return [{
      severity: 'warning',
      file,
      line: 1,
      scenario: '(read failed)',
      rule: 'bdd/llm-parse-error',
      message: `Could not read spec file: ${err.message}`,
    }];
  }

  const userPrompt = `Review the following BDD spec file. Use report_findings to report up to ${maxFindingsPerSpec} findings.

<spec file="${file}">
${specSource}
</spec>`;

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 4096,
      tools: [REPORT_TOOL],
      tool_choice: { type: 'tool', name: 'report_findings' },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
        },
        {
          type: 'text',
          text: `Feature proposal (shared context across every spec in this feature):\n\n${proposal || '(no proposal.md available)'}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });
  } catch (err) {
    return [{
      severity: 'warning',
      file,
      line: 1,
      scenario: '(judge failed)',
      rule: 'bdd/llm-parse-error',
      message: `LLM judge call failed: ${err.message}`,
    }];
  }

  if (onUsage && response?.usage) {
    try {
      onUsage({
        file,
        model,
        input_tokens: response.usage.input_tokens ?? 0,
        output_tokens: response.usage.output_tokens ?? 0,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      });
    } catch { /* never break the judge on telemetry */ }
  }

  return extractFindings(response, file);
}

function extractFindings(response, file) {
  const toolUse = (response?.content ?? []).find(
    (b) => b.type === 'tool_use' && b.name === 'report_findings',
  );
  if (!toolUse) {
    return [{
      severity: 'warning',
      file,
      line: 1,
      scenario: '(no findings reported)',
      rule: 'bdd/llm-parse-error',
      message: 'LLM did not call report_findings tool.',
    }];
  }
  const raw = toolUse.input?.findings;
  if (!Array.isArray(raw)) {
    return [{
      severity: 'warning',
      file,
      line: 1,
      scenario: '(malformed response)',
      rule: 'bdd/llm-parse-error',
      message: 'report_findings input was not a findings array.',
    }];
  }
  const out = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    if (!ALLOWED_RULES.has(f.rule)) continue;
    if (!ALLOWED_SEVERITY.has(f.severity)) continue;
    if (typeof f.scenario !== 'string' || !f.scenario) continue;
    if (typeof f.message !== 'string' || !f.message) continue;
    out.push({
      severity: f.severity,
      file,
      line: Number.isInteger(f.line) && f.line > 0 ? f.line : undefined,
      scenario: f.scenario,
      rule: f.rule,
      message: f.message,
    });
  }
  return out;
}

async function runBounded(tasks, limit) {
  const results = new Array(tasks.length);
  let i = 0;
  const workers = new Array(Math.min(limit, tasks.length)).fill(0).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= tasks.length) return;
      results[idx] = await tasks[idx]();
    }
  });
  await Promise.all(workers);
  return results;
}

export function defaultClient() {
  return import('@anthropic-ai/sdk').then(({ default: Anthropic }) => {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  });
}
