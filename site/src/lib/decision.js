import { SEMANTIC_SCHEMA_VERSION, validateDecisionSemantics } from './semantics.js';

const clamp = (value, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, Number(value)));

export function createDecisionCase() {
  const createdAt = new Date().toISOString();
  return {
    schema_version: '0.2.10',
    decision_id: `FDE-${createdAt.replace(/[-:TZ.]/g, '').slice(0, 14)}`,
    title: 'Critical-material source qualification decision',
    profile: 'critical-minerals-readiness',
    question: 'Which source-qualification pathway creates the strongest readiness across changing conditions?',
    decision_owner: 'Program decision owner',
    time_horizon: '36 months',
    urgency: 'planned',
    reversibility: 'partially-reversible',
    status: 'draft',
    stakeholders: [
      { stakeholder_id: 'STK-001', name: 'Program leadership', role: 'decision-maker', objectives: ['OBJ-001', 'OBJ-002', 'OBJ-003'] },
      { stakeholder_id: 'STK-002', name: 'Engineering and qualification', role: 'reviewer', objectives: ['OBJ-001', 'OBJ-004'] },
      { stakeholder_id: 'STK-003', name: 'Supply-chain partners', role: 'implementation-partner', objectives: ['OBJ-002', 'OBJ-003'] },
    ],
    evidence_summary: {
      known: [
        'This example uses synthetic values and does not represent an actual supplier, material, capacity, or investment.',
        'Readiness, continuity, affordability, and flexibility remain visible as separate goals.',
        'Every pathway is evaluated across the same four named future conditions.',
      ],
      assumed: [
        'A qualified second source may improve continuity and program flexibility.',
        'A bounded reserve may support readiness while qualification proceeds.',
      ],
      unknown: [
        'Actual supplier capacity, quality, schedule, provenance, and compliance evidence.',
        'Actual qualification cost, production yield, and program demand.',
      ],
    },
    uncertainties: [
      { uncertainty_id: 'UNC-001', label: 'Demand conditions', description: 'How program demand may change.', states: ['stable', 'higher'], source_status: 'synthetic-example', reducibility: 'partially-reducible' },
      { uncertainty_id: 'UNC-002', label: 'Qualification timing', description: 'How long qualification may require.', states: ['planned', 'extended'], source_status: 'synthetic-example', reducibility: 'partially-reducible' },
      { uncertainty_id: 'UNC-003', label: 'Primary-source continuity', description: 'Whether the current source remains available.', states: ['stable', 'disrupted'], source_status: 'synthetic-example', reducibility: 'partially-reducible' },
    ],
    objectives: [
      { objective_id: 'OBJ-001', label: 'Readiness', description: 'Ability to support program needs.', threshold: 70, unit: 'synthetic desirability score', direction: 'at-least', critical: true },
      { objective_id: 'OBJ-002', label: 'Supply continuity', description: 'Ability to maintain material availability.', threshold: 70, unit: 'synthetic desirability score', direction: 'at-least', critical: true },
      { objective_id: 'OBJ-003', label: 'Affordability', description: 'Ability to remain within the example cost boundary.', threshold: 60, unit: 'synthetic desirability score', direction: 'at-least', critical: true },
      { objective_id: 'OBJ-004', label: 'Flexibility', description: 'Ability to revise the pathway as evidence changes.', threshold: 60, unit: 'synthetic desirability score', direction: 'at-least', critical: false },
    ],
    relationships: [
      { relationship_id: 'REL-001', statement: 'Second-source qualification may increase continuity after requirements are met.', evidence_class: 'synthetic-decision-model', confidence: 'demonstration-only' },
      { relationship_id: 'REL-002', statement: 'A bounded reserve may support readiness while qualification proceeds.', evidence_class: 'synthetic-decision-model', confidence: 'demonstration-only' },
      { relationship_id: 'REL-003', statement: 'Affordability and readiness may require an explicit trade-off.', evidence_class: 'synthetic-decision-model', confidence: 'demonstration-only' },
    ],
    strategies: [
      { strategy_id: 'STR-001', label: 'Maintain current source', description: 'Continue without a reserve or second-source qualification.', baseline: { 'OBJ-001': 55, 'OBJ-002': 45, 'OBJ-003': 90, 'OBJ-004': 75 }, action_now: 'Continue current sourcing and evidence collection.', monitor: 'Availability, quality, demand, and lead time.', trigger: 'Reconsider when continuity or readiness falls below the selected goal.', contingency: 'Begin second-source qualification if the trigger is met.' },
      { strategy_id: 'STR-002', label: 'Qualify a second source', description: 'Fund a bounded second-source qualification pathway.', baseline: { 'OBJ-001': 75, 'OBJ-002': 80, 'OBJ-003': 65, 'OBJ-004': 80 }, action_now: 'Begin evidence review and qualification planning.', monitor: 'Technical fit, quality, schedule, capacity, and cost.', trigger: 'Advance after the required qualification evidence is complete.', contingency: 'Adjust scope or timing when a goal is not yet met.' },
      { strategy_id: 'STR-003', label: 'Build a reserve and qualify', description: 'Hold a temporary reserve while qualifying a second source.', baseline: { 'OBJ-001': 85, 'OBJ-002': 90, 'OBJ-003': 50, 'OBJ-004': 75 }, action_now: 'Define a bounded reserve and begin qualification.', monitor: 'Inventory, demand, qualification progress, and cost.', trigger: 'Reduce the reserve after qualified capacity becomes available.', contingency: 'Resize the reserve when demand or qualification timing changes.' },
    ],
    scenarios: [
      { scenario_id: 'SCN-001', label: 'Stable demand and source performance', description: 'Demand remains stable and the current source continues to perform.', states: { 'UNC-001': 'stable', 'UNC-002': 'planned', 'UNC-003': 'stable' }, strategy_modifiers: { 'STR-001': { 'OBJ-001': 10, 'OBJ-002': 10, 'OBJ-003': 0, 'OBJ-004': 0 }, 'STR-002': { 'OBJ-001': 0, 'OBJ-002': 0, 'OBJ-003': 0, 'OBJ-004': 0 }, 'STR-003': { 'OBJ-001': -5, 'OBJ-002': 0, 'OBJ-003': -10, 'OBJ-004': 0 } } },
      { scenario_id: 'SCN-002', label: 'Qualification takes longer', description: 'Second-source qualification requires more time than planned.', states: { 'UNC-001': 'stable', 'UNC-002': 'extended', 'UNC-003': 'stable' }, strategy_modifiers: { 'STR-001': { 'OBJ-001': 0, 'OBJ-002': -10, 'OBJ-003': 0, 'OBJ-004': 0 }, 'STR-002': { 'OBJ-001': -20, 'OBJ-002': -15, 'OBJ-003': -5, 'OBJ-004': -5 }, 'STR-003': { 'OBJ-001': -10, 'OBJ-002': 0, 'OBJ-003': -10, 'OBJ-004': 0 } } },
      { scenario_id: 'SCN-003', label: 'Primary-source disruption', description: 'The current source becomes temporarily unavailable.', states: { 'UNC-001': 'higher', 'UNC-002': 'planned', 'UNC-003': 'disrupted' }, strategy_modifiers: { 'STR-001': { 'OBJ-001': -35, 'OBJ-002': -45, 'OBJ-003': -5, 'OBJ-004': -15 }, 'STR-002': { 'OBJ-001': 5, 'OBJ-002': 10, 'OBJ-003': -5, 'OBJ-004': 0 }, 'STR-003': { 'OBJ-001': 10, 'OBJ-002': 15, 'OBJ-003': -15, 'OBJ-004': 0 } } },
      { scenario_id: 'SCN-004', label: 'Budget remains constrained', description: 'The program must advance within a tighter cost boundary.', states: { 'UNC-001': 'higher', 'UNC-002': 'extended', 'UNC-003': 'stable' }, strategy_modifiers: { 'STR-001': { 'OBJ-001': 0, 'OBJ-002': 0, 'OBJ-003': 5, 'OBJ-004': 0 }, 'STR-002': { 'OBJ-001': -5, 'OBJ-002': 0, 'OBJ-003': -20, 'OBJ-004': -5 }, 'STR-003': { 'OBJ-001': -5, 'OBJ-002': 5, 'OBJ-003': -30, 'OBJ-004': -10 } } },
    ],
    human_decision: { selected_strategy_id: '', rationale: '', next_action: '', approved_by: '', approved_at: null },
    adaptive_pathway: { act_now: ['Confirm the decision owner and evidence plan.', 'Define qualification milestones and review dates.'], monitor: ['Supplier evidence', 'Qualification progress', 'Capacity', 'Cost', 'Program demand'], triggers: ['Required qualification evidence is complete.', 'Continuity or readiness falls below the selected goal.'], contingencies: ['Adjust the qualification sequence.', 'Use a bounded reserve when near-term readiness requires support.'], reassessment: 'Review at each qualification milestone or when a declared trigger occurs.' },
    provenance: { model_type: 'transparent four-future comparison', probability_model_used: false, values_are_analyst_assigned: true, generated_at: createdAt },
  };
}

