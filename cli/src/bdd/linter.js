import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const OBSERVABLE_VERBS = [
  'displays', 'shows', 'returns', 'stores', 'persists', 'rejects', 'allows',
  'emails', 'sends', 'creates', 'updates', 'deletes', 'renders', 'redirects',
  'logs', 'records', 'enqueues', 'publishes', 'fails', 'succeeds', 'navigates',
  'saves', 'loads', 'increments', 'decrements', 'enables', 'disables', 'closes',
  'opens', 'highlights', 'hides', 'reveals', 'archives', 'restores', 'cancels',
  'rolls', 'commits', 'broadcasts', 'notifies', 'flags', 'tags', 'untags',
  'matches', 'contains', 'equals', 'exceeds', 'is', 'are', 'has', 'have',
  'becomes', 'remains',
];

const DENY_PHRASES = [
  'should work',
  'should be correct',
  'is successful',
  'is fine',
  'works correctly',
  'works as expected',
  'is good',
  'is okay',
];

/**
 * @typedef {Object} LintFinding
 * @property {'error'|'warning'} severity
 * @property {string} file
 * @property {number} [line]
 * @property {string} scenario
 * @property {string} rule
 * @property {string} message
 */

const SCENARIO_RE = /^\s*Scenario:\s*(.+?)\s*$/i;
const STEP_RE = /^\s*(Given|When|Then|And|But)\s+(.+?)\s*$/i;

export function parseScenarios(source) {
  const lines = source.split(/\r?\n/);
  const scenarios = [];
  let current = null;
  let lineNo = 0;
  for (const raw of lines) {
    lineNo++;
    const sMatch = raw.match(SCENARIO_RE);
    if (sMatch) {
      if (current) scenarios.push(current);
      current = { title: sMatch[1], line: lineNo, steps: [] };
      continue;
    }
    if (!current) continue;
    const stepMatch = raw.match(STEP_RE);
    if (stepMatch) {
      current.steps.push({ keyword: titleCase(stepMatch[1]), text: stepMatch[2], line: lineNo });
    }
  }
  if (current) scenarios.push(current);
  return scenarios;
}

function titleCase(s) {
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

export function lintScenario(scenario, { file = '<input>' } = {}) {
  const findings = [];
  const counts = { Given: 0, When: 0, Then: 0 };
  let lastPrimary = null;
  for (const step of scenario.steps) {
    if (['Given', 'When', 'Then'].includes(step.keyword)) {
      counts[step.keyword]++;
      lastPrimary = step.keyword;
    } else if (step.keyword === 'And' || step.keyword === 'But') {
      if (!lastPrimary) {
        findings.push(finding('error', file, step.line, scenario.title, 'bdd/orphan-and', `${step.keyword} step appears before any Given/When/Then.`));
      }
    }
  }
  for (const k of ['Given', 'When', 'Then']) {
    if (counts[k] === 0) {
      findings.push(finding('error', file, scenario.line, scenario.title, 'bdd/missing-step', `Scenario is missing a ${k} step.`));
    }
    if (counts[k] > 1) {
      findings.push(finding('warning', file, scenario.line, scenario.title, 'bdd/multiple-primary', `Scenario has ${counts[k]} ${k} steps — prefer one ${k} plus And-chained steps.`));
    }
  }

  const whens = scenario.steps.filter((s) => s.keyword === 'When');
  for (const w of whens) {
    const first = w.text.trim().split(/\s+/)[0]?.toLowerCase();
    if (!first || /^(is|are|was|were|will)$/.test(first)) {
      findings.push(finding('warning', file, w.line, scenario.title, 'bdd/weak-when', `When clause "${w.text}" should start with an action verb (clicks, submits, requests, …), not a state verb.`));
    }
  }

  const thens = scenario.steps.filter((s) => s.keyword === 'Then');
  for (const t of thens) {
    const lower = t.text.toLowerCase();
    for (const deny of DENY_PHRASES) {
      if (lower.includes(deny)) {
        findings.push(finding('error', file, t.line, scenario.title, 'bdd/vague-then', `Then predicate uses denied phrase "${deny}". State an observable outcome instead.`));
      }
    }
    if (!OBSERVABLE_VERBS.some((v) => new RegExp(`\\b${v}\\b`, 'i').test(t.text))) {
      findings.push(finding('warning', file, t.line, scenario.title, 'bdd/non-observable-then', `Then "${t.text}" lacks an observable verb. Consider: ${OBSERVABLE_VERBS.slice(0, 6).join(', ')}, …`));
    }
  }

  // Tautology check: When and Then with high similarity.
  for (const w of whens) {
    for (const t of thens) {
      if (similarity(w.text, t.text) > 0.8) {
        findings.push(finding('error', file, t.line, scenario.title, 'bdd/tautological-then', `Then "${t.text}" closely paraphrases When "${w.text}". State an outcome distinct from the action.`));
      }
    }
  }

  return findings;
}

export function lintSource(source, { file = '<input>' } = {}) {
  const scenarios = parseScenarios(source);
  if (!scenarios.length) return [];
  const findings = [];
  for (const s of scenarios) findings.push(...lintScenario(s, { file }));
  return findings;
}

export async function lintChange(featureDir) {
  const specsDir = join(featureDir, 'specs');
  if (!existsSync(specsDir)) return [];
  const files = await readdir(specsDir);
  const findings = [];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const full = join(specsDir, f);
    const src = await readFile(full, 'utf8');
    findings.push(...lintSource(src, { file: full }));
  }
  return findings;
}

export function summarize(findings) {
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  return { errors, warnings, total: findings.length };
}

export function formatFindings(findings) {
  if (!findings.length) return '  No BDD findings.\n';
  const lines = [];
  for (const f of findings) {
    const sigil = f.severity === 'error' ? '✖' : '⚠';
    lines.push(`  ${sigil} ${f.file}:${f.line ?? '?'} [${f.rule}] ${f.scenario}: ${f.message}`);
  }
  return lines.join('\n') + '\n';
}

function finding(severity, file, line, scenario, rule, message) {
  return { severity, file, line, scenario, rule, message };
}

// Dice coefficient on word bigrams — small, dependency-free, good enough for paraphrase detection.
function similarity(a, b) {
  const A = bigrams(a.toLowerCase());
  const B = bigrams(b.toLowerCase());
  if (!A.size || !B.size) return 0;
  let overlap = 0;
  for (const g of A) if (B.has(g)) overlap++;
  return (2 * overlap) / (A.size + B.size);
}

function bigrams(s) {
  const words = s.split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i < words.length - 1; i++) {
    out.add(words[i] + ' ' + words[i + 1]);
  }
  if (words.length === 1) out.add(words[0]);
  return out;
}
