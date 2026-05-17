import test from 'node:test';
import assert from 'node:assert/strict';
import { lintSource, parseScenarios, summarize } from '../src/bdd/linter.js';

test('parseScenarios extracts title and steps', () => {
  const src = `# Specs

Scenario: User toggles dark mode
  Given the user is signed in
  When they select "Dark" in the menu
  Then the UI renders in dark theme
`;
  const sc = parseScenarios(src);
  assert.equal(sc.length, 1);
  assert.equal(sc[0].title, 'User toggles dark mode');
  assert.equal(sc[0].steps.length, 3);
  assert.deepEqual(sc[0].steps.map((s) => s.keyword), ['Given', 'When', 'Then']);
});

test('clean scenario produces no findings', () => {
  const src = `Scenario: User saves a preference
  Given the user is signed in
  When they click Save
  Then the system stores the new preference
`;
  const findings = lintSource(src);
  assert.equal(summarize(findings).errors, 0);
});

test('missing Then is reported as error', () => {
  const src = `Scenario: Half-formed
  Given a user
  When they click
`;
  const findings = lintSource(src);
  const missing = findings.find((f) => f.rule === 'bdd/missing-step' && f.message.includes('Then'));
  assert.ok(missing);
  assert.equal(missing.severity, 'error');
});

test('deny-listed Then phrase is an error', () => {
  const src = `Scenario: Vague
  Given a system
  When the user runs it
  Then it should work
`;
  const findings = lintSource(src);
  const denied = findings.find((f) => f.rule === 'bdd/vague-then');
  assert.ok(denied);
  assert.equal(denied.severity, 'error');
});

test('tautological Then (paraphrase of When) is an error', () => {
  const src = `Scenario: Echo
  Given a user
  When the user clicks the save button
  Then the user clicks the save button
`;
  const findings = lintSource(src);
  const taut = findings.find((f) => f.rule === 'bdd/tautological-then');
  assert.ok(taut);
});

test('weak When verb is a warning, not an error', () => {
  const src = `Scenario: State verb
  Given a thing
  When is happening
  Then the system records an event
`;
  const findings = lintSource(src);
  const weak = findings.find((f) => f.rule === 'bdd/weak-when');
  assert.ok(weak);
  assert.equal(weak.severity, 'warning');
});

test('non-observable Then is a warning', () => {
  const src = `Scenario: Vibes only
  Given a user
  When they click submit
  Then everyone feels great
`;
  const findings = lintSource(src);
  const nonobs = findings.find((f) => f.rule === 'bdd/non-observable-then');
  assert.ok(nonobs);
  assert.equal(nonobs.severity, 'warning');
});

test('empty source produces no findings', () => {
  assert.deepEqual(lintSource(''), []);
});