export function createBlankDecisionCase() {
  const decision = createDecisionCase();
  decision.title = '';
  decision.profile = 'general';
  decision.question = '';
  decision.decision_owner = '';
  decision.time_horizon = '';
  decision.urgency = '';
  decision.reversibility = '';
  decision.stakeholders = [];
  decision.evidence_summary = { known: [], assumed: [], unknown: [] };
  decision.relationships.forEach((relationship) => {
    relationship.statement = '';
    relationship.evidence_class = 'unset';
    relationship.confidence = 'unset';
  });
  decision.uncertainties.forEach((uncertainty) => {
    uncertainty.label = '';
    uncertainty.description = '';
    uncertainty.states = ['state-a', 'state-b'];
    uncertainty.source_status = 'unset';
    uncertainty.reducibility = 'unset';
  });
  decision.objectives.forEach((objective) => {
    objective.label = '';
    objective.description = '';
    objective.threshold = null;
    objective.unit = '';
    objective.critical = false;
  });
  decision.strategies.forEach((strategy) => {
    strategy.label = '';
    strategy.description = '';
    strategy.action_now = '';
    strategy.monitor = '';
    strategy.trigger = '';
    strategy.contingency = '';
    for (const objectiveId of Object.keys(strategy.baseline)) strategy.baseline[objectiveId] = null;
  });
  decision.scenarios.forEach((scenario) => {
    scenario.label = '';
    scenario.description = '';
    for (const uncertaintyId of Object.keys(scenario.states)) scenario.states[uncertaintyId] = 'state-a';
    for (const modifiers of Object.values(scenario.strategy_modifiers)) {
      for (const objectiveId of Object.keys(modifiers)) modifiers[objectiveId] = null;
    }
  });
  decision.adaptive_pathway = { act_now: [], monitor: [], triggers: [], contingencies: [], reassessment: '' };
  decision.provenance.model_type = 'bounded comparison draft';
  decision.provenance.values_are_analyst_assigned = false;
  return decision;
}
export const OUTCOME_STATE = Object.freeze({
  VALID_PASS: 'VALID_PASS',
  VALID_FAIL: 'VALID_FAIL',
  MODEL_ERROR: 'MODEL_ERROR',
  MISSING_OUTPUT: 'MISSING_OUTPUT',
  INVALID_OUTPUT: 'INVALID_OUTPUT',
  CANCELLED: 'CANCELLED',
});
export const CANDIDATE_STATE = Object.freeze({
  UNIQUE_LEADER: 'UNIQUE_LEADER',
  TIED_LEADERS: 'TIED_LEADERS',
  NO_ACCEPTABLE_STRATEGY: 'NO_ACCEPTABLE_STRATEGY',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
});

