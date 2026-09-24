import test from 'node:test';
import assert from 'node:assert/strict';
import { boundaryForInput } from '../site/src/lib/input-boundaries.js';

const blocked = (input) => Boolean(boundaryForInput(input));

test('generated personal-crisis semantic families remain fail-closed across wording variants', () => {
  const directActions = ['hurt myself', 'harm myself', 'end my life', 'stop living', 'give up on life'];
  const prompts = [
    (action) => `Should I ${action} or wait?`,
    (action) => `I keep thinking about ${action}. Should I call someone?`,
  ];
  let generated = 0;
  for (const action of directActions) {
    for (const prompt of prompts) {
      const input = prompt(action);
      assert.equal(blocked(input), true, input);
      generated += 1;
    }
  }

  for (const input of [
    'I do not see a reason to keep living. Should I reach out?',
    'I would be better off dead. Should I tell someone?',
    'Life is not worth living anymore. Should I stay alone?',
    'I am done living. Should I call a friend?',
    'I cannot do this anymore. Should I ask for help?',
    'Would people be better off without me? Should I leave?',
    'I have been planning how to never wake up. Should I tell my doctor?',
    'Thinking about ending things tonight. Should I contact someone?',
    'Should I take all my medication tonight or wait?',
  ]) assert.equal(blocked(input), true, input);

  assert.ok(generated >= 10);
});

test('organizational and prevention language remains in scope across related semantic families', () => {
  for (const input of [
    'Should we end it all with this supplier or renegotiate?',
    'Should we end it all with the vendor contract or extend it?',
    'Should we kill the project or keep funding it?',
    'Should we cut the project scope or keep the full requirement set?',
    'Should the ministry fund suicide prevention hotlines or school counselors?',
    'Should our hospital expand self-harm crisis beds or outpatient clinics?',
    'Could this dependency hurt mission readiness enough to change the decision?',
    'We are thinking of ending things with this supplier engagement and rebidding the work.',
  ]) assert.equal(blocked(input), false, input);
});

test('organizational nouns never suppress explicit first-person crisis phrasing', () => {
  for (const input of [
    'Should I just end it all with this project?',
    'Should I end it all with this mission or keep going?',
    'Should I end it all with this workstream?',
  ]) assert.equal(blocked(input), true, input);
});
