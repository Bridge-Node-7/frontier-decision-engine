const clamp = (value, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, Number(value)));

export function createDecisionCase() {
  const createdAt = new Date().toISOString();
  return {
    schema_version: '0.2.10',
    decision_id: `FDE-${createdAt.replace(/[-:TZ.]/g, '').slice(0, 14)}`,
    title: 'Synchronized observation-station decision',
    profile: 'phenomena',
    question: 'Should a synchronized second observation station be deployed, and under what trigger conditions?',
    decision_owner: 'Research lead',
    time_horizon: '90 days',
    urgency: 'planned',
    reversibility: 'partially-reversible',
    status: 'draft',
    stakeholders: [
      { stakeholder_id: 'STK-001', name: 'Research team', role: 'decision-maker', objectives: ['OBJ-001', 'OBJ-002'] },
      { stakeholder_id: 'STK-002', name: 'Public and nearby community', role: 'affected-party', objectives: ['OBJ-003'] },
      { stakeholder_id: 'STK-003', name: 'Independent reviewers', role: 'reviewer', objectives: ['OBJ-001', 'OBJ-004'] },
    ],
    evidence_summary: {
      known: [
        'Source workbooks and normalized public-safe datasets are preserved with SHA-256 provenance.',
        'The morphology collection contains reproducible angular and image-plane motion measurements.',
        'True range, physical size, altitude, and full three-dimensional velocity remain unresolved.',
      ],
      assumed: [
        'Future recurrence may be sufficient to justify additional collection.',
        'A synchronized second station would materially improve range and corroboration potential.',
      ],
      unknown: [
        'Whether the observed morphology can be reproduced fully by near-field controls.',
        'Whether the phenomenon will recur during a planned collection period.',
      ],
    },
    uncertainties: [
      {
        uncertainty_id: 'UNC-001',
        label: 'Recurrence rate',
        description: 'How often a decision-relevant observation will recur during the collection window.',
        states: ['low', 'moderate', 'high'],
        source_status: 'unknown',
        reducibility: 'partially-reducible',
      },
      {
        uncertainty_id: 'UNC-002',
        label: 'Conventional-control outcome',
        description: 'Whether controlled insect, aircraft, optical, and sensor-artifact tests reproduce the signatures.',
        states: ['explained', 'partially-unresolved', 'unresolved'],
        source_status: 'not-yet-tested',
        reducibility: 'reducible',
      },
      {
        uncertainty_id: 'UNC-003',
        label: 'Available deployment budget',
        description: 'Resources available for calibration, hardware, operations, and independent review.',
        states: ['constrained', 'adequate'],
        source_status: 'decision-dependent',
        reducibility: 'partially-reducible',
      },
    ],
    objectives: [
      { objective_id: 'OBJ-001', label: 'Evidence gain', description: 'Expected ability to increase decision-relevant evidence quality.', threshold: 60, unit: 'desirability score', direction: 'at-least', critical: true },
      { objective_id: 'OBJ-002', label: 'Affordability', description: 'Ability to remain within realistic financial and operating limits.', threshold: 60, unit: 'desirability score', direction: 'at-least', critical: true },
      { objective_id: 'OBJ-003', label: 'Privacy protection', description: 'Ability to reduce unnecessary collection or exposure of sensitive information.', threshold: 70, unit: 'desirability score', direction: 'at-least', critical: true },
      { objective_id: 'OBJ-004', label: 'Reversibility', description: 'Ability to stop, revise, or redirect the strategy without disproportionate loss.', threshold: 60, unit: 'desirability score', direction: 'at-least', critical: false },
    ],
    relationships: [
      { relationship_id: 'REL-001', statement: 'Additional synchronized viewpoints can improve corroboration and enable geometric reconstruction when timing and calibration are sufficient.', evidence_class: 'modeled', confidence: 'medium' },
      { relationship_id: 'REL-002', statement: 'Controlled known-target testing can reduce false-positive risk before larger deployment.', evidence_class: 'methodological', confidence: 'high' },
      { relationship_id: 'REL-003', statement: 'A staged strategy preserves the option to scale after defined evidence and recurrence triggers are met.', evidence_class: 'decision-model', confidence: 'medium' },
    ],
    strategies: [
      {
        strategy_id: 'STR-001',
        label: 'Reanalyze existing evidence only',
        description: 'Complete calibration review, metadata recovery, and controlled comparison without new field infrastructure.',
        baseline: { 'OBJ-001': 40, 'OBJ-002': 95, 'OBJ-003': 95, 'OBJ-004': 95 },
        action_now: 'Complete source, calibration, and known-target review.',
        monitor: 'Residual unexplained signatures and recurrence reports.',
        trigger: 'Escalate if controls remain unresolved and recurrence is moderate or high.',
        contingency: 'Close or archive the case if controls explain the observation adequately.',
      },
      {
        strategy_id: 'STR-002',
        label: 'Deploy two stations immediately',
        description: 'Purchase, calibrate, and operate a synchronized two-station collection system now.',
        baseline: { 'OBJ-001': 90, 'OBJ-002': 35, 'OBJ-003': 80, 'OBJ-004': 45 },
        action_now: 'Acquire and deploy two synchronized stations.',
        monitor: 'Capture quality, recurrence, operating cost, and community impact.',
        trigger: 'Continue while evidence gain remains material and operating limits are met.',
        contingency: 'Suspend deployment if cost or privacy thresholds are exceeded.',
      },
      {
        strategy_id: 'STR-003',
        label: 'Stage a conditional second-station deployment',
        description: 'Finish controls and calibration, prepare the second station, and deploy only after explicit recurrence and quality triggers are met.',
        baseline: { 'OBJ-001': 80, 'OBJ-002': 70, 'OBJ-003': 90, 'OBJ-004': 85 },
        action_now: 'Complete controls, calibrate the first station, and prepare a second synchronized unit.',
        monitor: 'Recurrence frequency, control similarity, source quality, and budget readiness.',
        trigger: 'Deploy when calibrated observations recur and remain unresolved after controls.',
        contingency: 'Remain in low-cost monitoring mode if the trigger is not met.',
      },
    ],
    scenarios: [
      {
        scenario_id: 'SCN-001',
        label: 'Low recurrence and controls explain most signatures',
        description: 'Observations are rare and known-target tests reproduce the principal morphology or motion patterns.',
        states: { 'UNC-001': 'low', 'UNC-002': 'explained', 'UNC-003': 'adequate' },
        strategy_modifiers: {
          'STR-001': { 'OBJ-001': -10, 'OBJ-002': 0, 'OBJ-003': 0, 'OBJ-004': 0 },
          'STR-002': { 'OBJ-001': -50, 'OBJ-002': -10, 'OBJ-003': -10, 'OBJ-004': -10 },
          'STR-003': { 'OBJ-001': -35, 'OBJ-002': 5, 'OBJ-003': 0, 'OBJ-004': 0 },
        },
      },
      {
        scenario_id: 'SCN-002',
        label: 'Moderate recurrence with residual uncertainty',
        description: 'Some conventional controls fit, but a repeatable residual remains unresolved.',
        states: { 'UNC-001': 'moderate', 'UNC-002': 'partially-unresolved', 'UNC-003': 'adequate' },
        strategy_modifiers: {
          'STR-001': { 'OBJ-001': 5, 'OBJ-002': 0, 'OBJ-003': 0, 'OBJ-004': 0 },
          'STR-002': { 'OBJ-001': 0, 'OBJ-002': 0, 'OBJ-003': 0, 'OBJ-004': 0 },
          'STR-003': { 'OBJ-001': 0, 'OBJ-002': 0, 'OBJ-003': 0, 'OBJ-004': 0 },
        },
      },
      {
        scenario_id: 'SCN-003',
        label: 'High recurrence and controls remain unresolved',
        description: 'Calibrated observations recur and conventional controls do not reproduce the relevant signatures.',
        states: { 'UNC-001': 'high', 'UNC-002': 'unresolved', 'UNC-003': 'adequate' },
        strategy_modifiers: {
          'STR-001': { 'OBJ-001': 10, 'OBJ-002': -5, 'OBJ-003': 0, 'OBJ-004': 0 },
          'STR-002': { 'OBJ-001': 5, 'OBJ-002': -5, 'OBJ-003': -5, 'OBJ-004': -5 },
          'STR-003': { 'OBJ-001': 10, 'OBJ-002': -5, 'OBJ-003': 0, 'OBJ-004': 0 },
        },
      },
      {
        scenario_id: 'SCN-004',
        label: 'Useful recurrence but constrained funding',
        description: 'Collection remains potentially valuable, but available deployment resources are limited.',
        states: { 'UNC-001': 'moderate', 'UNC-002': 'partially-unresolved', 'UNC-003': 'constrained' },
        strategy_modifiers: {
          'STR-001': { 'OBJ-001': 0, 'OBJ-002': 0, 'OBJ-003': 0, 'OBJ-004': 0 },
          'STR-002': { 'OBJ-001': 0, 'OBJ-002': -25, 'OBJ-003': -5, 'OBJ-004': -10 },
          'STR-003': { 'OBJ-001': -5, 'OBJ-002': -25, 'OBJ-003': 0, 'OBJ-004': -5 },
        },
      },
    ],
    human_decision: {
      selected_strategy_id: 'STR-003',
      rationale: 'The staged strategy preserves immediate learning while avoiding unconditional infrastructure cost before recurrence and control-test triggers are met.',
      next_action: 'Complete known-target controls and publish the second-station deployment trigger checklist.',
      approved_by: '',
      approved_at: null,
    },
    adaptive_pathway: {
      act_now: ['Preserve and validate source evidence.', 'Complete camera calibration and known-target controls.', 'Prepare the second station without activating full deployment.'],
      monitor: ['Recurrence rate', 'Control-object similarity', 'Calibration quality', 'Budget availability'],
      triggers: ['At least two calibrated residual observations within the defined review window.', 'Known-target tests fail to reproduce the decision-relevant signature.', 'Second-station timing and calibration readiness pass validation.'],
      contingencies: ['Remain in single-station monitoring if recurrence is low.', 'Close or reclassify the case if controls explain the observation.', 'Seek independent review after synchronized corroboration.'],
      reassessment: 'Review after 90 days or immediately after a trigger event.',
    },
    provenance: {
      model_type: 'transparent scenario matrix',
      probability_model_used: false,
      values_are_analyst_assigned: true,
      generated_at: createdAt,
    },
  };
}