export function performanceValue(strategy, scenario, objectiveId) {
  const baseline = Number(strategy?.baseline?.[objectiveId]);
  const modifier = Number(scenario?.strategy_modifiers?.[strategy?.strategy_id]?.[objectiveId] ?? 0);
  if (!Number.isFinite(baseline) || !Number.isFinite(modifier)) return null;
  return clamp(baseline + modifier);
}

export function objectivePasses(value, objective) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (typeof objective?.threshold !== 'number' || !Number.isFinite(objective.threshold)) return false;
  if (objective.direction === 'at-most') return value <= objective.threshold;
  if (objective.direction === 'at-least') return value >= objective.threshold;
  return false;
}
export function buildPerformanceMatrix(decisionCase) {
  const rows = [];
  for (const strategy of decisionCase.strategies || []) {
    for (const scenario of decisionCase.scenarios || []) {
      for (const objective of decisionCase.objectives || []) {
        const value = performanceValue(strategy, scenario, objective.objective_id);
        const passed = objectivePasses(value, objective);
        const validValue = typeof value === 'number' && Number.isFinite(value);
        const validThreshold = typeof objective?.threshold === 'number' && Number.isFinite(objective.threshold);
        const validDirection = ['at-least', 'at-most'].includes(objective?.direction);
        const state = !validValue || !validThreshold || !validDirection
          ? OUTCOME_STATE.INVALID_OUTPUT
          : passed ? OUTCOME_STATE.VALID_PASS : OUTCOME_STATE.VALID_FAIL;
        rows.push({
          strategy_id: strategy.strategy_id,
          scenario_id: scenario.scenario_id,
          objective_id: objective.objective_id,
          value,
          threshold: objective.threshold,
          direction: objective.direction,
          state,
          passed: state === OUTCOME_STATE.VALID_PASS,
          critical: Boolean(objective.critical),
        });
      }
    }
  }
  return rows;
}
export function summarizeStrategies(decisionCase) {
  const matrix = buildPerformanceMatrix(decisionCase);
  return (decisionCase.strategies || []).map((strategy) => {
    const rows = matrix.filter((row) => row.strategy_id === strategy.strategy_id);
    const scenarios = (decisionCase.scenarios || []).map((scenario) => {
      const scenarioRows = rows.filter((row) => row.scenario_id === scenario.scenario_id);
      const validRows = scenarioRows.filter((row) => [OUTCOME_STATE.VALID_PASS, OUTCOME_STATE.VALID_FAIL].includes(row.state));
      const invalidRows = scenarioRows.filter((row) => ![OUTCOME_STATE.VALID_PASS, OUTCOME_STATE.VALID_FAIL].includes(row.state));
      const passed = validRows.filter((row) => row.state === OUTCOME_STATE.VALID_PASS).length;
      const criticalRows = validRows.filter((row) => row.critical);
      const criticalFailures = criticalRows.filter((row) => row.state === OUTCOME_STATE.VALID_FAIL);
      const criticalInvalids = invalidRows.filter((row) => row.critical);
      return {
        scenario_id: scenario.scenario_id,
        passed,
        total: scenarioRows.length,
        valid_total: validRows.length,
        invalid_outcome_count: invalidRows.length,
        analysis_valid: invalidRows.length === 0 && scenarioRows.length > 0,
        pass_rate: invalidRows.length === 0 && validRows.length ? passed / validRows.length : null,
        critical_pass_rate: criticalInvalids.length === 0 && criticalRows.length
          ? (criticalRows.length - criticalFailures.length) / criticalRows.length
          : criticalRows.length ? null : 1,
        critical_failures: criticalFailures.map((row) => row.objective_id),
        invalid_outcomes: invalidRows.map((row) => row.objective_id),
      };
    });
    const invalidRows = rows.filter((row) => ![OUTCOME_STATE.VALID_PASS, OUTCOME_STATE.VALID_FAIL].includes(row.state));
    const validRows = rows.filter((row) => [OUTCOME_STATE.VALID_PASS, OUTCOME_STATE.VALID_FAIL].includes(row.state));
    const analysisValid = rows.length > 0 && invalidRows.length === 0 && scenarios.every((item) => item.analysis_valid);
    const passed = validRows.filter((row) => row.state === OUTCOME_STATE.VALID_PASS).length;
    const worstCasePassRate = analysisValid ? Math.min(...scenarios.map((item) => item.pass_rate)) : null;
    const worstCaseCriticalPassRate = analysisValid ? Math.min(...scenarios.map((item) => item.critical_pass_rate)) : null;
    const criticalFailureCount = validRows.filter((row) => row.critical && row.state === OUTCOME_STATE.VALID_FAIL).length;
    const criticalFailureScenarioCount = scenarios.filter((item) => item.critical_failures.length > 0).length;
    return {
      strategy_id: strategy.strategy_id,
      label: strategy.label,
      passed,
      total: rows.length,
      valid_total: validRows.length,
      invalid_outcome_count: invalidRows.length,
      analysis_valid: analysisValid,
      overall_pass_rate: analysisValid ? passed / validRows.length : null,
      worst_case_pass_rate: worstCasePassRate,
      worst_case_critical_pass_rate: worstCaseCriticalPassRate,
      critical_failure_count: criticalFailureCount,
      critical_failure_scenario_count: criticalFailureScenarioCount,
      scenarios,
    };
  });
}
export function robustCandidate(decisionCase) {
  const result = robustCandidateDecision(decisionCase);
  return result.status === CANDIDATE_STATE.UNIQUE_LEADER ? result.candidates[0] : null;
}

