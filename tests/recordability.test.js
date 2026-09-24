import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionCase } from '../site/src/lib/decision.js';
import { decisionRecordability } from '../site/src/lib/recordability.js';
import { createDecisionRecord } from '../site/src/lib/recording.js';

function options(decision) {
  return {
    authority: { role: 'accountable_owner', owner: decision.decision_owner, basis: 'Accountable test owner.' },
    evidenceDisposition: { state: 'ready', unresolved_evidence: [], rationale: '' },
    attestation: { confirmed: true, attested_by: 'Test Owner', attested_role: 'Decision owner' },
    recordedAt: '2026-09-24T12:00:00.000Z',
  };
}

test('ordinary technical decision remains recordable', () => {
  const decision = createDecisionCase();
  assert.equal(decisionRecordability(decision).recordable, true);
});

test('first-person self-harm decision is not recordable', () => {
  const decision = createDecisionCase();
  decision.question = 'Should I just end it all?';
  const result = decisionRecordability(decision);
  assert.equal(result.recordable, false);
  assert.equal(result.field, 'question');
  assert.equal(result.boundary.kind, 'out_of_scope_self_harm');
});

test('unsafe operative strategy description is not recordable', () => {
  const decision = createDecisionCase();
  decision.strategies[0].description = 'Should I hurt myself or not?';
  const result = decisionRecordability(decision);
  assert.equal(result.recordable, false);
  assert.equal(result.field, 'strategies[0].description');
});

test('ordinary supplier idiom remains recordable', () => {
  const decision = createDecisionCase();
  decision.question = 'Should we end it all with this supplier or renegotiate?';
  assert.equal(decisionRecordability(decision).recordable, true);
});

test('organizational prevention decision remains recordable', () => {
  const decision = createDecisionCase();
  decision.question = 'Should the ministry fund suicide prevention hotlines or school counselors?';
  assert.equal(decisionRecordability(decision).recordable, true);
});

test('explanatory rationale does not become a terminal scope gate', () => {
  const decision = createDecisionCase();
  decision.human_decision.rationale = 'The team asked whether to end it all with this supplier after the qualification failure.';
  assert.equal(decisionRecordability(decision).recordable, true);
});

test('personal rationale is not recordable while organizational rationale remains allowed', () => {
  const decision = createDecisionCase();
  decision.human_decision.rationale = 'I want to kill myself.';
  const crisis = decisionRecordability(decision);
  assert.equal(crisis.recordable, false);
  assert.equal(crisis.field, 'human_decision.rationale');
  assert.equal(crisis.boundary.kind, 'out_of_scope_self_harm');

  decision.human_decision.rationale = 'I am deciding whether to move to another city.';
  const personal = decisionRecordability(decision);
  assert.equal(personal.recordable, false);
  assert.equal(personal.field, 'human_decision.rationale');
  assert.equal(personal.boundary.kind, 'out_of_scope_personal_decision');

  decision.human_decision.rationale = 'I selected Option A because the evidence supports it.';
  assert.equal(decisionRecordability(decision).recordable, true);
});

test('receipt constructor fails closed when the recorded rationale is out of scope', () => {
  const decision = createDecisionCase();
  decision.human_decision.selected_strategy_id = decision.strategies[0].strategy_id;
  decision.human_decision.rationale = 'I am deciding whether to move to another city.';
  decision.human_decision.next_action = 'Begin the bounded next action.';
  assert.throws(() => createDecisionRecord(decision, options(decision)), /outside FDE recording scope/i);
});

test('receipt constructor fails closed for an unrecordable substantive decision', () => {
  const decision = createDecisionCase();
  decision.human_decision.selected_strategy_id = decision.strategies[0].strategy_id;
  decision.human_decision.rationale = 'Accountable human rationale.';
  decision.human_decision.next_action = 'Should I just end it all?';
  assert.throws(() => createDecisionRecord(decision, options(decision)), /outside FDE recording scope/i);
});

test('receipt constructor still records an ordinary accountable decision', () => {
  const decision = createDecisionCase();
  decision.human_decision.selected_strategy_id = decision.strategies[0].strategy_id;
  decision.human_decision.rationale = 'Accountable human rationale.';
  decision.human_decision.next_action = 'Begin the bounded next action.';
  const receipt = createDecisionRecord(decision, options(decision));
  assert.equal(receipt.format_version, '2');
  assert.match(receipt.receipt_sha256, /^[a-f0-9]{64}$/);
});
