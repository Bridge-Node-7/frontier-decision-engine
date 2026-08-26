import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANDIDATE_STATE,
  DRAFT_TOPOLOGY_BOUNDS,
  buildPerformanceMatrix,
  createGuidedDecisionCase,
  robustCandidateDecision,
  validateAnalysisReady,
  validateDraftDecisionCase,
} from '../site/src/lib/decision.js';
import { createDraftBackup, parseDraftBackupText } from '../site/src/lib/persistence.js';

function completeGuidedComparison() {
  const decision = createGuidedDecisionCase();
  decision.question = 'Should we move now or test first?';
  decision.objectives[0].label = 'Reliability';
  decision.objectives[0].threshold = 50;
  decision.objectives[0].critical = true;
  decision.objectives[1].label = 'Flexibility';
  decision.objectives[1].threshold = 50;

  decision.strategies[0].label = 'Move now';
  decision.strategies[0].baseline['OBJ-001'] = 70;
  decision.strategies[0].baseline['OBJ-002'] = 60;
  decision.strategies[1].label = 'Test first';
  decision.strategies[1].baseline['OBJ-001'] = 50;
  decision.strategies[1].baseline['OBJ-002'] = 80;

  decision.scenarios[0].label = 'Things stay roughly the same';
  decision.scenarios[1].label = 'Integration takes longer';
  for (const scenario of decision.scenarios) {
    for (const strategy of decision.strategies) {
      for (const objective of decision.objectives) {
        scenario.strategy_modifiers[strategy.strategy_id][objective.objective_id] = 0;
      }
    }
  }
  decision.scenarios[1].strategy_modifiers['STR-001']['OBJ-001'] = -30;
  return decision;
}

test('guided factory creates a true 2 by 2 by 2 draft without hidden extra comparison cells', () => {
  const decision = createGuidedDecisionCase();
  assert.equal(decision.objectives.length, 2);
  assert.equal(decision.strategies.length, 2);
  assert.equal(decision.scenarios.length, 2);
  assert.equal(validateDraftDecisionCase(decision).valid, true);
  assert.deepEqual(Object.keys(decision.strategies[0].baseline), ['OBJ-001', 'OBJ-002']);
  assert.deepEqual(Object.keys(decision.scenarios[0].strategy_modifiers), ['STR-001', 'STR-002']);
  assert.deepEqual(Object.keys(decision.scenarios[0].strategy_modifiers['STR-001']), ['OBJ-001', 'OBJ-002']);
});

test('guided draft topology expands within the existing bounded UI contract', () => {
  const decision = createGuidedDecisionCase({ objectiveCount: 4, strategyCount: 3, scenarioCount: 4 });
  assert.equal(validateDraftDecisionCase(decision).valid, true);
  assert.equal(decision.objectives.length, DRAFT_TOPOLOGY_BOUNDS.objectives.max);
  assert.equal(decision.strategies.length, DRAFT_TOPOLOGY_BOUNDS.strategies.max);
  assert.equal(decision.scenarios.length, DRAFT_TOPOLOGY_BOUNDS.scenarios.max);
});

test('guided factory rejects topology outside the bounded UI contract', () => {
  assert.throws(() => createGuidedDecisionCase({ objectiveCount: 1 }), /objectives count/i);
  assert.throws(() => createGuidedDecisionCase({ strategyCount: 4 }), /strategies count/i);
  assert.throws(() => createGuidedDecisionCase({ scenarioCount: 5 }), /scenarios count/i);
});

test('true 2 by 2 by 2 comparison is analysis-ready and uses the unchanged ranking rules', () => {
  const decision = completeGuidedComparison();
  const readiness = validateAnalysisReady(decision);
  assert.equal(readiness.valid, true, readiness.errors.join(' | '));
  assert.equal(buildPerformanceMatrix(decision).length, 8);
  const result = robustCandidateDecision(decision);
  assert.equal(result.status, CANDIDATE_STATE.UNIQUE_LEADER);
  assert.equal(result.candidates[0].strategy_id, 'STR-002');
});

test('guided 2 by 2 by 2 drafts survive the existing portable draft-backup path', () => {
  const decision = createGuidedDecisionCase();
  decision.question = 'Should we continue?';
  const text = JSON.stringify(createDraftBackup(decision));
  const reopened = parseDraftBackupText(text, validateDraftDecisionCase);
  assert.equal(reopened.ok, true);
  assert.equal(reopened.decision.objectives.length, 2);
  assert.equal(reopened.decision.strategies.length, 2);
  assert.equal(reopened.decision.scenarios.length, 2);
});
