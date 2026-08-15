export const SEMANTIC_SCHEMA_VERSION = '0.3.0';
export const SEMANTIC_MODES = Object.freeze(['general', 'sustainability-seer']);
export const DIMENSIONS = Object.freeze(['general', 'people', 'planet', 'profits', 'product']);
export const FOUR_P_DIMENSIONS = Object.freeze(['people', 'planet', 'profits', 'product']);
export const EVIDENCE_STATES = Object.freeze(['supported', 'partial', 'unknown', 'contested', 'stale', 'invalid']);
export const CRITERION_OUTCOMES = Object.freeze(['meets', 'does-not-meet', 'not-assessable']);
export const PROCEED_STATES = Object.freeze(['unreviewed', 'declared', 'none-required']);
export const POSTURES = Object.freeze(['ADVANCE', 'ADVANCE WITH CONDITIONS', 'REWORK', 'HOLD', 'STOP']);
export const POSTURE_SEVERITY = Object.freeze({ ADVANCE: 0, 'ADVANCE WITH CONDITIONS': 1, REWORK: 2, HOLD: 3, STOP: 4 });

const text = (value) => String(value ?? '').trim();
const list = (value) => Array.isArray(value) ? value : [];

export function createDecisionSemantics(mode = 'general') {
  return {
    mode: SEMANTIC_MODES.includes(mode) ? mode : 'general',
    posture_enabled: mode === 'sustainability-seer',
    proceed_conditions_state: 'unreviewed',
    criteria: mode === 'sustainability-seer' ? FOUR_P_DIMENSIONS.map((dimension, index) => ({
      criterion_id: `CRT-${String(index + 1).padStart(3, '0')}`,
      dimension,
      label: '',
      requirement: '',
      must_be_true: false,
      evidence_state: 'unknown',
      outcome: 'not-assessable',
      source_refs: [],
      evidence_need: '',
      affected_party_ids: [],
      missing_perspectives: [],
      assumptions: [],
      limitations: [],
    })) : [],
    affected_parties: [],
    dissent: [],
    conditions: [],
    safeguards: [],
    monitoring: [],
    reassessment: '',
    posture_override: null,
    posture_override_reason: '',
  };
}

export function semanticView(decision) {
  if (decision?.schema_version === SEMANTIC_SCHEMA_VERSION && decision?.decision_semantics) return decision.decision_semantics;
  return createDecisionSemantics('general');
}

export function activateDecisionSemantics(decision, mode = 'general') {
  if (!decision || typeof decision !== 'object') return decision;
  if (decision.schema_version !== SEMANTIC_SCHEMA_VERSION) {
    decision.schema_version = SEMANTIC_SCHEMA_VERSION;
    decision.decision_semantics = createDecisionSemantics(mode);
  } else if (!decision.decision_semantics) {
    decision.decision_semantics = createDecisionSemantics(mode);
  }
  decision.decision_semantics.mode = SEMANTIC_MODES.includes(mode) ? mode : 'general';
  if (mode === 'sustainability-seer') {
    decision.decision_semantics.posture_enabled = true;
    const represented = new Set(list(decision.decision_semantics.criteria).map((item) => item.dimension));
    for (const dimension of FOUR_P_DIMENSIONS) {
      if (!represented.has(dimension)) {
        const next = decision.decision_semantics.criteria.length + 1;
        decision.decision_semantics.criteria.push({
          criterion_id: `CRT-${String(next).padStart(3, '0')}`,
          dimension, label: '', requirement: '', must_be_true: false,
          evidence_state: 'unknown', outcome: 'not-assessable', source_refs: [], evidence_need: '',
          affected_party_ids: [], missing_perspectives: [], assumptions: [], limitations: [],
        });
      }
    }
  }
  return decision;
}

function validateReferenceList(value, label, errors) {
  if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) errors.push(`${label} must be a list of text references.`);
}

