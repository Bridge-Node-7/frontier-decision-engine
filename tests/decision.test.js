import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPerformanceMatrix,
  createBlankDecisionCase,
  createDecisionCase,
  objectivePasses,
  performanceValue,
  robustCandidate,
  summarizeStrategies,
  validateDecisionCase,
  validateCompletedDecisionCase,
  validateDraftDecisionCase,
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

test('blank and ready-example factories are isolated bounded decisions', () => {
  const blank = createBlankDecisionCase();
  const ready = createDecisionCase();
  assert.equal(blank.strategies.length, ready.strategies.length);
  assert.equal(blank.scenarios.length, ready.scenarios.length);
  assert.equal(blank.objectives.length, ready.objectives.length);
  assert.equal(blank.title, '');
  assert.equal(blank.human_decision.selected_strategy_id, '');
  blank.strategies[0].label = 'Changed blank choice';
  assert.notEqual(ready.strategies[0].label, blank.strategies[0].label);
  assert.equal(ready.human_decision.selected_strategy_id, '');
  assert.equal(validateDraftDecisionCase(blank).valid, true);
  assert.equal(validateDecisionCase(blank).valid, false);
});

test('blank decision contains no ready-example domain meaning', () => {
  const blank = createBlankDecisionCase();
  const strings = [];
  const collect = (value) => {
    if (typeof value === 'string') strings.push(value.toLowerCase());
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(blank);
  const semanticText = strings.join(' ');
  for (const term of ['critical-material', 'source qualification', 'supplier', 'reserve', 'affordability', 'continuity']) {
    assert.equal(semanticText.includes(term), false, `blank retained example meaning: ${term}`);
  }
  assert.equal(blank.profile, 'general');
  assert.equal(blank.urgency, '');
  assert.equal(blank.reversibility, '');
  assert.ok(blank.objectives.every((item) => item.threshold === null && item.critical === false));
  assert.ok(blank.strategies.every((item) => Object.values(item.baseline).every((value) => value === null)));
  assert.ok(blank.scenarios.every((item) => Object.values(item.strategy_modifiers).every(
    (modifiers) => Object.values(modifiers).every((value) => value === null),
  )));
});

test('partial blank is recoverable as a draft but remains analysis and completion invalid', () => {
  const blank = createBlankDecisionCase();
  blank.title = 'Partial decision';
  blank.question = 'Should we proceed?';
  assert.equal(validateDraftDecisionCase(blank).valid, true);
  assert.equal(validateDecisionCase(blank).valid, false);
  assert.equal(validateCompletedDecisionCase(blank).valid, false);
});

test('strategy-specific scenario modifiers are transparent and bounded in the R4 case', () => {
  const decision = createDecisionCase();
  const strategy = decision.strategies.find((item) => item.strategy_id === 'STR-003');
  const scenario = decision.scenarios.find((item) => item.scenario_id === 'SCN-004');
  const modifier = scenario.strategy_modifiers[strategy.strategy_id]['OBJ-002'];
  assert.equal(modifier, 5);
  assert.ok(modifier >= -100 && modifier <= 100);
  assert.equal(performanceValue(strategy, scenario, 'OBJ-002'), 95);
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

test('second-source qualification is the leading tested candidate with disclosed gaps', () => {
  const decision = createDecisionCase();
  const candidate = robustCandidate(decision);
  assert.equal(candidate.strategy_id, 'STR-002');
  assert.equal(candidate.critical_failure_scenario_count, 2);
  assert.equal(candidate.worst_case_pass_rate, 0.5);
});
test('reserve-and-qualify exposes the constrained-budget affordability weakness', () => {
  const decision = createDecisionCase();
  const map = vulnerabilityMap(decision, 'STR-003');
  const constrained = map.find((item) => item.scenario_id === 'SCN-004');
  assert.equal(constrained.vulnerable, true);
  assert.ok(constrained.failures.some((item) => item.objective_id === 'OBJ-003'));
  assert.equal(constrained.failures.some((item) => item.objective_id === 'OBJ-002'), false);
});
test('summaries preserve critical failure counts rather than hiding them in one score', () => {
  const decision = createDecisionCase();
  const summaries = summarizeStrategies(decision);
  assert.equal(summaries.length, 3);
  assert.ok(summaries.every((item) => Number.isInteger(item.critical_failure_count)));
});

test('scenario effects differ by pathway in the same future', () => {
  const decision = createDecisionCase();
  const scenario = decision.scenarios.find((item) => item.scenario_id === 'SCN-001');
  const currentSource = decision.strategies.find((item) => item.strategy_id === 'STR-001');
  const secondSource = decision.strategies.find((item) => item.strategy_id === 'STR-002');
  assert.equal(performanceValue(currentSource, scenario, 'OBJ-001'), 65);
  assert.equal(performanceValue(secondSource, scenario, 'OBJ-001'), 75);
  assert.notEqual(
    performanceValue(currentSource, scenario, 'OBJ-001'),
    performanceValue(secondSource, scenario, 'OBJ-001'),
  );
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

test('fresh ready example has no synthetic human decision', () => {
  const decision = createDecisionCase();
  assert.deepEqual(decision.human_decision, {
    selected_strategy_id: '', rationale: '', next_action: '', approved_by: '', approved_at: null,
  });
  assert.equal(validateDecisionCase(decision).valid, true);
  const result = validateCompletedDecisionCase(decision);
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
