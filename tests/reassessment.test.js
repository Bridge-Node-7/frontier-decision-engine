import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionCase } from '../site/src/lib/decision.js';
import { decisionDelta } from '../site/src/lib/reassessment.js';

test('reassessment reports deterministic framing changes without inferring motive', () => {
  const before = createDecisionCase(); const after = structuredClone(before);
  after.time_horizon = '48 months';
  const changes = decisionDelta(before, after);
  assert.equal(changes.length, 1); assert.equal(changes[0].kind, 'framing');
  assert.doesNotMatch(changes[0].label, /because|motive|confidence/i);
});

test('reassessment distinguishes evidence from modeled-future changes', () => {
  const before = createDecisionCase(); const after = structuredClone(before);
  after.evidence_summary.known.push('New evidence arrived.');
  after.scenarios[0].description = 'Changed future condition.';
  const kinds = decisionDelta(before, after).map((item) => item.kind);
  assert.ok(kinds.includes('evidence')); assert.ok(kinds.includes('futures'));
});

test('reassessment identifies human-decision changes separately', () => {
  const before = createDecisionCase(); const after = structuredClone(before);
  after.human_decision.rationale = 'Updated rationale.';
  const changes = decisionDelta(before, after);
  assert.deepEqual(changes.map((item) => item.kind), ['human-decision']);
});

test('reassessment returns no changes for an unchanged decision', () => {
  const decision = createDecisionCase();
  assert.deepEqual(decisionDelta(decision, structuredClone(decision)), []);
});
