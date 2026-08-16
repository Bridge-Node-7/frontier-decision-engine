import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlankDecisionCase,
  createDecisionCase,
  performanceValue,
  requirementIssues,
  REQUIREMENT_CLASS,
  REQUIREMENT_CONTRACT,
  setScenarioNoModeledChange,
  validateAnalysisReady,
  validateCompletedDecisionCase,
  validateStageRequirements,
} from '../site/src/lib/decision.js';
import { createDecisionRecord, decisionFingerprint, recordFromPortableDecision, recordMatchesDecision, validDecisionRecord } from '../site/src/lib/recording.js';
import { createDraftBackup, loadSavedDecision, parseDraftBackupText, saveDecision } from '../site/src/lib/persistence.js';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function recordableDecision() {
  const decision = createDecisionCase();
  decision.human_decision.selected_strategy_id = 'STR-001';
  decision.human_decision.rationale = 'A person chose a different path after reviewing the trade-offs.\nSecond line & Unicode: ✓ 🚀';
  decision.human_decision.next_action = 'Owner reviews next week.';
  return decision;
}

test('requirement contract classifies every runtime field family without hidden required prose', () => {
  assert.equal(REQUIREMENT_CONTRACT.question, REQUIREMENT_CLASS.CONTINUE);
  assert.equal(REQUIREMENT_CONTRACT.objective_label, REQUIREMENT_CLASS.COMPARE);
  assert.equal(REQUIREMENT_CONTRACT.human_selection, REQUIREMENT_CLASS.RECORD);
  assert.equal(REQUIREMENT_CONTRACT.strategy_description, REQUIREMENT_CLASS.OPTIONAL);
  assert.equal(REQUIREMENT_CONTRACT.strategy_planning, REQUIREMENT_CLASS.OPTIONAL);
  assert.equal(REQUIREMENT_CONTRACT.scenario_description, REQUIREMENT_CLASS.OPTIONAL);
  assert.equal(REQUIREMENT_CONTRACT.adaptive_pathway, REQUIREMENT_CLASS.OPTIONAL);
  assert.equal(REQUIREMENT_CONTRACT.status, REQUIREMENT_CLASS.DEFAULTED);
  assert.equal(REQUIREMENT_CONTRACT.human_approval_metadata, REQUIREMENT_CLASS.OPTIONAL);
  assert.equal(REQUIREMENT_CONTRACT.ids_and_provenance, REQUIREMENT_CLASS.SYSTEM);
});

test('blank visible-UI requirements identify objective authoring and do not expose technical IDs', () => {
  const blank = createBlankDecisionCase();
  const issues = requirementIssues(blank, 'record');
  assert.ok(issues.some((issue) => issue.fieldId === 'objective-label-0'));
  assert.ok(issues.some((issue) => issue.fieldId === 'objective-threshold-0'));
  assert.ok(issues.some((issue) => issue.fieldId === 'human-strategy'));
  assert.ok(issues.every((issue) => !/OBJ-|STR-|SCN-|UNC-|state-a|unset/.test(issue.message)));
  assert.equal(validateStageRequirements(blank, 1).valid, false);
});

test('blank, explicit zero, and unknown future effects remain distinct', () => {
  const decision = createDecisionCase();
  const strategy = decision.strategies[0];
  const scenario = decision.scenarios[0];
  const objectiveId = decision.objectives[0].objective_id;
  for (const value of [null, undefined, '', '   ', '0', false]) {
    scenario.strategy_modifiers[strategy.strategy_id][objectiveId] = value;
    assert.equal(performanceValue(strategy, scenario, objectiveId), null, `modifier ${String(value)} must not become zero`);
    strategy.baseline[objectiveId] = value;
    assert.equal(performanceValue(strategy, scenario, objectiveId), null, `baseline ${String(value)} must not become zero`);
    strategy.baseline[objectiveId] = 55;
  }
  scenario.strategy_modifiers[strategy.strategy_id][objectiveId] = 0;
  assert.equal(performanceValue(strategy, scenario, objectiveId), strategy.baseline[objectiveId]);
  assert.equal(validateAnalysisReady({ ...decision, scenarios: decision.scenarios }).valid, true);

  assert.equal(setScenarioNoModeledChange(decision, 0, true), true);
  assert.ok(Object.values(scenario.strategy_modifiers).flatMap(Object.values).every((value) => value === 0));
  assert.equal(setScenarioNoModeledChange(decision, 0, false), true);
  assert.ok(Object.values(scenario.strategy_modifiers).flatMap(Object.values).every((value) => value === null));
  scenario.strategy_modifiers[decision.strategies[0].strategy_id][decision.objectives[0].objective_id] = 7;
  assert.equal(setScenarioNoModeledChange(decision, 0, false), false);
  assert.equal(scenario.strategy_modifiers[decision.strategies[0].strategy_id][decision.objectives[0].objective_id], 7);
});

