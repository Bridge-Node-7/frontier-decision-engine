import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionCase } from '../site/src/lib/decision.js';
import { activateDecisionSemantics } from '../site/src/lib/semantics.js';
import { authorityPermissions, authorityValidation, createAuthority } from '../site/src/lib/authority.js';
import { decisionEvidenceReadiness, evidenceDisposition, EVIDENCE_READINESS } from '../site/src/lib/evidence-readiness.js';
import { canonicalJson, sha256Hex } from '../site/src/lib/integrity.js';
import { createDecisionRecord, validDecisionRecord } from '../site/src/lib/recording.js';

test('shared SHA-256 primitive matches the standard abc vector', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(canonicalJson({ z: 1, a: ['b', { y: 2, x: 1 }] }), '{"a":["b",{"x":1,"y":2}],"z":1}');
});

test('authority routes advisors and unknown owners without elevating them to decision authority', () => {
  const unknown = createAuthority();
  assert.equal(authorityPermissions(unknown).mayCompare, false);
  assert.equal(authorityPermissions(unknown).mayRecordDecision, false);
  assert.equal(authorityValidation(unknown).valid, false);

  const advisor = createAuthority({ role: 'advisor', owner: 'Program executive' });
  assert.equal(authorityValidation(advisor).valid, true);
  assert.equal(authorityPermissions(advisor).mayCompare, true);
  assert.equal(authorityPermissions(advisor).mayRecordDecision, false);

  const delegated = createAuthority({ role: 'delegated_decider', owner: 'Integration lead', basis: 'Delegated by program executive.' });
  assert.equal(authorityValidation(delegated, { forRecord: true }).valid, true);
  assert.equal(authorityPermissions(delegated).mayRecordDecision, true);
});

test('required unresolved evidence produces a proof gate and explicit residual-uncertainty disposition', () => {
  const decision = createDecisionCase();
  activateDecisionSemantics(decision, 'general');
  decision.decision_semantics.criteria = [{
    criterion_id: 'CRT-001',
    dimension: 'general',
    label: 'Calibration evidence',
    requirement: 'Repeatability must be established',
    must_be_true: true,
    evidence_state: 'unknown',
    outcome: 'not-assessable',
    source_refs: [],
    evidence_need: 'Repeat calibration stability test under integrated load.',
    affected_party_ids: [],
    missing_perspectives: [],
    assumptions: [],
    limitations: [],
  }];
  const readiness = decisionEvidenceReadiness(decision);
  assert.equal(readiness.state, EVIDENCE_READINESS.PROOF_REQUIRED);
  assert.equal(readiness.proof_requests[0].evidence_need, 'Repeat calibration stability test under integrated load.');
  const hold = evidenceDisposition({ readiness });
  assert.equal(hold.state, EVIDENCE_READINESS.PROOF_REQUIRED);
  const proceed = evidenceDisposition({ readiness, proceedUnderResidualUncertainty: true, rationale: 'Schedule consequence is accepted by the accountable owner.' });
  assert.equal(proceed.state, EVIDENCE_READINESS.RESIDUAL_UNCERTAINTY);
  assert.deepEqual(proceed.unresolved_evidence, ['CRT-001']);
});

test('v2 receipt binds authority, evidence disposition, attestation, and decision content', () => {
  const decision = createDecisionCase();
  decision.human_decision.selected_strategy_id = decision.strategies[0].strategy_id;
  decision.human_decision.rationale = 'Accountable owner selected this path after review.';
  decision.human_decision.next_action = 'Begin the bounded next action.';
  const record = createDecisionRecord(decision, {
    authority: { role: 'accountable_owner', owner: decision.decision_owner, basis: 'Accountable program role.' },
    evidenceDisposition: { state: 'ready', unresolved_evidence: [], rationale: '' },
    attestation: { confirmed: true, attested_by: 'Program Owner', attested_role: 'Program decision owner' },
    recordedAt: '2026-09-23T12:00:00.000Z',
  });
  assert.equal(record.format_version, '2');
  assert.equal(validDecisionRecord(record), true);
  const tampered = structuredClone(record);
  tampered.authority.basis = 'Changed after recording';
  assert.equal(validDecisionRecord(tampered), false);
});


test('required unresolved criterion stays proof-required even before an evidence need is named', () => {
  const decision = createDecisionCase();
  activateDecisionSemantics(decision, 'general');
  decision.decision_semantics.criteria = [{
    criterion_id: 'CRT-UNNAMED',
    dimension: 'general',
    label: 'Qualification evidence',
    requirement: 'Qualification must be established',
    must_be_true: true,
    evidence_state: 'unknown',
    outcome: 'not-assessable',
    source_refs: [],
    evidence_need: '',
    affected_party_ids: [],
    missing_perspectives: [],
    assumptions: [],
    limitations: [],
  }];
  const readiness = decisionEvidenceReadiness(decision);
  assert.equal(readiness.state, EVIDENCE_READINESS.PROOF_REQUIRED);
  assert.equal(readiness.proof_requests.length, 0);
  assert.deepEqual(readiness.blocking.map((item) => item.criterion_id), ['CRT-UNNAMED']);
});
