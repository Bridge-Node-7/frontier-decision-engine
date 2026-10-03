import test from 'node:test';
import assert from 'node:assert/strict';
import { draftFromInput, responseFor } from '../site/src/universal-ui.js';

test('clear decision input produces a supportable brief candidate', () => {
  const draft = draftFromInput('Should we qualify an alternate source or redesign around the dependency? Schedule risk and resilience matter, but qualification may be late.');
  assert.equal(draft.intent, 'decision');
  assert.equal(draft.possibleDecision, 'Should we qualify an alternate source or redesign around the dependency');
  assert.deepEqual(draft.choices, ['qualify an alternate source', 'redesign around the dependency']);
  assert.deepEqual(draft.goals, ['Schedule risk', 'Resilience', 'Qualification']);
  assert.deepEqual(draft.futures, ['Timing gets worse']);
  assert.equal(responseFor(draft).kind, 'brief');
});

test('criteria lists do not override explicit binary choices', () => {
  const draft = draftFromInput('Should we qualify a second gallium nitride wafer supplier in Japan or keep our current Chinese supplier? We care about cost, schedule risk, and DFARS compliance.');
  assert.deepEqual(draft.choices, [
    'qualify a second gallium nitride wafer supplier in Japan',
    'keep our current Chinese supplier',
  ]);
  assert.deepEqual(draft.goals, ['Cost', 'Schedule risk', 'Compliance']);
  assert.equal(responseFor(draft).kind, 'brief');
});

test('decision title prefers the actual decision over leading blocker context', () => {
  const draft = draftFromInput('Qualification evidence is incomplete. Should we qualify Supplier Alpha or redesign around the dependency?');
  assert.equal(draft.possibleDecision, 'Should we qualify Supplier Alpha or redesign around the dependency');
});

test('institutional should-question produces readable choice labels', () => {
  const draft = draftFromInput('Should the ministry expand port capacity or defer investment?');
  assert.deepEqual(draft.choices, ['Ministry — expand port capacity', 'defer investment']);
});

test('sparse in-scope context returns a partial brief instead of a compulsory question', () => {
  for (const input of ['qualification evidence incomplete', 'The mission dependency is unclear.']) {
    const draft = draftFromInput(input);
    assert.equal(responseFor(draft).kind, 'brief', input);
    assert.equal(draft.possibleDecision, '', input);
  }
});

test('empty input remains an inline entry-state validation case', () => {
  assert.equal(responseFor(draftFromInput('')).kind, 'empty');
});

test('information request returns an honest capability boundary and useful next action', () => {
  const response = responseFor(draftFromInput('What is the current spot price of gallium?'));
  assert.equal(response.kind, 'boundary');
  assert.match(response.title, /does not retrieve outside facts/i);
  assert.match(response.body, /gather the fact|state the decision/i);
});

