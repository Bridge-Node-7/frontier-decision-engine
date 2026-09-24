import test from 'node:test';
import assert from 'node:assert/strict';
import { boundaryForInput } from '../site/src/lib/input-boundaries.js';

test('first-person personal-life decisions fail closed by scope without requiring distress classification', () => {
  for (const input of [
    'Should I move to another city or stay?',
    'Should I take a sabbatical or continue working?',
    'I am deciding whether to sell my car or keep it.',
    'Should I take all my annual leave in December or spread it across the year?',
    'Should I stop living in London and move to Leeds?',
    'Should I give up on life coaching as a career or continue?',
  ]) {
    const boundary = boundaryForInput(input);
    assert.equal(boundary?.kind, 'out_of_scope_personal_decision', input);
    assert.match(boundary.body, /not a clinical judgment/i, input);
  }
});

test('clearly organizational first-person decisions and policy discussion remain in scope', () => {
  for (const input of [
    'Should I approve this supplier qualification or request more evidence?',
    'Should I kill this feature or keep maintaining it?',
    'Should I resign from the board or serve out my term?',
    'Should I move the deployment to another region?',
    'Should I migrate the system to the alternate platform?',
    'Should I expand the pilot or stop it?',
    'I selected Option A because the evidence supports it.',
    'Should the ministry fund suicide prevention hotlines or school counselors?',
    'Should our hospital expand self-harm crisis beds or outpatient clinics?',
    'Should we end it all with this supplier or renegotiate?',
  ]) assert.equal(boundaryForInput(input), null, input);
});

test('high-confidence self-harm language retains the specific crisis boundary', () => {
  for (const input of [
    'Should I hurt myself or call someone?',
    'I am suicidal and deciding what to do.',
    'I want to die.',
    'Should I self-terminate or keep going?',
    'Should I just end it all?',
    'Should I take all my pills tonight or wait?',
  ]) {
    const boundary = boundaryForInput(input);
    assert.equal(boundary?.kind, 'out_of_scope_self_harm', input);
    assert.match(boundary.body, /988/i, input);
  }
});