export function robustCandidateDecision(decisionCase) {
  const summaries = summarizeStrategies(decisionCase);
  if (!summaries.length || summaries.some((item) => !item.analysis_valid)) {
    return { status: CANDIDATE_STATE.INSUFFICIENT_DATA, candidates: [], summaries };
  }
  const minimumCriticalScenarios = Math.min(...summaries.map((item) => item.critical_failure_scenario_count));
  const eligible = summaries.filter((item) => item.critical_failure_scenario_count === minimumCriticalScenarios);
  const compare = (a, b) => {
    if (b.worst_case_critical_pass_rate !== a.worst_case_critical_pass_rate) return b.worst_case_critical_pass_rate - a.worst_case_critical_pass_rate;
    if (b.worst_case_pass_rate !== a.worst_case_pass_rate) return b.worst_case_pass_rate - a.worst_case_pass_rate;
    if (b.overall_pass_rate !== a.overall_pass_rate) return b.overall_pass_rate - a.overall_pass_rate;
    return a.critical_failure_count - b.critical_failure_count;
  };
  const ranked = [...eligible].sort(compare);
  const top = ranked[0];
  if (!top) return { status: CANDIDATE_STATE.NO_ACCEPTABLE_STRATEGY, candidates: [], summaries };
  const candidates = ranked.filter((item) => compare(top, item) === 0);
  return {
    status: candidates.length === 1 ? CANDIDATE_STATE.UNIQUE_LEADER : CANDIDATE_STATE.TIED_LEADERS,
    candidates,
    summaries,
  };
}
export function vulnerabilityMap(decisionCase, strategyId) {
  const matrix = buildPerformanceMatrix(decisionCase);
  const objectives = new Map((decisionCase.objectives || []).map((item) => [item.objective_id, item]));
  return (decisionCase.scenarios || []).map((scenario) => {
    const scenarioRows = matrix.filter((row) => row.strategy_id === strategyId && row.scenario_id === scenario.scenario_id);
    const failures = scenarioRows
      .filter((row) => row.state === OUTCOME_STATE.VALID_FAIL)
      .map((row) => ({ ...row, objective: objectives.get(row.objective_id) }));
    const invalids = scenarioRows
      .filter((row) => ![OUTCOME_STATE.VALID_PASS, OUTCOME_STATE.VALID_FAIL].includes(row.state))
      .map((row) => ({ ...row, objective: objectives.get(row.objective_id) }));
    return {
      scenario_id: scenario.scenario_id,
      label: scenario.label,
      description: scenario.description,
      failures,
      invalids,
      vulnerable: failures.length > 0,
      analysis_valid: invalids.length === 0,
    };
  });
}

