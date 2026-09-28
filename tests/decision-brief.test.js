import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionBriefText, nextProofPresentation, preparedBottomLine } from '../site/src/lib/decision-brief.js';

test('decision brief leads with decision value and preserves human authority', () => {
  const text = buildDecisionBriefText({
    decision: 'Which path should we choose?', owner: 'Program lead', authority: 'Accountable decision-maker',
    leadingChoice: 'Path B', selectedChoice: 'Path A', assurancePosture: 'HOLD',
    controllingIssue: 'Required qualification evidence is unresolved.',
    changes: ['Qualification completes'], nextProof: ['Qualification: Confirm test completion'],
    nextAction: 'Request the qualification record.',
  });
  assert.match(text, /What held up: Path B/);
  assert.match(text, /Selected choice: Path A/);
  assert.match(text, /Next Proof:\n- Qualification: Confirm test completion/);
  assert.match(text, /The comparison informs\. A person decides\./);
});

test('decision brief surfaces score provenance without implying measured precision', () => {
  const text = buildDecisionBriefText({
    decision: 'Proceed?',
    scoreProvenance: ['Analyst judgment: 3', 'Declared rubric: 2', 'Not documented: 1'],
  });
  assert.match(text, /Score provenance:\n- Analyst judgment: 3\n- Declared rubric: 2\n- Not documented: 1/);
  assert.match(text, /not probabilities or native measurements/);
  assert.match(text, /precision the evidence supports/);
});

test('decision brief does not invent a proof source', () => {
  const text = buildDecisionBriefText({ nextProof: ['Qualification timing: Confirm qualification timing'] });
  assert.match(text, /Confirm qualification timing/);
  assert.doesNotMatch(text, /supplier VP|audited production schedule/i);
});

test('decision brief states when no required proof blocks the formal gate', () => {
  const text = buildDecisionBriefText({ decision: 'Proceed?' });
  assert.match(text, /No required proof currently blocks the formal evidence gate/);
});

test('decision brief is explicitly distinct from the Decision Receipt', () => {
  const text = buildDecisionBriefText({ decision: 'Proceed?' });
  assert.match(text, /Working brief — not a Decision Receipt/);
});


test('decision brief states unresolved proof when readiness blocks but the evidence need is not yet named', () => {
  const text = buildDecisionBriefText({ decision: 'Proceed?', evidenceReadiness: 'proof-required' });
  assert.match(text, /Required proof remains unresolved\. Name the evidence needed for each required criterion\./);
  assert.doesNotMatch(text, /No required proof currently blocks the formal evidence gate/);
});


test('next proof presentation keeps a blocked readiness state when no proof request is named yet', () => {
  const proof = nextProofPresentation({ readinessState: 'proof-required', nextProof: [] });
  assert.deepEqual(proof.items, []);
  assert.equal(proof.emptyMessage, 'Required proof remains unresolved. Name the evidence needed for each required criterion.');
  assert.match(proof.nextAction, /Resolve the required proof/);
});


test('prepared bottom line fails closed when required evidence remains unresolved', () => {
  assert.equal(
    preparedBottomLine({
      assurancePosture: 'ADVANCE',
      leadingChoice: 'Path B',
      evidenceReadiness: 'proof-required',
    }),
    'HOLD — required evidence remains unresolved.',
  );
});

test('prepared bottom line translates every declared assurance posture without claiming human authority', () => {
  const cases = [
    ['STOP', 'DO NOT PROCEED — a required criterion failed.'],
    ['REWORK', 'REWORK BEFORE COMMITMENT — required remediation remains open.'],
    ['HOLD', 'HOLD — the declared assurance posture does not support commitment yet.'],
    ['ADVANCE WITH CONDITIONS', 'PROCEED WITH CONDITIONS — the declared assurance posture supports bounded advancement.'],
    ['ADVANCE', 'PROCEED — the declared assurance posture supports advancement.'],
  ];
  for (const [assurancePosture, expected] of cases) {
    assert.equal(
      preparedBottomLine({
        assurancePosture,
        leadingChoice: 'Path B',
        evidenceReadiness: 'ready',
      }),
      expected,
    );
  }
  assert.equal(
    preparedBottomLine({
      assurancePosture: 'Inactive',
      leadingChoice: 'Path B',
      evidenceReadiness: 'ready',
    }),
    'COMPARISON ONLY — Path B currently holds up in the declared model.',
  );
});

test('decision brief leads with the prepared bottom line before detailed decision fields', () => {
  const text = buildDecisionBriefText({
    decision: 'Proceed?',
    leadingChoice: 'Path B',
    assurancePosture: 'HOLD',
    controllingIssue: 'Required qualification evidence is unresolved.',
    evidenceReadiness: 'proof-required',
  });
  const bottomLine = text.indexOf('Prepared bottom line: HOLD — required evidence remains unresolved.');
  const decision = text.indexOf('Decision: Proceed?');
  assert.ok(bottomLine > -1);
  assert.ok(decision > bottomLine);
  assert.match(text, /Working brief — not a Decision Receipt/);
});
