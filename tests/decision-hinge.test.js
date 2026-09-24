import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDecisionHinge } from '../site/src/lib/decision-hinge.js';

test('extracts an explicit hard requirement without granting formal influence', () => {
  const hinge = deriveDecisionHinge('The design must meet the radiation limit before qualification.');
  assert.equal(hinge.basis_type, 'hard_requirement');
  assert.equal(hinge.formal_influence, false);
  assert.equal(hinge.status, 'suggested');
});

test('extracts an explicit integration-window time gate', () => {
  const hinge = deriveDecisionHinge('Supplier A is cheaper. November is our integration window.');
  assert.equal(hinge.basis_type, 'deadline');
  assert.equal(hinge.source_text, 'November is our integration window');
});

test('extracts an explicit dependency', () => {
  const hinge = deriveDecisionHinge('The choice depends on qualification lead time.');
  assert.equal(hinge.basis_type, 'dependency');
  assert.equal(hinge.source_text, 'depends on qualification lead time');
});

test('extracts an explicit conditional', () => {
  const hinge = deriveDecisionHinge('We can proceed only if calibration evidence is complete.');
  assert.equal(hinge.basis_type, 'conditional');
  assert.equal(hinge.source_text, 'only if calibration evidence is complete');
});

test('extracts an explicit blocker', () => {
  const hinge = deriveDecisionHinge('Deployment is blocked by unresolved interface verification.');
  assert.equal(hinge.basis_type, 'blocker');
  assert.match(hinge.source_text, /blocked by unresolved interface verification/i);
});

test('returns no hinge when the input has no explicit controlling condition', () => {
  assert.equal(deriveDecisionHinge('Should we qualify Supplier A or Supplier B? Cost and resilience matter.'), null);
});

test('negation does not invert a non-requirement into a requirement', () => {
  assert.equal(deriveDecisionHinge('November is not a hard deadline.'), null);
  assert.equal(deriveDecisionHinge('This interface is not required for launch.'), null);
});

test('source span round-trips exactly with accented and multibyte text', () => {
  const input = 'Résumé review ✅ — the choice depends on qualification timing in 東京.';
  const hinge = deriveDecisionHinge(input);
  assert.equal(input.slice(hinge.source_start, hinge.source_end), hinge.source_text);
  assert.equal(hinge.source_text, 'depends on qualification timing in 東京');
});

test('source span round-trips exactly with smart quotes and emoji before the hinge', () => {
  const input = '“Option A” 🚀 is viable; we can proceed only if the readiness review passes.';
  const hinge = deriveDecisionHinge(input);
  assert.equal(input.slice(hinge.source_start, hinge.source_end), hinge.source_text);
});

test('derived candidates remain suggestions rather than evidence or authority', () => {
  const hinge = deriveDecisionHinge('The program turns on supplier qualification.');
  assert.deepEqual(
    Object.keys(hinge).sort(),
    ['basis_type', 'formal_influence', 'source_end', 'source_start', 'source_text', 'status', 'text'].sort(),
  );
  assert.equal(hinge.formal_influence, false);
  assert.equal(hinge.status, 'suggested');
});
