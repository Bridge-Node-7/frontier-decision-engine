import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionBriefText } from '../site/src/lib/decision-brief.js';

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