export function validateAnalysisReady(decisionCase) {
  const structural = validateDecisionCase(decisionCase);
  const matrix = buildPerformanceMatrix(decisionCase);
  const expected = (decisionCase?.strategies?.length || 0)
    * (decisionCase?.scenarios?.length || 0)
    * (decisionCase?.objectives?.length || 0);
  const errors = [...structural.errors];
  if (matrix.length !== expected) errors.push(`Expected ${expected} performance rows; received ${matrix.length}.`);
  for (const row of matrix) {
    if (![OUTCOME_STATE.VALID_PASS, OUTCOME_STATE.VALID_FAIL].includes(row.state)) {
      errors.push(`Invalid outcome for ${row.strategy_id}/${row.scenario_id}/${row.objective_id}.`);
    }
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
export function validateDecisionCase(decisionCase) {
  const errors = [];
  const nonEmpty = (value) => Boolean(String(value ?? '').trim());
  const inRange = (value, minimum, maximum) => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
  const uniqueIds = (items, field, label) => {
    const ids = (items || []).map((item) => item?.[field]).filter(Boolean);
    if (ids.length !== new Set(ids).size) errors.push(`${label} IDs must be unique.`);
  };

  if (!['0.2.10', SEMANTIC_SCHEMA_VERSION].includes(decisionCase?.schema_version)) errors.push('Unsupported decision schema version.');
  if (decisionCase?.schema_version === SEMANTIC_SCHEMA_VERSION) errors.push(...validateDecisionSemantics(decisionCase.decision_semantics).errors);
  if (!/^FDE-[A-Z0-9-]+$/.test(decisionCase?.decision_id || '')) errors.push('Invalid decision ID.');
  for (const [label, value] of [
    ['Decision title', decisionCase?.title],
    ['Decision profile', decisionCase?.profile],
    ['Decision question', decisionCase?.question],
    ['Decision owner', decisionCase?.decision_owner],
  ]) if (!nonEmpty(value)) errors.push(`${label} is required.`);
  if ((decisionCase?.objectives || []).length < 2) errors.push('At least two objectives are required.');
  if ((decisionCase?.strategies || []).length < 2) errors.push('At least two strategies are required.');
  if ((decisionCase?.scenarios || []).length < 2) errors.push('At least two scenarios are required.');
  if ((decisionCase?.uncertainties || []).length < 1) errors.push('At least one uncertainty is required.');

  uniqueIds(decisionCase?.stakeholders, 'stakeholder_id', 'Stakeholder');
  uniqueIds(decisionCase?.objectives, 'objective_id', 'Objective');
  uniqueIds(decisionCase?.uncertainties, 'uncertainty_id', 'Uncertainty');
  uniqueIds(decisionCase?.strategies, 'strategy_id', 'Strategy');
  uniqueIds(decisionCase?.scenarios, 'scenario_id', 'Scenario');
  uniqueIds(decisionCase?.relationships, 'relationship_id', 'Relationship');

  const objectiveIds = new Set((decisionCase?.objectives || []).map((item) => item.objective_id));
  const strategyIds = new Set((decisionCase?.strategies || []).map((item) => item.strategy_id));
  const uncertaintyMap = new Map((decisionCase?.uncertainties || []).map((item) => [item.uncertainty_id, item]));

  for (const objective of decisionCase?.objectives || []) {
    if (!nonEmpty(objective.objective_id) || !nonEmpty(objective.label)) errors.push('Every objective requires an ID and label.');
    if (!inRange(objective.threshold, 0, 100)) errors.push(`${objective.label || objective.objective_id} threshold must be between 0 and 100.`);
    if (!['at-least', 'at-most'].includes(objective.direction)) errors.push(`${objective.label || objective.objective_id} has an invalid direction.`);
    if (typeof objective.critical !== 'boolean') errors.push(`${objective.label || objective.objective_id} must declare whether it is critical.`);
  }

  for (const stakeholder of decisionCase?.stakeholders || []) {
    for (const objectiveId of stakeholder.objectives || []) {
      if (!objectiveIds.has(objectiveId)) errors.push(`${stakeholder.name || stakeholder.stakeholder_id} references an unavailable objective.`);
    }
  }

  for (const strategy of decisionCase?.strategies || []) {
    if (!nonEmpty(strategy.strategy_id) || !nonEmpty(strategy.label) || !nonEmpty(strategy.description)) errors.push('Every strategy requires an ID, label, and description.');
    for (const objectiveId of objectiveIds) {
      if (!inRange(strategy?.baseline?.[objectiveId], 0, 100)) errors.push(`${strategy.label || strategy.strategy_id} baseline for ${objectiveId} must be between 0 and 100.`);
    }
    for (const field of ['action_now', 'monitor', 'trigger', 'contingency']) {
      if (!nonEmpty(strategy?.[field])) errors.push(`${strategy.label || strategy.strategy_id} requires ${field.replaceAll('_', ' ')}.`);
    }
    if (decisionCase.schema_version === SEMANTIC_SCHEMA_VERSION) for (const [objectiveId, trace] of Object.entries(strategy.score_rationales || {})) {
      if (!objectiveIds.has(objectiveId)) errors.push(`${strategy.label || strategy.strategy_id} has score rationale for an unavailable objective.`);
      if (!['analyst-judgment', 'declared-rubric', 'other'].includes(trace?.basis) || !nonEmpty(trace?.rationale)) errors.push(`${strategy.label || strategy.strategy_id} score rationale for ${objectiveId} requires a valid basis and rationale.`);
    }
  }

  for (const scenario of decisionCase?.scenarios || []) {
    if (!nonEmpty(scenario.scenario_id) || !nonEmpty(scenario.label) || !nonEmpty(scenario.description)) errors.push('Every scenario requires an ID, label, and description.');
    for (const [uncertaintyId, uncertainty] of uncertaintyMap.entries()) {
      const state = scenario?.states?.[uncertaintyId];
      if (!uncertainty.states?.includes(state)) errors.push(`${scenario.label || scenario.scenario_id} has an invalid or missing state for ${uncertaintyId}.`);
    }
    for (const strategyId of strategyIds) {
      for (const objectiveId of objectiveIds) {
        const value = scenario?.strategy_modifiers?.[strategyId]?.[objectiveId];
        if (!inRange(value, -100, 100)) errors.push(`${scenario.label || scenario.scenario_id} requires a -100 to 100 modifier for ${strategyId}/${objectiveId}.`);
      }
    }
  }

  const selected = decisionCase?.human_decision?.selected_strategy_id;
  const rationale = decisionCase?.human_decision?.rationale;
  const nextAction = decisionCase?.human_decision?.next_action;
  const humanDecisionStarted = nonEmpty(selected) || nonEmpty(rationale) || nonEmpty(nextAction);
  if (humanDecisionStarted && !strategyIds.has(selected)) errors.push('The selected human decision does not match an available strategy.');
  if (humanDecisionStarted && !nonEmpty(rationale)) errors.push('A human decision rationale is required.');
  if (humanDecisionStarted && !nonEmpty(nextAction)) errors.push('A single next action is required.');

  const pathway = decisionCase?.adaptive_pathway;
  for (const field of ['act_now', 'monitor', 'triggers', 'contingencies']) {
    if (!Array.isArray(pathway?.[field]) || pathway[field].length < 1 || pathway[field].some((item) => !nonEmpty(item))) {
      errors.push(`Adaptive pathway ${field.replaceAll('_', ' ')} must contain at least one non-empty item.`);
    }
  }
  if (!nonEmpty(pathway?.reassessment)) errors.push('An adaptive-pathway reassessment condition is required.');

  const provenance = decisionCase?.provenance;
  if (!nonEmpty(provenance?.model_type)) errors.push('Decision provenance must identify the model type.');
  if (typeof provenance?.probability_model_used !== 'boolean') errors.push('Decision provenance must disclose whether a probability model was used.');
  if (typeof provenance?.values_are_analyst_assigned !== 'boolean') errors.push('Decision provenance must disclose whether values are analyst assigned.');
  if (!nonEmpty(provenance?.generated_at) || Number.isNaN(Date.parse(provenance.generated_at))) errors.push('Decision provenance requires a valid generated timestamp.');

  return { valid: errors.length === 0, errors };
}

export function validateCompletedDecisionCase(decisionCase) {
  const nonEmpty = (value) => Boolean(String(value ?? '').trim());
  const result = validateDecisionCase(decisionCase);
  const errors = [...result.errors];
  const strategyIds = new Set((decisionCase?.strategies || []).map((item) => item.strategy_id));
  if (!strategyIds.has(decisionCase?.human_decision?.selected_strategy_id)) errors.push('Choose the human decision before downloading a final record.');
  if (!nonEmpty(decisionCase?.human_decision?.rationale)) errors.push('A human decision rationale is required.');
  if (!nonEmpty(decisionCase?.human_decision?.next_action)) errors.push('A single next action is required.');
  if (decisionCase?.schema_version === SEMANTIC_SCHEMA_VERSION) errors.push(...validateDecisionSemantics(decisionCase.decision_semantics, { completed: true }).errors);
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateDraftDecisionCase(decisionCase) {
  const errors = [];
  const arrays = ['uncertainties', 'objectives', 'relationships', 'strategies', 'scenarios'];
  const boundedLengths = { uncertainties: 3, objectives: 4, relationships: 3, strategies: 3, scenarios: 4 };
  const nullableRange = (value, minimum, maximum) => value === null || (
    typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
  );
  const ids = (items, field) => (items || []).map((item) => item?.[field]);

  if (!decisionCase || typeof decisionCase !== 'object' || Array.isArray(decisionCase)) {
    return { valid: false, errors: ['Draft backup must contain one decision object.'] };
  }
  if (!['0.2.10', SEMANTIC_SCHEMA_VERSION].includes(decisionCase.schema_version)) errors.push('Unsupported draft decision schema identity.');
  if (decisionCase.schema_version === SEMANTIC_SCHEMA_VERSION) errors.push(...validateDecisionSemantics(decisionCase.decision_semantics).errors);
  if (!/^FDE-[A-Z0-9-]+$/.test(decisionCase.decision_id || '')) errors.push('Invalid draft decision ID.');
  for (const field of arrays) {
    if (!Array.isArray(decisionCase[field]) || decisionCase[field].length !== boundedLengths[field]) {
      errors.push(`Draft ${field} must preserve the bounded ${boundedLengths[field]}-item shape.`);
    }
  }

  const objectiveIds = ids(decisionCase.objectives, 'objective_id');
  const strategyIds = ids(decisionCase.strategies, 'strategy_id');
  const uncertaintyIds = ids(decisionCase.uncertainties, 'uncertainty_id');
  for (const [label, values] of [['objective', objectiveIds], ['strategy', strategyIds], ['uncertainty', uncertaintyIds]]) {
    if (values.some((value) => !value) || new Set(values).size !== values.length) errors.push(`Draft ${label} IDs must be present and unique.`);
  }

  for (const objective of decisionCase.objectives || []) {
    if (!nullableRange(objective?.threshold, 0, 100)) errors.push(`Draft threshold for ${objective?.objective_id || 'objective'} is invalid.`);
    if (!['at-least', 'at-most'].includes(objective?.direction)) errors.push(`Draft direction for ${objective?.objective_id || 'objective'} is invalid.`);
  }
  for (const uncertainty of decisionCase.uncertainties || []) {
    if (!Array.isArray(uncertainty?.states) || uncertainty.states.length < 1 || uncertainty.states.some((value) => typeof value !== 'string')) {
      errors.push(`Draft states for ${uncertainty?.uncertainty_id || 'uncertainty'} are invalid.`);
    }
  }
  for (const strategy of decisionCase.strategies || []) {
    if (!strategy?.baseline || typeof strategy.baseline !== 'object') errors.push(`Draft baseline for ${strategy?.strategy_id || 'strategy'} is missing.`);
    for (const objectiveId of objectiveIds) {
      if (!nullableRange(strategy?.baseline?.[objectiveId], 0, 100)) errors.push(`Draft baseline for ${strategy?.strategy_id}/${objectiveId} is invalid.`);
    }
  }
  for (const scenario of decisionCase.scenarios || []) {
    for (const uncertaintyId of uncertaintyIds) {
      const uncertainty = (decisionCase.uncertainties || []).find((item) => item.uncertainty_id === uncertaintyId);
      if (!uncertainty?.states?.includes(scenario?.states?.[uncertaintyId])) errors.push(`Draft state for ${scenario?.scenario_id}/${uncertaintyId} is invalid.`);
    }
    for (const strategyId of strategyIds) {
      for (const objectiveId of objectiveIds) {
        if (!nullableRange(scenario?.strategy_modifiers?.[strategyId]?.[objectiveId], -100, 100)) {
          errors.push(`Draft modifier for ${scenario?.scenario_id}/${strategyId}/${objectiveId} is invalid.`);
        }
      }
    }
  }
  if (!decisionCase.human_decision || typeof decisionCase.human_decision !== 'object') {
    errors.push('Draft human-decision state is missing.');
  } else if (['selected_strategy_id', 'rationale', 'next_action'].some((field) => typeof decisionCase.human_decision[field] !== 'string')) {
    errors.push('Draft human-decision fields are invalid.');
  }
  if (!decisionCase.evidence_summary || typeof decisionCase.evidence_summary !== 'object') {
    errors.push('Draft evidence summary is missing.');
  } else if (['known', 'assumed', 'unknown'].some((field) => !Array.isArray(decisionCase.evidence_summary[field]))) {
    errors.push('Draft evidence-summary lists are invalid.');
  }
  if (!decisionCase.adaptive_pathway || typeof decisionCase.adaptive_pathway !== 'object') {
    errors.push('Draft adaptive pathway is missing.');
  } else if (['act_now', 'monitor', 'triggers', 'contingencies'].some((field) => !Array.isArray(decisionCase.adaptive_pathway[field]))) {
    errors.push('Draft adaptive-pathway lists are invalid.');
  }
  if (!decisionCase.provenance || typeof decisionCase.provenance !== 'object') errors.push('Draft provenance is missing.');
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
