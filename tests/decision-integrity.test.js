import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANDIDATE_STATE,
  OUTCOME_STATE,
  buildPerformanceMatrix,
  createDecisionCase,
  objectivePasses,
  robustCandidate,
  robustCandidateDecision,
  summarizeStrategies,
  validateAnalysisReady,
  vulnerabilityMap,
} from '../site/src/lib/decision.js';

test('null cannot pass an at-most objective', () => {
  assert.equal(objectivePasses(null, { threshold: 10, direction: 'at-most' }), false);
});

test('invalid outcomes remain explicit and do not become policy failures', () => {
  const decision = createDecisionCase();
  delete decision.strategies[0].baseline['OBJ-001'];
  const matrix = buildPerformanceMatrix(decision);
  const row = matrix.find((item) => item.strategy_id === 'STR-001' && item.objective_id === 'OBJ-001');
  assert.equal(row.state, OUTCOME_STATE.INVALID_OUTPUT);
  const summary = summarizeStrategies(decision).find((item) => item.strategy_id === 'STR-001');
  assert.ok(summary.invalid_outcome_count > 0);
  assert.equal(summary.analysis_valid, false);
  const map = vulnerabilityMap(decision, 'STR-001');
  assert.ok(map.some((item) => item.invalids.length > 0));
});

test('null thresholds are invalid and cannot be treated as zero', () => {
  const decision = createDecisionCase();
  decision.objectives[0].threshold = null;
  const matrix = buildPerformanceMatrix(decision);
  assert.ok(matrix.filter((row) => row.objective_id === 'OBJ-001').every((row) => row.state === OUTCOME_STATE.INVALID_OUTPUT));
  assert.equal(validateAnalysisReady(decision).valid, false);
});

test('an incomplete result matrix blocks analysis', () => {
  const decision = createDecisionCase();
  decision.strategies[0].baseline['OBJ-001'] = Number.NaN;
  const result = validateAnalysisReady(decision);
  assert.equal(result.valid, false);
});

test('exact ranking ties are disclosed and never reduced to array order', () => {
  const decision = createDecisionCase();
  decision.strategies = [structuredClone(decision.strategies[2]), structuredClone(decision.strategies[2])];
  decision.strategies[0].strategy_id = 'STR-TIE-A';
  decision.strategies[1].strategy_id = 'STR-TIE-B';
  for (const scenario of decision.scenarios) {
    const source = scenario.strategy_modifiers['STR-003'];
    scenario.strategy_modifiers = {
      'STR-TIE-A': structuredClone(source),
      'STR-TIE-B': structuredClone(source),
    };
  }
  decision.human_decision.selected_strategy_id = 'STR-TIE-A';
  const result = robustCandidateDecision(decision);
  assert.equal(result.status, CANDIDATE_STATE.TIED_LEADERS);
  assert.equal(result.candidates.length, 2);
  assert.equal(robustCandidate(decision), null);
});