test('multiple decisions are preserved instead of forcing an immediate focus question', () => {
  const draft = draftFromInput('Should we qualify a second source? Should we redesign around the dependency? Should we build strategic inventory?');
  assert.equal(draft.intent, 'multi');
  assert.equal(draft.possibleDecision, '');
  assert.deepEqual(draft.decisionCandidates, [
    'Should we qualify a second source',
    'Should we redesign around the dependency',
    'Should we build strategic inventory',
  ]);
  assert.equal(responseFor(draft).kind, 'brief');
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

test('listed choices are preserved when they fit the formal comparison bound', () => {
  for (const input of [
    'Should we qualify Supplier Alpha, Supplier Bravo, or Supplier Charlie?',
    'We can dual-source, stockpile, or redesign. Which should we choose?',
    'Should we qualify the incumbent material, a substitute material, or a redesigned subsystem?',
  ]) {
    const draft = draftFromInput(input);
    assert.equal(draft.detectedChoiceCount, 3, input);
    assert.equal(draft.choices.length, 3, input);
    assert.equal(responseFor(draft).kind, 'brief', input);
  }
});

test('oversized choice sets are preserved in capture state rather than truncated', () => {
  const input = 'Choose between Supplier Alpha, Supplier Bravo, an alternate material, a reserve, or subsystem redesign.';
  const draft = draftFromInput(input);
  assert.equal(draft.optionListAmbiguous, true);
  assert.equal(draft.detectedChoiceCount, 5);
  assert.deepEqual(draft.choices, ['Supplier Alpha', 'Supplier Bravo', 'an alternate material', 'a reserve', 'subsystem redesign']);
  assert.equal(responseFor(draft).kind, 'brief');
});

test('generated oversized-choice corpus never drops source candidates', () => {
  let cases = 0;
  for (let count = 4; count <= 7; count += 1) {
    for (let variant = 0; variant < 40; variant += 1) {
      const options = Array.from({ length: count }, (_, index) => `qualification-path-${variant}-${index + 1}`);
      const input = `Choose between ${options.slice(0, -1).join(', ')}, or ${options.at(-1)}?`;
      const draft = draftFromInput(input);
      assert.equal(draft.optionListAmbiguous, true, input);
      assert.equal(draft.detectedChoiceCount, count, input);
      assert.equal(draft.choices.length, count, input);
      assert.equal(responseFor(draft).kind, 'brief', input);
      cases += 1;
    }
  }
  assert.ok(cases >= 160);
});

test('explicit criteria outside the keyword dictionary remain visible', () => {
  const draft = draftFromInput('Should we qualify Supplier Alpha or Supplier Bravo? Data residency, capex, measurement traceability, and corrosion resistance matter.');
  assert.deepEqual(draft.goals, ['Data residency', 'Capex', 'Measurement traceability', 'Corrosion resistance']);
});

test('oversized criteria sets remain preserved in capture state', () => {
  const draft = draftFromInput('Should we qualify Supplier Alpha or Supplier Bravo? Data residency, capex, measurement traceability, corrosion resistance, repairability, maintainability, and schedule matter.');
  assert.equal(draft.criteriaListAmbiguous, true);
  assert.equal(draft.detectedCriterionCount, 7);
  assert.equal(draft.goals.length, 7);
  assert.equal(responseFor(draft).kind, 'brief');
});

test('informational versus language is not converted into a decision choice set', () => {
  const information = draftFromInput('Explain qualification versus redesign for a new engineer.');
  assert.equal(information.intent, 'information');
  assert.deepEqual(information.choices, []);
  assert.equal(responseFor(information).kind, 'boundary');

  const decision = draftFromInput('Should we qualify Supplier Alpha versus Supplier Bravo?');
  assert.equal(decision.intent, 'decision');
  assert.deepEqual(decision.choices, ['qualify Supplier Alpha', 'Supplier Bravo']);
  assert.equal(responseFor(decision).kind, 'brief');
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
  }
});

test('out-of-scope severe personal restriction decisions fail closed', () => {
  for (const input of [
    'Should I stop eating to lose weight faster?',
    'Should I fast for five days or seven days?',
    'Should I skip all meals this week?',
    'Should I starve myself to reach my goal sooner?',
  ]) {
    const response = responseFor(draftFromInput(input));
    assert.equal(response.kind, 'boundary', input);
    assert.equal(response.title, 'This decision is outside FDE’s comparison scope.', input);
  }
});

test('out-of-scope personal dosing comparisons fail closed', () => {
  for (const input of [
    'Should I take 2 ibuprofen or 4 ibuprofen for this?',
    'Should I take 500 mg or 1000 mg acetaminophen?',
    'Should I use one dose or two doses of cough medicine?',
    'Should I take one tablet or three tablets of this medication?',
  ]) {
    const response = responseFor(draftFromInput(input));
    assert.equal(response.kind, 'boundary', input);
    assert.equal(response.title, 'This decision is outside FDE’s comparison scope.', input);
  }
});

test('out-of-scope immediate personal safety decisions fail closed', () => {
  for (const input of [
    'Should I drive myself to the ER or wait it out?',
    'Should I go to urgent care now or wait until morning?',
    'Should I call 911 or wait it out?',
    'Should I wait it out or head to the emergency room?',
  ]) {
    const response = responseFor(draftFromInput(input));
    assert.equal(response.kind, 'boundary', input);
    assert.equal(response.title, 'This decision is outside FDE’s comparison scope.', input);
  }
});

test('ordinary organizational decisions are not caught by personal boundaries', () => {
  for (const input of [
    'Should we qualify an alternate source or redesign around the dependency to save money?',
    'Should we reduce qualification scope or delay the readiness gate?',
    'Should we hold deployment pending evidence or proceed at the next readiness window?',
    'Should we field 2 redundant ground nodes or 4 redundant ground nodes?',
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
  ]) {
    const response = responseFor(draftFromInput(input));
    assert.equal(response.kind, 'boundary', input);
    assert.match(response.body, /988|emergency|support/i, input);
  }
});

test('supplier language using end-it-all idiom is not misclassified as personal crisis', () => {
  const input = 'Should we end it all with this supplier or renegotiate the contract? Cost and resilience matter.';
  const response = responseFor(draftFromInput(input));
  assert.equal(response.kind, 'brief');
});

test('ordinary criteria-list forms remain visible without becoming compulsory questions', () => {
  for (const input of [
    'Should we qualify or redesign? Cost, schedule risk, and readiness matter.',
    'Should we qualify or redesign? Our priorities are cost, readiness, and resilience.',
    'Should we qualify or redesign? The decision must balance cost, readiness, and interoperability.',
  ]) {
    const draft = draftFromInput(input);
    assert.deepEqual(draft.choices, ['qualify', 'redesign'], input);
    assert.equal(responseFor(draft).kind, 'brief', input);
  }
});

test('large criteria corpus preserves every explicit criterion before formal selection', () => {
  for (let count = 5; count <= 7; count += 1) {
    const criteria = Array.from({ length: count }, (_, index) => `criterion-${count}-${index + 1}`);
    const input = `Should we qualify Supplier Alpha or Supplier Bravo? ${criteria.join(', ')} matter.`;
    const draft = draftFromInput(input);
    assert.equal(draft.criteriaListAmbiguous, true, input);
    assert.equal(draft.goals.length, count, input);
    assert.equal(responseFor(draft).kind, 'brief', input);
  }
});

test('supportable decision remains distinct from unresolved evidence language', () => {
  const draft = draftFromInput('Evidence is incomplete and supplier capacity is uncertain. Should we qualify Supplier Alpha or retain the incumbent? Cost and continuity matter.');
  assert.equal(draft.possibleDecision, 'Should we qualify Supplier Alpha or retain the incumbent');
  assert.deepEqual(draft.choices, ['qualify Supplier Alpha', 'retain the incumbent']);
  assert.equal(responseFor(draft).kind, 'brief');
});

test('open context without a fabricated decision still produces a partial brief', () => {
  const draft = draftFromInput('The integration milestone is approaching and qualification evidence is incomplete.');
  assert.equal(draft.intent, 'open');
  assert.equal(draft.possibleDecision, '');
  assert.equal(responseFor(draft).kind, 'brief');
});

