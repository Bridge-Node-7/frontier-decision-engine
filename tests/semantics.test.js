import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildPerformanceMatrix,
  createDecisionCase,
  robustCandidateDecision,
  summarizeStrategies,
  validateCompletedDecisionCase,
  validateDecisionCase,
  validateDraftDecisionCase,
  vulnerabilityMap,
} from '../site/src/lib/decision.js';
import {
  activateDecisionSemantics,
  createDecisionSemantics,
  decisionPosture,
  semanticView,
  setCautiousOverride,
  summarizeFourP,
  updateVisibleCondition,
  updateVisibleMonitoring,
  validateDecisionSemantics,
} from '../site/src/lib/semantics.js';
import { createDraftBackup, parseDecisionFile } from '../site/src/lib/persistence.js';

function seerDecision() {
  const decision = createDecisionCase();
  activateDecisionSemantics(decision, 'sustainability-seer');
  decision.decision_semantics.criteria.forEach((criterion) => {
    criterion.label = `${criterion.dimension} requirement`;
    criterion.requirement = `${criterion.dimension} must satisfy its declared requirement`;
    criterion.evidence_state = 'supported';
    criterion.outcome = 'meets';
  });
  return decision;
}

function requiredCriterion(decision, dimension = 'people') {
  const criterion = decision.decision_semantics.criteria.find((item) => item.dimension === dimension);
  criterion.must_be_true = true;
  decision.decision_semantics.proceed_conditions_state = 'declared';
  return criterion;
}

test('accepted-A General comparison is deep-equal after inactive B normalization', () => {
  const before = createDecisionCase();
  const expected = {
    matrix: buildPerformanceMatrix(before),
    summaries: summarizeStrategies(before),
    candidate: robustCandidateDecision(before),
    vulnerabilities: vulnerabilityMap(before, 'STR-002'),
  };
  assert.equal(before.schema_version, '0.2.10');
  assert.equal(semanticView(before).mode, 'general');
  assert.equal(decisionPosture(before).posture, null);
  activateDecisionSemantics(before, 'general');
  assert.equal(before.schema_version, '0.3.0');
  assert.deepEqual(buildPerformanceMatrix(before), expected.matrix);
  assert.deepEqual(summarizeStrategies(before), expected.summaries);
  assert.deepEqual(robustCandidateDecision(before), expected.candidate);
  assert.deepEqual(vulnerabilityMap(before, 'STR-002'), expected.vulnerabilities);
  assert.equal(decisionPosture(before).posture, null);
});

test('legacy 0.2.10 remains untouched until B semantics are explicitly activated', () => {
  const decision = createDecisionCase();
  assert.equal(decision.schema_version, '0.2.10');
  assert.equal(decision.decision_semantics, undefined);
  assert.equal(validateDecisionCase(decision).valid, true);
  activateDecisionSemantics(decision, 'sustainability-seer');
  assert.equal(decision.schema_version, '0.3.0');
  assert.equal(decision.profile, 'critical-minerals-readiness');
  assert.equal(decision.decision_semantics.mode, 'sustainability-seer');
});

test('schema 0.3.0 is parallel and preserves the legacy schema identity', async () => {
  const legacy = JSON.parse(await readFile(new URL('../schemas/decision.schema.json', import.meta.url), 'utf8'));
  const current = JSON.parse(await readFile(new URL('../schemas/decision-0.3.0.schema.json', import.meta.url), 'utf8'));
  assert.equal(legacy.properties.schema_version.const, '0.2.10');
  assert.equal(current.properties.schema_version.const, '0.3.0');
  assert.ok(current.required.includes('decision_semantics'));
});

test('completed SEER requires all Four Ps and usable criterion descriptions', () => {
  const decision = seerDecision();
  decision.human_decision = { selected_strategy_id: 'STR-002', rationale: 'Human rationale', next_action: 'Human action', approved_by: '', approved_at: null };
  assert.equal(validateCompletedDecisionCase(decision).valid, true);
  decision.decision_semantics.criteria = decision.decision_semantics.criteria.filter((item) => item.dimension !== 'planet');
  const result = validateCompletedDecisionCase(decision);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('planet')));
});