export function performanceValue(strategy, scenario, objectiveId) {
  const baseline = Number(strategy?.baseline?.[objectiveId]);
  const modifier = Number(scenario?.strategy_modifiers?.[strategy?.strategy_id]?.[objectiveId] ?? 0);
  if (!Number.isFinite(baseline) || !Number.isFinite(modifier)) return null;
  return clamp(baseline + modifier);
}

export function objectivePasses(value, objective) {
  if (!Number.isFinite(Number(value))) return false;
  if (objective.direction === 'at-most') return Number(value) <= Number(objective.threshold);
  return Number(value) >= Number(objective.threshold);
}

export function buildPerformanceMatrix(decisionCase) {
  const rows = [];
  for (const strategy of decisionCase.strategies || []) {
    for (const scenario of decisionCase.scenarios || []) {
      for (const objective of decisionCase.objectives || []) {
        const value = performanceValue(strategy, scenario, objective.objective_id);
        rows.push({
          strategy_id: strategy.strategy_id,
          scenario_id: scenario.scenario_id,
          objective_id: objective.objective_id,
          value,
          threshold: objective.threshold,
          direction: objective.direction,
          passed: objectivePasses(value, objective),
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
      const passed = scenarioRows.filter((row) => row.passed).length;
      const criticalRows = scenarioRows.filter((row) => row.critical);
      const criticalFailures = criticalRows.filter((row) => !row.passed);
      return {
        scenario_id: scenario.scenario_id,
        passed,
        total: scenarioRows.length,
        pass_rate: scenarioRows.length ? passed / scenarioRows.length : 0,
        critical_pass_rate: criticalRows.length ? (criticalRows.length - criticalFailures.length) / criticalRows.length : 1,
        critical_failures: criticalFailures.map((row) => row.objective_id),
      };
    });
    const passed = rows.filter((row) => row.passed).length;
    const worstCasePassRate = scenarios.length ? Math.min(...scenarios.map((item) => item.pass_rate)) : 0;
    const worstCaseCriticalPassRate = scenarios.length ? Math.min(...scenarios.map((item) => item.critical_pass_rate)) : 0;
    const criticalFailureCount = rows.filter((row) => row.critical && !row.passed).length;
    const criticalFailureScenarioCount = scenarios.filter((item) => item.critical_failures.length > 0).length;
    return {
      strategy_id: strategy.strategy_id,
      label: strategy.label,
      passed,
      total: rows.length,
      overall_pass_rate: rows.length ? passed / rows.length : 0,
      worst_case_pass_rate: worstCasePassRate,
      worst_case_critical_pass_rate: worstCaseCriticalPassRate,
      critical_failure_count: criticalFailureCount,
      critical_failure_scenario_count: criticalFailureScenarioCount,
      scenarios,
    };
  });
}

export function robustCandidate(decisionCase) {
  const summaries = summarizeStrategies(decisionCase);
  if (!summaries.length) return null;
  const minimumCriticalScenarios = Math.min(...summaries.map((item) => item.critical_failure_scenario_count));
  const eligible = summaries.filter((item) => item.critical_failure_scenario_count === minimumCriticalScenarios);
  return [...eligible].sort((a, b) => {
    if (b.worst_case_critical_pass_rate !== a.worst_case_critical_pass_rate) return b.worst_case_critical_pass_rate - a.worst_case_critical_pass_rate;
    if (b.worst_case_pass_rate !== a.worst_case_pass_rate) return b.worst_case_pass_rate - a.worst_case_pass_rate;
    if (b.overall_pass_rate !== a.overall_pass_rate) return b.overall_pass_rate - a.overall_pass_rate;
    return a.critical_failure_count - b.critical_failure_count;
  })[0] || null;
}

export function vulnerabilityMap(decisionCase, strategyId) {
  const matrix = buildPerformanceMatrix(decisionCase);
  const objectives = new Map((decisionCase.objectives || []).map((item) => [item.objective_id, item]));
  return (decisionCase.scenarios || []).map((scenario) => {
    const failures = matrix
      .filter((row) => row.strategy_id === strategyId && row.scenario_id === scenario.scenario_id && !row.passed)
      .map((row) => ({ ...row, objective: objectives.get(row.objective_id) }));
    return {
      scenario_id: scenario.scenario_id,
      label: scenario.label,
      description: scenario.description,
      failures,
      vulnerable: failures.length > 0,
    };
  });
}

export function validateDecisionCase(decisionCase) {
  const errors = [];
  const nonEmpty = (value) => Boolean(String(value ?? '').trim());
  const inRange = (value, minimum, maximum) => Number.isFinite(Number(value)) && Number(value) >= minimum && Number(value) <= maximum;
  const uniqueIds = (items, field, label) => {
    const ids = (items || []).map((item) => item?.[field]).filter(Boolean);
    if (ids.length !== new Set(ids).size) errors.push(`${label} IDs must be unique.`);
  };

  if (decisionCase?.schema_version !== '0.2.10') errors.push('Unsupported decision schema version.');
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
  if (!strategyIds.has(selected)) errors.push('The selected human decision does not match an available strategy.');
  if (!nonEmpty(decisionCase?.human_decision?.rationale)) errors.push('A human decision rationale is required.');
  if (!nonEmpty(decisionCase?.human_decision?.next_action)) errors.push('A single next action is required.');

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

