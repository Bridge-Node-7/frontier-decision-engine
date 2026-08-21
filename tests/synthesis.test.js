import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDecisionCase } from '../site/src/lib/decision.js';
import { activateDecisionSemantics } from '../site/src/lib/semantics.js';
import { deriveDecisionSynthesis } from '../site/src/lib/synthesis.js';
import { createDecisionRecord } from '../site/src/lib/recording.js';
import { buildDecisionHtml } from '../site/src/decision-ui.js';

function decision() {
  const value = createDecisionCase();
  activateDecisionSemantics(value, 'sustainability-seer');
  value.decision_semantics.proceed_conditions_state = 'none-required';
  value.decision_semantics.criteria.forEach((criterion) => {
    criterion.label = `${criterion.dimension} requirement`;
    criterion.requirement = `${criterion.dimension} must remain acceptable`;
    criterion.evidence_state = 'supported';
    criterion.outcome = 'meets';
  });
  value.human_decision.selected_strategy_id = value.strategies[0].strategy_id;
  value.human_decision.rationale = 'A human records this choice after reviewing the trade-offs.';
  value.human_decision.next_action = 'Review the bounded next action with the decision owner.';
  return value;
}

test('shared synthesis keeps posture, comparison, and human decision distinct', () => {
  const value = decision();
  const result = deriveDecisionSynthesis(value);
  assert.equal(result.posture, 'ADVANCE');
  assert.equal(result.reason_category, 'proceed-conditions-satisfied');
  assert.ok(result.strongest_alternative?.label);
  assert.ok(result.selected_human_choice?.label);
  assert.equal(result.recorded_human_decision, null);
  const recorded = deriveDecisionSynthesis(value, createDecisionRecord(value));
  assert.equal(recorded.recorded_human_decision.label, result.selected_human_choice.label);
});

test('shared synthesis reports a structured controlling reason', () => {
  const value = decision();
  const criterion = value.decision_semantics.criteria[0];
  criterion.must_be_true = true;
  criterion.outcome = 'does-not-meet';
  const result = deriveDecisionSynthesis(value);
  assert.equal(result.posture, 'STOP');
  assert.equal(result.reason_category, 'required-criterion-failed');
  assert.match(result.controlling_issue, /required/i);
});

test('readable brief consumes the shared synthesis', () => {
  const value = decision();
  const synthesis = deriveDecisionSynthesis(value);
  const html = buildDecisionHtml(createDecisionRecord(value));
  assert.match(html, /Decision signature/);
  assert.ok(html.includes(synthesis.controlling_issue));
  assert.ok(html.includes(synthesis.strongest_alternative.label));
  assert.match(html, /Recorded human decision/);
});

test('public source exposes progressive projections and truthful traceability', async () => {
  const source = await readFile(new URL('../site/src/decision-ui.js', import.meta.url), 'utf8');
  assert.match(source, /data-projection="brief"/);
  assert.match(source, /data-projection="review"/);
  assert.match(source, /data-projection="inspect"/);
  assert.match(source, /data-projection="decision-signature"/);
  assert.match(source, /data-surface="semantic-model"/);
  assert.match(source, /not an arithmetic conversion/);
  const noJs = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
  assert.match(noJs, /Six stages/);
  assert.match(noJs, /not presented as an approved environment/);
});

test('legacy walkthrough is only a compatibility shim into integrated help', async () => {
  const source = await readFile(new URL('../site/start.html', import.meta.url), 'utf8');
  assert.match(source, /location\.replace\('\.\/index\.html#\/method'\)/);
  assert.match(source, /http-equiv="refresh" content="0; url=\.\/index\.html#\/method"/);
  assert.doesNotMatch(source, /example-panel|walkthrough-progress|Start walkthrough/);
});

test('canonical FDE is one progressive page with integrated method and compatible routes', async () => {
  const source = await readFile(new URL('../site/src/decision-ui.js', import.meta.url), 'utf8');
  const app = await readFile(new URL('../site/src/app.js', import.meta.url), 'utf8');
  assert.match(source, /data-surface="working-interface"/);
  assert.match(source, /data-surface="integrated-method"/);
  assert.match(source, /What decision needs to be made\?/);
  assert.match(source, /primary-decision-field/);
  assert.match(source, /id="use-ready-example"/);
  assert.match(source, /data-decision-stage/);
  assert.match(source, /class="entry-utilities"/);
  assert.match(source, /Show technical terms/);
  assert.doesNotMatch(source, /Other ways to begin/);
  assert.match(app, /'\/method'/);
  assert.match(app, /focusMethod: path === '\/method'/);
  assert.doesNotMatch(app, /renderMethod|renderHome/);
});

test('0.3.0 score rationale is optional, portable, and does not alter comparison', () => {
  const value = decision();
  const before = deriveDecisionSynthesis(value);
  value.strategies[0].score_rationales['OBJ-001'] = { basis: 'analyst-judgment', rationale: 'Qualification has begun, but acceptance evidence is incomplete.' };
  const roundTrip = JSON.parse(JSON.stringify(value));
  assert.deepEqual(roundTrip.strategies[0].score_rationales['OBJ-001'], value.strategies[0].score_rationales['OBJ-001']);
  assert.deepEqual(deriveDecisionSynthesis(roundTrip), before);
});