test('Four-P summaries use every criterion and never compensate across dimensions', () => {
  const decision = seerDecision();
  const productConcern = decision.decision_semantics.criteria.find((item) => item.dimension === 'product');
  productConcern.must_be_true = false;
  productConcern.outcome = 'does-not-meet';
  const summaries = summarizeFourP(decision);
  assert.equal(summaries.find((item) => item.dimension === 'product').state, 'Does not meet');
  assert.ok(summaries.filter((item) => item.dimension !== 'product').every((item) => item.state === 'Meets'));
  assert.equal(decisionPosture(decision).posture, 'HOLD');
  assert.equal(Object.hasOwn(summaries, 'score'), false);
});

test('unreviewed posture holds and deliberate none-required can advance', () => {
  const decision = seerDecision();
  assert.equal(decisionPosture(decision).posture, 'HOLD');
  decision.decision_semantics.proceed_conditions_state = 'none-required';
  assert.equal(decisionPosture(decision).posture, 'ADVANCE');
  decision.decision_semantics.monitoring.push({ monitoring_id: 'MON-001', observable: 'Declared observable', trigger: '', response: '', required: true, criterion_refs: [], strategy_refs: [] });
  assert.equal(decisionPosture(decision).posture, 'ADVANCE WITH CONDITIONS');
});

test('supported required outcomes derive advance, rework, and stop deterministically', () => {
  const decision = seerDecision();
  const criterion = requiredCriterion(decision);
  assert.equal(decisionPosture(decision).posture, 'ADVANCE');
  criterion.outcome = 'does-not-meet';
  assert.equal(decisionPosture(decision).posture, 'STOP');
  decision.decision_semantics.conditions.push({ id: 'CON-001', statement: 'Complete remediation', required: true, state: 'open', criterion_refs: [criterion.criterion_id], strategy_refs: [] });
  assert.equal(decisionPosture(decision).posture, 'REWORK');
  decision.decision_semantics.conditions[0].state = 'satisfied';
  assert.equal(decisionPosture(decision).posture, 'STOP');
});

test('weak or invalid evidence holds and never creates STOP', () => {
  for (const evidence of ['partial', 'unknown', 'contested', 'stale', 'invalid']) {
    const decision = seerDecision();
    const criterion = requiredCriterion(decision);
    criterion.evidence_state = evidence;
    criterion.outcome = ['unknown', 'invalid'].includes(evidence) ? 'not-assessable' : 'does-not-meet';
    assert.equal(decisionPosture(decision).posture, 'HOLD', evidence);
  }
});

test('mixed STOP and HOLD selects STOP by conservative precedence', () => {
  const decision = seerDecision();
  const people = requiredCriterion(decision, 'people');
  people.evidence_state = 'unknown';
  people.outcome = 'not-assessable';
  const planet = decision.decision_semantics.criteria.find((item) => item.dimension === 'planet');
  planet.must_be_true = true;
  planet.evidence_state = 'supported';
  planet.outcome = 'does-not-meet';
  assert.equal(decisionPosture(decision).posture, 'STOP');
});

test('mixed HOLD and REWORK selects HOLD by conservative precedence', () => {
  const decision = seerDecision();
  const people = requiredCriterion(decision, 'people');
  people.evidence_state = 'unknown';
  people.outcome = 'not-assessable';
  const planet = decision.decision_semantics.criteria.find((item) => item.dimension === 'planet');
  planet.must_be_true = true;
  planet.outcome = 'does-not-meet';
  decision.decision_semantics.conditions.push({ id: 'CON-001', statement: 'Planet remediation', required: true, state: 'open', criterion_refs: [planet.criterion_id], strategy_refs: [] });
  assert.equal(decisionPosture(decision).posture, 'HOLD');
});