export function validateDecisionSemantics(semantics, { completed = false } = {}) {
  const errors = [];
  if (!semantics || typeof semantics !== 'object' || Array.isArray(semantics)) return { valid: false, errors: ['Decision semantics are required for schema 0.3.0.'] };
  if (!SEMANTIC_MODES.includes(semantics.mode)) errors.push('Decision semantics mode is invalid.');
  if (typeof semantics.posture_enabled !== 'boolean') errors.push('Decision posture activation must be explicit.');
  if (!PROCEED_STATES.includes(semantics.proceed_conditions_state)) errors.push('Proceed-condition review state is invalid.');
  for (const field of ['criteria', 'affected_parties', 'dissent', 'conditions', 'safeguards', 'monitoring']) {
    if (!Array.isArray(semantics[field])) errors.push(`Decision semantics ${field.replaceAll('_', ' ')} must be a list.`);
  }
  const criteria = list(semantics.criteria);
  const criterionIds = criteria.map((item) => item?.criterion_id);
  if (criterionIds.some((id) => !text(id)) || new Set(criterionIds).size !== criterionIds.length) errors.push('Semantic criterion IDs must be present and unique.');
  for (const criterion of criteria) {
    if (!DIMENSIONS.includes(criterion?.dimension)) errors.push(`${criterion?.criterion_id || 'Criterion'} has an invalid dimension.`);
    if (typeof criterion?.must_be_true !== 'boolean') errors.push(`${criterion?.criterion_id || 'Criterion'} must explicitly state whether it is required to move forward.`);
    if (!EVIDENCE_STATES.includes(criterion?.evidence_state)) errors.push(`${criterion?.criterion_id || 'Criterion'} has an invalid evidence state.`);
    if (!CRITERION_OUTCOMES.includes(criterion?.outcome)) errors.push(`${criterion?.criterion_id || 'Criterion'} has an invalid outcome.`);
    if (['unknown', 'invalid'].includes(criterion?.evidence_state) && criterion?.outcome !== 'not-assessable') errors.push(`${criterion?.criterion_id || 'Criterion'} with unknown or invalid evidence must be not assessable.`);
    for (const field of ['source_refs', 'affected_party_ids', 'missing_perspectives', 'assumptions', 'limitations']) validateReferenceList(criterion?.[field], `${criterion?.criterion_id || 'Criterion'} ${field}`, errors);
    if (completed && (!text(criterion?.label) || !text(criterion?.requirement))) errors.push(`${criterion?.criterion_id || 'Criterion'} requires a label and requirement before completion.`);
  }
  if (semantics.proceed_conditions_state === 'declared' && !criteria.some((item) => item.must_be_true)) errors.push('Declared proceed conditions require at least one criterion marked required to move forward.');
  if (semantics.proceed_conditions_state === 'none-required' && criteria.some((item) => item.must_be_true)) errors.push('None-required cannot be combined with a required-to-move-forward criterion.');
  if (semantics.mode === 'sustainability-seer' && completed) {
    for (const dimension of FOUR_P_DIMENSIONS) if (!criteria.some((item) => item.dimension === dimension)) errors.push(`Completed SEER-informed decisions require a ${dimension} criterion.`);
  }
  for (const [collection, prefix] of [['conditions', 'condition'], ['safeguards', 'safeguard']]) {
    for (const item of list(semantics[collection])) {
      if (!text(item?.id) || !text(item?.statement) || typeof item?.required !== 'boolean' || !['open', 'satisfied'].includes(item?.state)) errors.push(`Every ${prefix} requires an ID, statement, required flag, and open/satisfied state.`);
      validateReferenceList(item?.criterion_refs, `${prefix} criterion_refs`, errors);
      validateReferenceList(item?.strategy_refs, `${prefix} strategy_refs`, errors);
    }
  }
  for (const item of list(semantics.monitoring)) {
    if (!text(item?.monitoring_id) || !text(item?.observable) || typeof item?.required !== 'boolean') errors.push('Every monitoring obligation requires an ID, observable, and required flag.');
    validateReferenceList(item?.criterion_refs, 'Monitoring criterion_refs', errors);
    validateReferenceList(item?.strategy_refs, 'Monitoring strategy_refs', errors);
  }
  for (const party of list(semantics.affected_parties)) {
    if (!text(party?.party_id) || !text(party?.label) || !['not-engaged', 'invited', 'consulted', 'participated'].includes(party?.engagement_state)) errors.push('Every affected party requires an ID, label, and valid engagement state.');
  }
  if (semantics.posture_override !== null && !POSTURES.includes(semantics.posture_override)) errors.push('Human posture override is invalid.');
  if (semantics.posture_override !== null && !text(semantics.posture_override_reason)) errors.push('A cautious posture override requires a reason.');
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

function criterionConcern(criterion) {
  if (criterion.evidence_state === 'supported' && criterion.outcome === 'does-not-meet') return 'Does not meet';
  if (criterion.outcome === 'not-assessable' || criterion.evidence_state !== 'supported') return 'Needs evidence';
  return criterion.outcome === 'meets' ? 'Meets' : 'Needs evidence';
}

export function summarizeFourP(decision) {
  const semantics = semanticView(decision);
  return FOUR_P_DIMENSIONS.map((dimension) => {
    const criteria = list(semantics.criteria).filter((item) => item.dimension === dimension);
    const states = criteria.map(criterionConcern);
    const state = !criteria.length ? 'Not assessed'
      : states.includes('Does not meet') ? 'Does not meet'
        : states.includes('Needs evidence') ? 'Needs evidence' : 'Meets';
    return { dimension, state, criteria };
  });
}

const linkedOpenRemediation = (semantics, criterionId) => [...list(semantics.conditions), ...list(semantics.safeguards)]
  .some((item) => item.required && item.state === 'open' && list(item.criterion_refs).includes(criterionId));

function criterionPosture(semantics, criterion) {
  if (criterion.evidence_state !== 'supported' || criterion.outcome === 'not-assessable') return 'HOLD';
  if (criterion.outcome === 'does-not-meet') return linkedOpenRemediation(semantics, criterion.criterion_id) ? 'REWORK' : 'STOP';
  return 'ADVANCE';
}

function derivedPosture(semantics) {
  if (!semantics.posture_enabled) return null;
  if (semantics.proceed_conditions_state === 'unreviewed') return 'HOLD';
  const required = list(semantics.criteria).filter((item) => item.must_be_true);
  if (semantics.proceed_conditions_state === 'declared' && !required.length) return 'HOLD';
  const criterionResults = required.map((item) => criterionPosture(semantics, item));
  const requiredOpen = [...list(semantics.conditions), ...list(semantics.safeguards)].some((item) => item.required && item.state === 'open');
  const requiredMonitoring = list(semantics.monitoring).some((item) => item.required);
  const applicable = [...criterionResults, requiredOpen || requiredMonitoring ? 'ADVANCE WITH CONDITIONS' : 'ADVANCE'];
  return applicable.sort((a, b) => POSTURE_SEVERITY[b] - POSTURE_SEVERITY[a])[0];
}

export function decisionPosture(decision) {
  const semantics = semanticView(decision);
  const base = derivedPosture(semantics);
  if (!base) return { posture: null, derived: null, why: '', changes: [], next_evidence: null };
  let posture = base;
  const overrideApplied = Boolean(semantics.posture_override && POSTURE_SEVERITY[semantics.posture_override] > POSTURE_SEVERITY[base] && text(semantics.posture_override_reason));
  if (overrideApplied) posture = semantics.posture_override;
  const required = list(semantics.criteria).filter((item) => item.must_be_true);
  const unresolved = required.filter((item) => item.evidence_state !== 'supported' || item.outcome !== 'meets');
  const changes = [];
  for (const item of unresolved) changes.push(item.evidence_need ? `${item.label || item.criterion_id}: ${item.evidence_need}` : `${item.label || item.criterion_id}: resolve the declared requirement.`);
  for (const item of [...list(semantics.conditions), ...list(semantics.safeguards)].filter((entry) => entry.required && entry.state === 'open')) changes.push(item.statement);
  for (const item of list(semantics.monitoring).filter((entry) => entry.required && text(entry.trigger))) changes.push(`${item.trigger}${text(item.response) ? ` — ${item.response}` : ''}`);
  const dimensionOrder = new Map([...FOUR_P_DIMENSIONS, 'general'].map((item, index) => [item, index]));
  const persistedOrder = new Map(list(semantics.criteria).map((item, index) => [item, index]));
  const next = unresolved.filter((item) => text(item.evidence_need)).sort((a, b) => (
    POSTURE_SEVERITY[criterionPosture(semantics, b)] - POSTURE_SEVERITY[criterionPosture(semantics, a)]
    || dimensionOrder.get(a.dimension) - dimensionOrder.get(b.dimension)
    || persistedOrder.get(a) - persistedOrder.get(b)
    || String(a.criterion_id).localeCompare(String(b.criterion_id))
  ))[0];
  const derivedWhy = posture === 'HOLD' ? (semantics.proceed_conditions_state === 'unreviewed' ? 'Proceed conditions have not been reviewed.' : 'Required evidence or assessment remains unresolved.')
    : posture === 'STOP' ? 'A required criterion does not meet and has no declared remediation path.'
      : posture === 'REWORK' ? 'A required criterion needs its declared remediation.'
        : posture === 'ADVANCE WITH CONDITIONS' ? 'Required conditions, safeguards, or monitoring remain open.'
          : 'Declared proceed conditions are satisfied.';
  const why = overrideApplied ? `A human applied a more cautious ${posture} posture: ${text(semantics.posture_override_reason)}` : derivedWhy;
  return { posture, derived: base, why, changes, next_evidence: next ? { criterion_id: next.criterion_id, evidence_need: next.evidence_need } : null };
}

export function setCautiousOverride(semantics, posture, reason) {
  const base = derivedPosture(semantics);
  if (posture === null || posture === '') { semantics.posture_override = null; semantics.posture_override_reason = ''; return { valid: true, errors: [] }; }
  if (!POSTURES.includes(posture) || !base || POSTURE_SEVERITY[posture] < POSTURE_SEVERITY[base]) return { valid: false, errors: ['A human posture override may only make the result more cautious.'] };
  if (!text(reason)) return { valid: false, errors: ['A cautious posture override requires a reason.'] };
  semantics.posture_override = posture;
  semantics.posture_override_reason = reason;
  return { valid: true, errors: [] };
}

export function updateVisibleCondition(semantics, { statement, state = 'open', targetCriterionId = '' }) {
  const value = text(statement);
  if (!value) return semantics;
  const existing = list(semantics.conditions)[0];
  const updated = {
    ...(existing || { id: 'CON-001', required: true, strategy_refs: [] }),
    statement: value,
    state: state === 'satisfied' ? 'satisfied' : 'open',
    criterion_refs: targetCriterionId ? [targetCriterionId] : [],
  };
  if (existing) semantics.conditions[0] = updated;
  else semantics.conditions.push(updated);
  return semantics;
}

export function updateVisibleMonitoring(semantics, { observable }) {
  const value = text(observable);
  if (!value) return semantics;
  const existing = list(semantics.monitoring)[0];
  const updated = {
    ...(existing || { monitoring_id: 'MON-001', trigger: '', response: '', required: true, criterion_refs: [], strategy_refs: [] }),
    observable: value,
  };
  if (existing) semantics.monitoring[0] = updated;
  else semantics.monitoring.push(updated);
  return semantics;
}
