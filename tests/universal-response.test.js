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

test('human input remains inert context and extracted fields remain explicit', () => {
  const input = '<script>alert("x")</script> Should we stay or go? Safety matters.';
  const draft = draftFromInput(input);
  assert.equal(draft.startingPoint, input);
  assert.equal(draft.choices.length, 2);
  assert.equal(draft.choices[1], 'go');
  assert.match(draft.choices[0], /stay/i);
  assert.ok(draft.goals.includes('Safety'));
});


test('multi-option lists never silently truncate into a partial option set', () => {
  const examples = [
    'Choose between vendor A, vendor B, vendor C, vendor D or build in-house.',
    'Should we pick option A, option B, or option C?',
    'We can lease, buy, or refurbish. Which should we choose?',
    'Should we use titanium, aluminium, or composite?',
  ];
  for (const input of examples) {
    const draft = draftFromInput(input);
    assert.equal(draft.optionListAmbiguous, true, input);
    assert.deepEqual(draft.choices, [], input);
    const response = responseFor(draft);
    assert.equal(response.kind, 'question', input);
    assert.equal(response.question, 'What options should we compare?', input);
  }
});

test('binary option extraction remains deterministic', () => {
  const draft = draftFromInput('Should we build internally or partner externally?');
  assert.equal(draft.optionListAmbiguous, false);
  assert.deepEqual(draft.choices, ['build internally', 'partner externally']);
  assert.equal(responseFor(draft).kind, 'structure');
});

test('generated multi-option corpus never exposes a strict partial option set', () => {
  const connectors = ['or', 'or', 'or'];
  let cases = 0;
  for (let count = 3; count <= 7; count += 1) {
    for (let variant = 0; variant < 60; variant += 1) {
      const options = Array.from({ length: count }, (_, index) => `option-${variant}-${index + 1}`);
      const prefix = variant % 2 === 0 ? 'Should we choose ' : 'Choose between ';
      const separator = variant % 3 === 0 ? ', ' : variant % 3 === 1 ? ',  ' : ', ';
      const input = `${prefix}${options.slice(0, -1).join(separator)}, ${connectors[variant % connectors.length]} ${options.at(-1)}?`;
      const draft = draftFromInput(input);
      assert.equal(draft.optionListAmbiguous, true, input);
      assert.equal(draft.choices.length, 0, input);
      assert.equal(responseFor(draft).question, 'What options should we compare?', input);
      cases += 1;
    }
  }
  assert.ok(cases >= 250);
});

test('prescribed treatment changes use a bounded safety response', () => {
  const response = responseFor(draftFromInput('Should I stop taking my heart medication to save money?'));
  assert.equal(response.kind, 'boundary');
  assert.match(response.title, /qualified clinical guidance/i);
  assert.match(response.body, /should not recommend/i);
  assert.match(response.body, /cost, access, logistics/i);
});

test('ordinary non-medical cost decisions are not caught by the treatment boundary', () => {
  const response = responseFor(draftFromInput('Should we build internally or partner externally to save money?'));
  assert.equal(response.kind, 'structure');
});
