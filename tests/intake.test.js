import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESCUE_MAX_INPUT_CHARS,
  buildDecisionFrame,
  decisionFrameReady,
  frameAsText,
  normalizeIntakeText,
  uniqueSelections,
  validateIntakeText,
} from '../site/src/lib/intake.js';

test('empty Decision Rescue intake asks for a useful starting point', () => {
  const result = validateIntakeText('   \n  ');
  assert.equal(result.ok, false);
  assert.match(result.error, /few words/i);
});

test('Decision Rescue preserves multiline human language while normalizing line endings', () => {
  const raw = '  Supplier is late.\r\nI am not sure what to do.  ';
  assert.equal(normalizeIntakeText(raw), 'Supplier is late.\nI am not sure what to do.');
  assert.equal(validateIntakeText(raw).ok, true);
});

test('Decision Rescue preserves Unicode and punctuation', () => {
  const raw = '¿Qué hago? 東京 🚀 — I’m not sure.';
  assert.equal(validateIntakeText(raw).text, raw);
});

test('HTML and code-like intake remains plain text data', () => {
  const raw = '<script>alert("no")</script> const choice = "wait";';
  const result = validateIntakeText(raw);
  assert.equal(result.ok, true);
  assert.equal(result.text, raw);
  assert.match(frameAsText(buildDecisionFrame({ startingPoint: raw })), /<script>alert/);
});

test('oversized Decision Rescue intake is bounded', () => {
  const result = validateIntakeText('x'.repeat(RESCUE_MAX_INPUT_CHARS + 1));
  assert.equal(result.ok, false);
  assert.match(result.error, /under/i);
});

test('selection normalization removes blanks and duplicates without inventing choices', () => {
  assert.deepEqual(uniqueSelections(['Time', '', 'Time', 'Reliability']), ['Time', 'Reliability']);
});

test('full-comparison handoff requires a confirmed decision and a 2 by 2 by 2 frame', () => {
  assert.equal(decisionFrameReady(buildDecisionFrame({
    decision: 'Should we move now or test first?',
    goals: ['Time', 'Reliability'],
    choices: ['Move now', 'Test first'],
    futures: ['Things stay roughly the same', 'Timing gets worse'],
  })), true);
  assert.equal(decisionFrameReady(buildDecisionFrame({
    decision: '',
    goals: ['Time', 'Reliability'],
    choices: ['Move now', 'Test first'],
    futures: ['Things stay roughly the same', 'Timing gets worse'],
  })), false);
});

test('Decision Frame is useful when incomplete and never claims a recommendation', () => {
  const text = frameAsText(buildDecisionFrame({
    startingPoint: 'Everything is tangled and I need to act soon.',
    intent: 'unsure',
    urgency: 'today',
  }));
  assert.match(text, /Useful framing in progress/);
  assert.match(text, /No recommendation has been made/);
  assert.match(text, /A person decides/);
});
