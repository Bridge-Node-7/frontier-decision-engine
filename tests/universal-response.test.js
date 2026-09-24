import test from 'node:test';
import assert from 'node:assert/strict';
import { draftFromInput, responseFor } from '../site/src/universal-ui.js';

test('clear decision input produces only supportable deterministic structure', () => {
  const draft = draftFromInput('Should we qualify an alternate source or redesign around the dependency? Schedule risk and resilience matter, but qualification may be late.');
  assert.equal(draft.intent, 'decision');
  assert.equal(draft.possibleDecision, 'Should we qualify an alternate source or redesign around the dependency');
  assert.deepEqual(draft.choices, ['qualify an alternate source', 'redesign around the dependency']);
  assert.deepEqual(draft.goals, ['Schedule risk', 'Resilience', 'Qualification']);
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

test('decision title prefers the actual decision over leading blocker context', () => {
  const draft = draftFromInput('Qualification evidence is incomplete. Should we qualify Supplier Alpha or redesign around the dependency?');
  assert.equal(draft.possibleDecision, 'Should we qualify Supplier Alpha or redesign around the dependency');
});

test('institutional should-question produces readable choice labels', () => {
  const draft = draftFromInput('Should the ministry expand port capacity or defer investment?');
  assert.deepEqual(draft.choices, ['Ministry — expand port capacity', 'defer investment']);
});

test('sparse input produces exactly one useful clarification question', () => {
  for (const input of ['', 'qualification evidence incomplete', 'The mission dependency is unclear.']) {
    const response = responseFor(draftFromInput(input));
    assert.equal(response.kind, 'question');
    assert.match(response.question, /which decision or question/i);
    assert.equal(Object.keys(response).filter((key) => key === 'question').length, 1);
  }
});

test('information request returns an honest capability boundary and useful next action', () => {
  const response = responseFor(draftFromInput('What is the current spot price of gallium?'));
  assert.equal(response.kind, 'boundary');
  assert.match(response.title, /does not retrieve outside facts/i);
  assert.match(response.body, /gather the fact|state the decision/i);
});

test('multiple decisions ask for one focus instead of fabricating a combined model', () => {
  const draft = draftFromInput('Should we qualify a second source? Should we redesign around the dependency?');
  assert.equal(draft.intent, 'multi');
  assert.equal(draft.possibleDecision, '');
  const response = responseFor(draft);
  assert.equal(response.kind, 'question');
  assert.match(response.question, /focus on first/i);
});

test('human input remains inert context and extracted fields remain explicit', () => {
  const input = '<script>alert("x")</script> Should we qualify now or hold? Mission safety matters.';
  const draft = draftFromInput(input);
  assert.equal(draft.startingPoint, input);
  assert.equal(draft.choices.length, 2);
  assert.equal(draft.choices[1], 'hold');
  assert.match(draft.choices[0], /qualify now/i);
  assert.ok(draft.goals.includes('Safety'));
});

test('listed choices are preserved when they fit the comparison bound', () => {
  for (const input of [
    'Should we qualify Supplier Alpha, Supplier Bravo, or Supplier Charlie?',
    'We can dual-source, stockpile, or redesign. Which should we choose?',
    'Should we qualify the incumbent material, a substitute material, or a redesigned subsystem?',
  ]) {
    const draft = draftFromInput(input);
    assert.equal(draft.optionListAmbiguous, false, input);
    assert.equal(draft.detectedChoiceCount, 3, input);
    assert.equal(draft.choices.length, 3, input);
    assert.equal(responseFor(draft).kind, 'structure', input);
  }
});

test('oversized listed choices ask the user to choose up to the supported bound', () => {
  const input = 'Choose between Supplier Alpha, Supplier Bravo, an alternate material, a reserve, or subsystem redesign.';
  const draft = draftFromInput(input);
  assert.equal(draft.optionListAmbiguous, true);
  assert.equal(draft.detectedChoiceCount, 5);
  assert.deepEqual(draft.choices, []);
  const response = responseFor(draft);
  assert.equal(response.kind, 'question');
  assert.equal(response.question, 'I found 5 possible choices. Choose up to 3 to compare.');
});

test('binary option extraction remains deterministic', () => {
  const draft = draftFromInput('Should we qualify an alternate source or redesign around the dependency?');
  assert.equal(draft.optionListAmbiguous, false);
  assert.deepEqual(draft.choices, ['qualify an alternate source', 'redesign around the dependency']);
  assert.equal(responseFor(draft).kind, 'structure');
});

test('generated oversized-choice corpus never exposes a strict partial option set', () => {
  let cases = 0;
  for (let count = 4; count <= 7; count += 1) {
    for (let variant = 0; variant < 60; variant += 1) {
      const options = Array.from({ length: count }, (_, index) => `qualification-path-${variant}-${index + 1}`);
      const prefix = variant % 2 === 0 ? 'Should we choose ' : 'Choose between ';
      const separator = variant % 3 === 0 ? ', ' : variant % 3 === 1 ? ',  ' : ', ';
      const input = `${prefix}${options.slice(0, -1).join(separator)}, or ${options.at(-1)}?`;
      const draft = draftFromInput(input);
      assert.equal(draft.optionListAmbiguous, true, input);
      assert.equal(draft.detectedChoiceCount, count, input);
      assert.equal(draft.choices.length, 0, input);
      assert.equal(responseFor(draft).question, `I found ${count} possible choices. Choose up to 3 to compare.`, input);
      cases += 1;
    }
  }
  assert.ok(cases >= 200);
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
    'Should we qualify an alternate source or redesign around the dependency to save money?',
    'Should we reduce qualification scope or delay the readiness gate?',
    'Should we hold deployment pending evidence or proceed at the next readiness window?',
    'Should we qualify the faster source or the more reliable source?',
    'Should we field 2 redundant ground nodes or 4 redundant ground nodes?',
    'Should the mission processor reserve 2 GB or 4 GB of memory?',
    'Should we delay the mission-control software release or proceed at the current readiness gate?',
  ]) {
    const response = responseFor(draftFromInput(input));
    assert.notEqual(response.kind === 'boundary' && response.title === 'This decision is outside FDE’s comparison scope.', true, input);
  }
});

