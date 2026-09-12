import test from 'node:test';
import assert from 'node:assert/strict';
import { draftFromInput, responseFor } from '../site/src/universal-ui.js';

test('clear decision input produces only supportable deterministic structure', () => {
  const draft = draftFromInput('Should we build internally or partner externally? Time and quality matter, but the supplier may be late.');
  assert.equal(draft.intent, 'decision');
  assert.equal(draft.possibleDecision, 'Should we build internally or partner externally');
  assert.deepEqual(draft.choices, ['build internally', 'partner externally']);
  assert.deepEqual(draft.goals, ['Time', 'Quality']);
  assert.deepEqual(draft.futures, ['Timing gets worse']);
  assert.equal(responseFor(draft).kind, 'structure');
});

test('sparse input produces exactly one useful clarification question', () => {
  for (const input of ['', 'banana moon 777', 'I have a complicated situation.']) {
    const response = responseFor(draftFromInput(input));
    assert.equal(response.kind, 'question');
    assert.match(response.question, /which decision or question/i);
    assert.equal(Object.keys(response).filter((key) => key === 'question').length, 1);
  }
});

test('information request returns an honest capability boundary and useful next action', () => {
  const response = responseFor(draftFromInput('How much does a new MRI machine cost?'));
  assert.equal(response.kind, 'boundary');
  assert.match(response.title, /does not retrieve outside facts/i);
  assert.match(response.body, /gather the fact|state the decision/i);
});

test('multiple decisions ask for one focus instead of fabricating a combined model', () => {
  const draft = draftFromInput('Should we hire someone? Should we expand next year?');
  assert.equal(draft.intent, 'multi');
  assert.equal(draft.possibleDecision, '');
  const response = responseFor(draft);
  assert.equal(response.kind, 'question');
  assert.match(response.question, /focus on first/i);
});

test('human input remains inert context and no fallback options are invented', () => {
  const input = '<script>alert("x")</script> Should we stay or go? Safety matters.';
  const draft = draftFromInput(input);
  assert.equal(draft.startingPoint, input);
  assert.deepEqual(draft.choices, ['stay', 'go']);
  assert.ok(draft.goals.includes('Safety'));
});
