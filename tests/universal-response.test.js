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

test('criteria lists do not override explicit binary choices from ordinary language', () => {
  const input = 'Should we qualify a second gallium nitride wafer supplier in Japan or keep our current Chinese supplier? We care about cost, schedule risk, and DFARS compliance.';
  const draft = draftFromInput(input);
  assert.equal(draft.intent, 'decision');
  assert.equal(draft.optionListAmbiguous, false);
  assert.deepEqual(draft.choices, [
    'qualify a second gallium nitride wafer supplier in Japan',
    'keep our current Chinese supplier',
  ]);
  assert.deepEqual(draft.goals, ['Cost', 'Schedule risk', 'Compliance']);
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
    assert.equal(response.question, 'What choices should we compare?', input);
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
      assert.equal(responseFor(draft).question, 'What choices should we compare?', input);
      cases += 1;
    }
  }
  assert.ok(cases >= 250);
});

test('out-of-scope personal treatment decisions fail closed', () => {
  const examples = [
    'Should I stop taking my heart medication to save money?',
    'Should I halve my insulin dose to make it last?',
    'Should I skip my chemotherapy session because it is expensive?',
    'Should I stop my antidepressants cold turkey?',
    'Should I ration my prescription until next month?',
  ];
  for (const input of examples) {
    const response = responseFor(draftFromInput(input));
    assert.equal(response.kind, 'boundary', input);
    assert.equal(response.title, 'This decision is outside FDE’s comparison scope.', input);
    assert.match(response.body, /technical, organizational, mission, and strategic/i, input);
    assert.match(response.body, /qualified support/i, input);
  }
});

test('out-of-scope severe personal restriction decisions fail closed', () => {
  const examples = [
    'Should I stop eating to lose weight faster?',
    'Should I fast for five days or seven days?',
    'Should I skip all meals this week?',
    'Should I starve myself to reach my goal sooner?',
  ];
  for (const input of examples) {
    const response = responseFor(draftFromInput(input));
    assert.equal(response.kind, 'boundary', input);
    assert.equal(response.title, 'This decision is outside FDE’s comparison scope.', input);
    assert.match(response.body, /technical, organizational, mission, and strategic/i, input);
  }
});

test('out-of-scope personal dosing comparisons fail closed', () => {
  const examples = [
    'Should I take 2 ibuprofen or 4 ibuprofen for this?',
    'Should I take 500 mg or 1000 mg acetaminophen?',
    'Should I use one dose or two doses of cough medicine?',
    'Should I take one tablet or three tablets of this medication?',
  ];
  for (const input of examples) {
    const response = responseFor(draftFromInput(input));
    assert.equal(response.kind, 'boundary', input);
    assert.equal(response.title, 'This decision is outside FDE’s comparison scope.', input);
    assert.match(response.body, /technical, organizational, mission, and strategic/i, input);
    assert.match(response.body, /qualified support/i, input);
  }
});

test('out-of-scope immediate personal safety decisions fail closed', () => {
  const examples = [
    'Should I drive myself to the ER or wait it out?',
    'Should I go to urgent care now or wait until morning?',
    'Should I call 911 or wait it out?',
    'Should I wait it out or head to the emergency room?',
  ];
  for (const input of examples) {
    const response = responseFor(draftFromInput(input));
    assert.equal(response.kind, 'boundary', input);
    assert.equal(response.title, 'This decision is outside FDE’s comparison scope.', input);
    assert.match(response.body, /technical, organizational, mission, and strategic/i, input);
    assert.match(response.body, /qualified real-time support/i, input);
  }
});

test('ordinary non-medical decisions are not caught by personal safety boundaries', () => {
  for (const input of [
    'Should we build internally or partner externally to save money?',
    'Should we reduce project scope or delay launch?',
    'Should we skip deployment this weekend or ship Monday?',
    'Should we choose the fast supplier or the reliable supplier?',
    'Should I buy 2 servers or 4 servers?',
    'Should we use 2 GB or 4 GB of memory?',
    'Should we delay the emergency response software release or ship now?',
  ]) {
    const response = responseFor(draftFromInput(input));
    assert.notEqual(response.kind === 'boundary' && response.title === 'This decision is outside FDE’s comparison scope.', true, input);
  }
});

test('self-harm requests fail closed before ordinary decision structuring', () => {
  for (const input of [
    'Should I hurt myself or not?',
    'Should I kill myself or keep going?',
    'Should I end my life?',
    'I am suicidal and deciding what to do.',
    'Should I self-harm or call someone?',
  ]) {
    const response = responseFor(draftFromInput(input));
    assert.equal(response.kind, 'boundary', input);
    assert.equal(response.title, 'This decision is outside FDE’s comparison scope.', input);
    assert.match(response.body, /does not compare or optimize self-harm/i, input);
    assert.match(response.body, /emergency services|crisis service/i, input);
  }
});

test('ordinary engineering and business harm language does not trigger the personal boundary', () => {
  for (const input of [
    'Should we kill the stalled process or restart it?',
    'Could this policy harm revenue enough to change the decision?',
    'Should we terminate the failed test or continue collecting data?',
  ]) {
    const response = responseFor(draftFromInput(input));
    assert.notEqual(response.kind === 'boundary' && response.title === 'This decision is outside FDE’s comparison scope.', true, input);
  }
});

test('mission criteria use bounded phrase matching without substring false positives', () => {
  const costa = draftFromInput('Should we expand into Costa Rica or Panama? Reliability and resilience matter.');
  assert.deepEqual(costa.choices, ['expand into Costa Rica', 'Panama']);
  assert.equal(costa.goals.includes('Cost'), false);
  assert.deepEqual(costa.goals, ['Reliability', 'Resilience']);

  const mission = draftFromInput('Should we impose export controls or negotiate supply agreements with allies? National security, cost, and time matter.');
  assert.equal(mission.optionListAmbiguous, false);
  assert.deepEqual(mission.choices, ['impose export controls', 'negotiate supply agreements with allies']);
  assert.deepEqual(mission.goals, ['National security', 'Cost', 'Time']);
  assert.equal(responseFor(mission).kind, 'structure');
});

test('ordinary criteria-list forms do not override explicit choices', () => {
  for (const input of [
    'Should we build or buy? Cost, schedule risk, and readiness matter.',
    'Should we build or buy? Cost, schedule risk, and readiness are important.',
    'Should we build or buy? Our priorities are cost, readiness, and resilience.',
    'Should we build or buy? The decision must balance cost, readiness, and interoperability.',
  ]) {
    const draft = draftFromInput(input);
    assert.equal(draft.optionListAmbiguous, false, input);
    assert.deepEqual(draft.choices, ['build', 'buy'], input);
    assert.equal(responseFor(draft).kind, 'structure', input);
  }
});