test('one targeted remediation cannot remediate an unrelated required failure', () => {
  const decision = seerDecision();
  const people = requiredCriterion(decision, 'people');
  people.outcome = 'does-not-meet';
  const planet = decision.decision_semantics.criteria.find((item) => item.dimension === 'planet');
  planet.must_be_true = true;
  planet.outcome = 'does-not-meet';
  decision.decision_semantics.conditions.push({ id: 'CON-001', statement: 'People remediation only', required: true, state: 'open', criterion_refs: [people.criterion_id], strategy_refs: [] });
  assert.equal(decisionPosture(decision).posture, 'STOP');
});

test('evidence weakening is posture-monotonic across every allowed weak state', () => {
  const severity = { ADVANCE: 0, 'ADVANCE WITH CONDITIONS': 1, REWORK: 2, HOLD: 3, STOP: 4 };
  const base = seerDecision();
  requiredCriterion(base);
  const strongSeverity = severity[decisionPosture(base).posture];
  for (const evidence of ['partial', 'unknown', 'contested', 'stale', 'invalid']) {
    const weakened = structuredClone(base);
    const criterion = weakened.decision_semantics.criteria.find((item) => item.must_be_true);
    criterion.evidence_state = evidence;
    if (['unknown', 'invalid'].includes(evidence)) criterion.outcome = 'not-assessable';
    assert.ok(severity[decisionPosture(weakened).posture] >= strongSeverity, evidence);
  }
});

test('unknown and invalid evidence reject contradictory favorable outcomes', () => {
  for (const evidence of ['unknown', 'invalid']) {
    const semantics = createDecisionSemantics('sustainability-seer');
    semantics.criteria[0].evidence_state = evidence;
    semantics.criteria[0].outcome = 'meets';
    const result = validateDecisionSemantics(semantics);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('not assessable')));
  }
});

test('critical and must-be-true remain independent', () => {
  const decision = seerDecision();
  decision.objectives.forEach((item) => { item.critical = false; });
  const before = robustCandidateDecision(decision);
  const criterion = requiredCriterion(decision);
  criterion.evidence_state = 'unknown';
  criterion.outcome = 'not-assessable';
  assert.deepEqual(robustCandidateDecision(decision), before);
  assert.equal(decisionPosture(decision).posture, 'HOLD');
});

test('cautious override cannot become more permissive and requires a reason', () => {
  const decision = seerDecision();
  decision.decision_semantics.proceed_conditions_state = 'none-required';
  assert.equal(setCautiousOverride(decision.decision_semantics, 'HOLD', 'Human caution').valid, true);
  assert.equal(decisionPosture(decision).posture, 'HOLD');
  const held = seerDecision();
  assert.equal(setCautiousOverride(held.decision_semantics, 'ADVANCE', 'Too permissive').valid, false);
  assert.equal(setCautiousOverride(held.decision_semantics, 'STOP', '').valid, false);
});