test('selected is not recorded; record survives unchanged state and becomes stale after substantive edit', () => {
  const decision = recordableDecision();
  assert.equal(validateCompletedDecisionCase(decision).valid, true);
  const record = createDecisionRecord(decision, '2026-08-15T12:00:00.000Z');
  assert.equal(validDecisionRecord(record), true);
  assert.equal(recordMatchesDecision(decision, record), true);
  assert.equal(record.snapshot.status, 'draft');
  assert.equal(record.snapshot.human_decision.approved_by, '');
  assert.equal(record.snapshot.human_decision.approved_at, null);
  assert.equal(record.snapshot.human_decision.recorded_at, record.recorded_at);
  assert.equal(record.snapshot.human_decision.recorded_fingerprint, record.fingerprint);
  for (const mutate of [
    (value) => { value.snapshot.decision_id = 'FDE-DIFFERENT'; },
    (value) => { value.fingerprint = 'fnv1a32-00000000'; },
    (value) => { value.snapshot.human_decision.recorded_at = '2026-08-16T12:00:00.000Z'; },
    (value) => { value.snapshot.question = 'Tampered question'; },
  ]) {
    const tampered = structuredClone(record);
    mutate(tampered);
    assert.equal(validDecisionRecord(tampered), false);
  }
  decision.human_decision.rationale += ' Changed.';
  assert.equal(validDecisionRecord(record), true);
  assert.equal(recordMatchesDecision(decision, record), false);
  assert.notEqual(decisionFingerprint(decision), record.fingerprint);
  assert.doesNotMatch(record.snapshot.human_decision.rationale, /Changed/);
});

test('portable imports restore Recorded only from verified v0.3.1 record metadata', () => {
  const legacy = recordableDecision();
  assert.equal(recordFromPortableDecision(legacy), null);
  const record = createDecisionRecord(legacy, '2026-08-15T12:00:00.000Z');
  const restored = recordFromPortableDecision(record.snapshot);
  assert.equal(validDecisionRecord(restored), true);
  assert.equal(recordMatchesDecision(record.snapshot, restored), true);
  const tampered = structuredClone(record.snapshot);
  tampered.human_decision.rationale = 'Changed without a new Record action.';
  assert.equal(recordFromPortableDecision(tampered), null);
});

test('record metadata and immutable snapshot survive browser reload and draft import', () => {
  const local = storage();
  const decision = recordableDecision();
  const record = createDecisionRecord(decision, '2026-08-15T12:00:00.000Z');
  assert.equal(saveDecision(local, decision, record).ok, true);
  const restored = loadSavedDecision(local, () => ({ valid: true, errors: [] }));
  assert.deepEqual(restored.record, record);
  assert.equal(recordMatchesDecision(restored.decision, restored.record), true);

  const backup = createDraftBackup(decision, record);
  const parsed = parseDraftBackupText(JSON.stringify(backup), () => ({ valid: true, errors: [] }));
  assert.deepEqual(parsed.record, record);
});

test('hostile user text remains inert in the Decision Brief', async () => {
  const { buildDecisionHtml } = await import('../site/src/decision-ui.js');
  const decision = recordableDecision();
  decision.title = '<script>alert(1)</script> "quotes" & emoji 🚀';
  decision.human_decision.rationale = '<img src=x onerror=alert(1)>\nmultiline & longword'.repeat(20);
  assert.throws(() => buildDecisionHtml(decision), /valid Decision Record/);
  const html = buildDecisionHtml(createDecisionRecord(decision));
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&amp;/);
  assert.match(html, /🚀/);
});
