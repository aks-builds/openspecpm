import test from 'node:test';
import assert from 'node:assert/strict';
import { proposalTemplate, specsTemplate, CHANGE_TYPES } from '../src/bdd/templates.js';

test('proposalTemplate emits frontmatter with correct type', () => {
  for (const type of CHANGE_TYPES) {
    const md = proposalTemplate(type, 'demo');
    assert.match(md, new RegExp(`type: ${type}`));
    assert.match(md, /name: demo/);
    assert.match(md, /schema_version: 1/);
  }
});

test('unknown type falls back to feature', () => {
  const md = proposalTemplate('nonsense', 'x');
  assert.match(md, /type: feature/);
});

test('bug template includes severity field', () => {
  const md = proposalTemplate('bug', 'leak');
  assert.match(md, /severity:/);
  assert.match(md, /# Bug: leak/);
});

test('incident template has timeline table', () => {
  const md = proposalTemplate('incident', 'outage-2026-05');
  assert.match(md, /## Timeline/);
});

test('specsTemplate(bug) uses regression-friendly wording', () => {
  const md = specsTemplate('bug');
  assert.match(md, /Regression scenarios/);
});