test('cautious override explanations truthfully use the human reason', () => {
  for (const override of ['HOLD', 'STOP']) {
    const decision = seerDecision();
    decision.decision_semantics.proceed_conditions_state = 'none-required';
    const reason = `Human ${override} caution for irreversible consequences.`;
    assert.equal(setCautiousOverride(decision.decision_semantics, override, reason).valid, true);
    const result = decisionPosture(decision);
    assert.equal(result.derived, 'ADVANCE');
    assert.equal(result.posture, override);
    assert.match(result.why, /human applied/i);
    assert.match(result.why, new RegExp(reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(result.why, /evidence.*unresolved/i);
  }
  const rework = seerDecision();
  const criterion = requiredCriterion(rework);
  criterion.outcome = 'does-not-meet';
  rework.decision_semantics.conditions.push({ id: 'CON-001', statement: 'Remediate', required: true, state: 'open', criterion_refs: [criterion.criterion_id], strategy_refs: [] });
  assert.equal(decisionPosture(rework).derived, 'REWORK');
  assert.equal(setCautiousOverride(rework.decision_semantics, 'STOP', 'Human stop pending governance review.').valid, true);
  const stopped = decisionPosture(rework);
  assert.equal(stopped.posture, 'STOP');
  assert.match(stopped.why, /Human stop pending governance review/);
  assert.doesNotMatch(stopped.why, /no declared remediation/i);
});

test('next evidence is explicit, deterministic, and omitted when unsupported', () => {
  const decision = seerDecision();
  const people = requiredCriterion(decision, 'people');
  people.evidence_state = 'unknown';
  people.outcome = 'not-assessable';
  assert.equal(decisionPosture(decision).next_evidence, null);
  people.evidence_need = 'Obtain the declared exposure measurement.';
  decision.decision_semantics.criteria.find((item) => item.dimension === 'planet').must_be_true = true;
  decision.decision_semantics.criteria.find((item) => item.dimension === 'planet').evidence_state = 'unknown';
  assert.equal(decisionPosture(decision).next_evidence.evidence_need, people.evidence_need);
  assert.deepEqual(decisionPosture(decision), decisionPosture(structuredClone(decision)));
});

test('next evidence prioritizes controlling severity before Four-P order', () => {
  const decision = seerDecision();
  const people = requiredCriterion(decision, 'people');
  people.evidence_state = 'unknown';
  people.outcome = 'not-assessable';
  people.evidence_need = 'People evidence A';
  const planet = decision.decision_semantics.criteria.find((item) => item.dimension === 'planet');
  planet.must_be_true = true;
  planet.outcome = 'does-not-meet';
  planet.evidence_need = 'Planet evidence B';
  assert.equal(decisionPosture(decision).posture, 'STOP');
  assert.equal(decisionPosture(decision).next_evidence.evidence_need, 'Planet evidence B');
});

test('equal-severity next evidence follows Four-P then persisted order', () => {
  const decision = seerDecision();
  const people = requiredCriterion(decision, 'people');
  people.evidence_state = 'unknown';
  people.outcome = 'not-assessable';
  people.evidence_need = 'People first';
  const planet = decision.decision_semantics.criteria.find((item) => item.dimension === 'planet');
  planet.must_be_true = true;
  planet.evidence_state = 'unknown';
  planet.outcome = 'not-assessable';
  planet.evidence_need = 'Planet second';
  assert.equal(decisionPosture(decision).next_evidence.evidence_need, 'People first');
  const secondPeople = structuredClone(people);
  secondPeople.criterion_id = 'CRT-099';
  secondPeople.evidence_need = 'Later People';
  decision.decision_semantics.criteria.push(secondPeople);
  assert.equal(decisionPosture(decision).next_evidence.evidence_need, 'People first');
});

test('compact Step 6 updates preserve unrepresented conditions and monitoring facts', () => {
  const semantics = createDecisionSemantics('sustainability-seer');
  semantics.conditions = [
    { id: 'CON-001', statement: 'Visible condition', required: true, state: 'open', criterion_refs: ['CRT-001'], strategy_refs: ['STR-001'] },
    { id: 'CON-002', statement: 'Imported condition', required: false, state: 'satisfied', criterion_refs: ['CRT-002'], strategy_refs: ['STR-002'], extension: 'preserve' },
  ];
  semantics.monitoring = [
    { monitoring_id: 'MON-001', observable: 'Visible monitor', trigger: 'T1', response: 'R1', required: true, criterion_refs: ['CRT-001'], strategy_refs: [] },
    { monitoring_id: 'MON-002', observable: 'Imported monitor', trigger: 'T2', response: 'R2', required: false, criterion_refs: ['CRT-002'], strategy_refs: ['STR-002'], extension: 'preserve' },
  ];
  const preservedCondition = structuredClone(semantics.conditions[1]);
  const preservedMonitoring = structuredClone(semantics.monitoring[1]);
  updateVisibleCondition(semantics, { statement: 'Edited visible condition', state: 'satisfied', targetCriterionId: 'CRT-001' });
  updateVisibleMonitoring(semantics, { observable: 'Edited visible monitor' });
  assert.equal(semantics.conditions.length, 2);
  assert.equal(semantics.monitoring.length, 2);
  assert.deepEqual(semantics.conditions[1], preservedCondition);
  assert.deepEqual(semantics.monitoring[1], preservedMonitoring);
  assert.deepEqual(semantics.conditions[0].criterion_refs, ['CRT-001']);
  assert.equal(semantics.monitoring[0].trigger, 'T1');
});

test('affected-party participation and dissent do not alter posture or comparison', () => {
  const decision = seerDecision();
  decision.decision_semantics.proceed_conditions_state = 'none-required';
  const expectedPosture = decisionPosture(decision);
  const expectedComparison = robustCandidateDecision(decision);
  decision.decision_semantics.affected_parties.push({ party_id: 'PTY-001', label: 'Affected group', engagement_state: 'participated', notes: 'Participation is not consent.' });
  decision.decision_semantics.dissent.push({ dissent_id: 'DIS-001', statement: 'Unresolved concern', criterion_refs: [], party_refs: ['PTY-001'], attribution_status: 'attributed', unresolved: true });
  assert.deepEqual(decisionPosture(decision), expectedPosture);
  assert.deepEqual(robustCandidateDecision(decision), expectedComparison);
});

test('affected parties, dissent, and safeguards survive portable round trip', async () => {
  const decision = seerDecision();
  decision.decision_semantics.proceed_conditions_state = 'none-required';
  decision.decision_semantics.affected_parties.push({ party_id: 'PTY-001', label: 'Affected group', engagement_state: 'consulted', notes: 'Consultation is not consent.' });
  decision.decision_semantics.dissent.push({ dissent_id: 'DIS-001', statement: 'Recorded dissent', criterion_refs: ['CRT-001'], party_refs: ['PTY-001'], attribution_status: 'attributed', unresolved: true });
  decision.decision_semantics.safeguards.push({ id: 'SAFE-001', statement: 'Required safeguard', required: true, state: 'open', criterion_refs: ['CRT-001'], strategy_refs: [] });
  decision.human_decision = { selected_strategy_id: 'STR-002', rationale: 'Human rationale', next_action: 'Human action', approved_by: '', approved_at: null };
  const raw = JSON.stringify(decision);
  const file = { size: raw.length, async text() { return raw; } };
  const parsed = await parseDecisionFile(file, validateCompletedDecisionCase, validateDraftDecisionCase);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.decision.decision_semantics.affected_parties, decision.decision_semantics.affected_parties);
  assert.deepEqual(parsed.decision.decision_semantics.dissent, decision.decision_semantics.dissent);
  assert.deepEqual(parsed.decision.decision_semantics.safeguards, decision.decision_semantics.safeguards);
});

test('0.3.0 draft and completed portable decisions round-trip separately', async () => {
  const decision = seerDecision();
  assert.equal(validateDraftDecisionCase(decision).valid, true);
  const backupText = JSON.stringify(createDraftBackup(decision));
  const draftFile = { size: backupText.length, async text() { return backupText; } };
  const draft = await parseDecisionFile(draftFile, validateCompletedDecisionCase, validateDraftDecisionCase);
  assert.equal(draft.kind, 'draft-backup');
  assert.deepEqual(draft.decision, decision);
  decision.human_decision = { selected_strategy_id: 'STR-002', rationale: 'Human rationale', next_action: 'Human action', approved_by: '', approved_at: null };
  const portableText = JSON.stringify(decision);
  const portableFile = { size: portableText.length, async text() { return portableText; } };
  const portable = await parseDecisionFile(portableFile, validateCompletedDecisionCase, validateDraftDecisionCase);
  assert.equal(portable.kind, 'completed-decision');
  assert.deepEqual(portable.decision, decision);
});

test('unknown schema versions fail closed', async () => {
  const decision = seerDecision();
  decision.schema_version = '9.9.9';
  const raw = JSON.stringify(decision);
  const file = { size: raw.length, async text() { return raw; } };
  const result = await parseDecisionFile(file, validateCompletedDecisionCase, validateDraftDecisionCase);
  assert.equal(result.ok, false);
});
