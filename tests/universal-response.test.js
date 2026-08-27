import test from 'node:test';
import assert from 'node:assert/strict';
import { draftFromInput, responseFor } from '../site/src/universal-ui.js';

test('Universal Response always returns a useful response for any text', () => {
  for (const input of ['', 'I do not know what to do.', 'Should we stay or go?', 'banana moon 777', '<script>alert(1)</script>', 'How much does this cost?', 'How does this work?', 'We need to hire someone and decide whether to expand too.']) {
    const draft = draftFromInput(input);
    const response = responseFor(draft);
    assert.ok(response.title.trim());
    assert.ok(response.body.trim());
  }
});

test('Universal Response preserves messy human input as inert starting context', () => {
  const input = '<script>alert("x")</script> Our supplier is late and quality matters.';
  const draft = draftFromInput(input);
  assert.equal(draft.startingPoint, input);
  assert.ok(draft.goals.includes('Quality'));
  assert.ok(draft.futures.includes('Timing gets worse'));
});

test('Universal Response extracts explicit alternatives without inventing fallback choices', () => {
  const draft = draftFromInput('Should we build internally or partner externally?');
  assert.deepEqual(draft.choices, ['Should we build internally', 'partner externally']);
});

test('Universal Response distinguishes information requests and multiple decisions', () => {
  const information = draftFromInput('How much does a new MRI machine cost?');
  assert.equal(information.intent, 'information');
  assert.match(responseFor(information).title, /information question/i);

  const multiple = draftFromInput('Should we hire someone? Should we expand next year?');
  assert.equal(multiple.intent, 'multi');
  assert.equal(multiple.possibleDecision, '');
  assert.match(responseFor(multiple).title, /more than one possible decision/i);
});

test('Universal Response leaves incomplete decisions incomplete', () => {
  const draft = draftFromInput('Everything is a mess and I am not sure what to do.');
  assert.equal(draft.possibleDecision, '');
  assert.equal(draft.choices.length, 0);
  assert.match(responseFor(draft).title, /organize this first|start from here/i);
});
