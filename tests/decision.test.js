import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPerformanceMatrix,
  createDecisionCase,
  objectivePasses,
  performanceValue,
  robustCandidate,
  summarizeStrategies,
  validateDecisionCase,
  vulnerabilityMap,
} from '../site/src/lib/decision.js';

test('reference decision case is structurally valid', () => {
  const decision = createDecisionCase();
  const result = validateDecisionCase(decision);
  assert.equal(result.valid, true);
  assert.equal(decision.objectives.length, 4);
  assert.equal(decision.strategies.length, 3);
  assert.equal(decision.scenarios.length, 4);
});

test('strategy-specific scenario modifiers are transparent and bounded', () => {
  const decision = createDecisionCase();
  const strategy = decision.strategies.find((item) => item.strategy_id === 'STR-003');
  const scenario = decision.scenarios.find((item) => item.scenario_id === 'SCN-004');
  assert.equal(performanceValue(strategy, scenario, 'OBJ-002'), 45);
});

test('threshold logic remains objective-specific', () => {
  assert.equal(objectivePasses(60, { threshold: 60, direction: 'at-least' }), true);
  assert.equal(objectivePasses(61, { threshold: 60, direction: 'at-most' }), false);
});

test('performance matrix covers every strategy, scenario, and objective', () => {
  const decision = createDecisionCase();
  const matrix = buildPerformanceMatrix(decision);
  assert.equal(matrix.length, 3 * 4 * 4);
});

test('staged deployment is the robust candidate in the reference case', () => {
  const decision = createDecisionCase();
  const candidate = robustCandidate(decision);
  assert.equal(candidate.strategy_id, 'STR-003');
  assert.ok(candidate.worst_case_pass_rate >= 0.75);
});

test('vulnerability map exposes the constrained-funding weakness', () => {
  const decision = createDecisionCase();
  const map = vulnerabilityMap(decision, 'STR-003');
  const constrained = map.find((item) => item.scenario_id === 'SCN-004');
  assert.equal(constrained.vulnerable, true);
  assert.ok(constrained.failures.some((item) => item.objective_id === 'OBJ-002'));
});

test('summaries preserve critical failure counts rather than hiding them in one score', () => {
  const decision = createDecisionCase();
  const summaries = summarizeStrategies(decision);
  assert.equal(summaries.length, 3);
  assert.ok(summaries.every((item) => Number.isInteger(item.critical_failure_count)));
});

test('scenario effects can differ by strategy in the same future', () => {
  const decision = createDecisionCase();
  const scenario = decision.scenarios.find((item) => item.scenario_id === 'SCN-001');
  const reanalyze = decision.strategies.find((item) => item.strategy_id === 'STR-001');
  const immediate = decision.strategies.find((item) => item.strategy_id === 'STR-002');
  assert.equal(performanceValue(reanalyze, scenario, 'OBJ-001'), 30);
  assert.equal(performanceValue(immediate, scenario, 'OBJ-001'), 40);
});

test('critical-objective failure futures gate the machine candidate', () => {
  const decision = createDecisionCase();
  decision.objectives = [
    { objective_id: 'OBJ-C', label: 'Critical', threshold: 60, direction: 'at-least', critical: true },
    { objective_id: 'OBJ-N', label: 'Noncritical', threshold: 60, direction: 'at-least', critical: false },
  ];
  decision.strategies = [
    { strategy_id: 'STR-A', label: 'A', description: 'A', baseline: { 'OBJ-C': 50, 'OBJ-N': 100 }, action_now: 'A', monitor: 'A', trigger: 'A', contingency: 'A' },
    { strategy_id: 'STR-B', label: 'B', description: 'B', baseline: { 'OBJ-C': 60, 'OBJ-N': 0 }, action_now: 'B', monitor: 'B', trigger: 'B', contingency: 'B' },
  ];
  decision.scenarios = [
    { scenario_id: 'SCN-A', label: 'A', description: 'A', states: { 'UNC-001': 'low', 'UNC-002': 'explained', 'UNC-003': 'adequate' }, strategy_modifiers: { 'STR-A': { 'OBJ-C': 0, 'OBJ-N': 0 }, 'STR-B': { 'OBJ-C': 0, 'OBJ-N': 0 } } },
    { scenario_id: 'SCN-B', label: 'B', description: 'B', states: { 'UNC-001': 'high', 'UNC-002': 'unresolved', 'UNC-003': 'adequate' }, strategy_modifiers: { 'STR-A': { 'OBJ-C': 0, 'OBJ-N': 0 }, 'STR-B': { 'OBJ-C': 0, 'OBJ-N': 0 } } },
  ];
  decision.human_decision.selected_strategy_id = 'STR-B';
  assert.equal(robustCandidate(decision).strategy_id, 'STR-B');
});

test('human rationale and next action are mandatory', () => {
  const decision = createDecisionCase();
  decision.human_decision.rationale = '';
  decision.human_decision.next_action = '';
  const result = validateDecisionCase(decision);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('rationale')));
  assert.ok(result.errors.some((error) => error.includes('next action')));
});

test('scenario states must match declared uncertainty states', () => {
  const decision = createDecisionCase();
  decision.scenarios[0].states['UNC-001'] = 'invented-state';
  const result = validateDecisionCase(decision);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('invalid or missing state')));
});

test('duplicate decision entity IDs are rejected', () => {
  const decision = createDecisionCase();
  decision.objectives[1].objective_id = decision.objectives[0].objective_id;
  const result = validateDecisionCase(decision);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Objective IDs must be unique')));
});

test('decision interface exposes all six renderers', async () => {
  const { decisionStepRenderers } = await import('../site/src/decision-ui.js');
  assert.equal(decisionStepRenderers.length, 6);
  assert.ok(decisionStepRenderers.every((renderer) => typeof renderer === 'function'));
});

test('exported decision brief preserves assumptions, vulnerabilities, and adaptive controls', async () => {
  const { buildDecisionHtml } = await import('../site/src/decision-ui.js');
  const html = buildDecisionHtml(createDecisionCase());
  assert.match(html, /<h3>Assumed<\/h3>/);
  assert.match(html, /Selected-strategy vulnerabilities/);
  assert.match(html, /<h3>Monitor<\/h3>/);
  assert.match(html, /<h3>Contingencies<\/h3>/);
  assert.match(html, /Reassessment:/);
});


test('machine candidate discloses critical gaps in the exported brief', async () => {
  const { buildDecisionHtml } = await import('../site/src/decision-ui.js');
  const html = buildDecisionHtml(createDecisionCase());
  assert.match(html, /critical gaps in 2 included futures/);
});