test('self-directed crisis language fails closed before ordinary decision structuring', () => {
  for (const input of [
    'Should I hurt myself or not?',
    'Should I kill myself or keep going?',
    'Should I end my life?',
    'I am suicidal and deciding what to do.',
    'Should I self-harm or call someone?',
    'I want to die.',
    'I want to end it all.',
    'end it all',
    'Should I cut myself or call someone?',
    'I cannot keep living like this.',
  ]) {
    const response = responseFor(draftFromInput(input));
    assert.equal(response.kind, 'boundary', input);
    assert.equal(response.title, 'This decision is outside FDE’s comparison scope.', input);
    assert.match(response.body, /does not compare or optimize self-harm/i, input);
    assert.match(response.body, /988/i, input);
  }
});

test('specific crisis language and neutral personal scope both fail closed without blocking supplier idiom', () => {
  const crisis = responseFor(draftFromInput('Should I just end it all?'));
  assert.equal(crisis.kind, 'boundary');
  assert.match(crisis.body, /988/);

  for (const input of [
    'Should I stop living in London and move to Leeds?',
    'Should I give up on life coaching as a career or continue?',
  ]) {
    const personal = responseFor(draftFromInput(input));
    assert.equal(personal.kind, 'boundary', input);
    assert.match(personal.body, /personal-life decisions/i, input);
    assert.match(personal.body, /not a clinical judgment/i, input);
    assert.doesNotMatch(personal.body, /does not compare or optimize self-harm/i, input);
  }

  const supplier = responseFor(draftFromInput('Should we end it all with this supplier or renegotiate?'));
  assert.notEqual(supplier.kind === 'boundary' && supplier.title === 'This decision is outside FDE’s comparison scope.', true);
});

test('organizational prevention decisions are not mistaken for first-person self-harm', () => {
  for (const input of [
    'Should the ministry fund suicide prevention hotlines or school counselors?',
    'Should we expand suicide prevention training or crisis-response staffing?',
    'Should the program measure self-harm prevention outcomes or referral completion?',
  ]) {
    const response = responseFor(draftFromInput(input));
    assert.notEqual(response.kind === 'boundary' && response.title === 'This decision is outside FDE’s comparison scope.', true, input);
  }
});

test('ordinary engineering and business harm language does not trigger the personal boundary', () => {
  for (const input of [
    'Should we terminate the failed qualification run or restart it?',
    'Could this dependency harm mission readiness enough to change the decision?',
    'Should we terminate the failed verification run or continue collecting evidence?',
  ]) {
    const response = responseFor(draftFromInput(input));
    assert.notEqual(response.kind === 'boundary' && response.title === 'This decision is outside FDE’s comparison scope.', true, input);
  }
});

test('mission criteria use bounded phrase matching without substring false positives', () => {
  const costa = draftFromInput('Should we qualify Costara Materials or retain the incumbent source? Reliability and resilience matter.');
  assert.deepEqual(costa.choices, ['qualify Costara Materials', 'retain the incumbent source']);
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
    'Should we qualify or redesign? Cost, schedule risk, and readiness matter.',
    'Should we qualify or redesign? Cost, schedule risk, and readiness are important.',
    'Should we qualify or redesign? Our priorities are cost, readiness, and resilience.',
    'Should we qualify or redesign? The decision must balance cost, readiness, and interoperability.',
  ]) {
    const draft = draftFromInput(input);
    assert.equal(draft.optionListAmbiguous, false, input);
    assert.deepEqual(draft.choices, ['qualify', 'redesign'], input);
    assert.equal(responseFor(draft).kind, 'structure', input);
  }
});



test('explicit criteria outside the keyword dictionary remain visible for human confirmation', () => {
  const draft = draftFromInput('Should we qualify Supplier Alpha or Supplier Bravo? Data residency, capex, measurement traceability, and corrosion resistance matter.');
  assert.equal(draft.criteriaListAmbiguous, false);
  assert.deepEqual(draft.goals, ['Data residency', 'Capex', 'Measurement traceability', 'Corrosion resistance']);
  assert.equal(responseFor(draft).kind, 'structure');
});

test('oversized explicit criteria sets ask for bounded human selection instead of silently truncating', () => {
  const draft = draftFromInput('Should we qualify Supplier Alpha or Supplier Bravo? Data residency, capex, measurement traceability, corrosion resistance, and repairability matter.');
  assert.equal(draft.criteriaListAmbiguous, true);
  assert.equal(draft.detectedCriterionCount, 5);
  assert.deepEqual(draft.goals, []);
  const response = responseFor(draft);
  assert.equal(response.kind, 'question');
  assert.equal(response.question, 'I found 5 possible criteria. Choose up to 4 to keep.');
});

test('informational versus language is not converted into a decision choice set', () => {
  const information = draftFromInput('Explain qualification versus redesign for a new engineer.');
  assert.equal(information.intent, 'information');
  assert.deepEqual(information.choices, []);
  assert.equal(responseFor(information).kind, 'boundary');

  const decision = draftFromInput('Should we qualify Supplier Alpha versus Supplier Bravo?');
  assert.equal(decision.intent, 'decision');
  assert.deepEqual(decision.choices, ['qualify Supplier Alpha', 'Supplier Bravo']);
  assert.equal(responseFor(decision).kind, 'structure');
});
