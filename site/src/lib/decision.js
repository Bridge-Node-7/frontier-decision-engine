import {
  OUTCOME_STATE,
  buildPerformanceMatrix,
  createBlankDecisionCase,
  requirementIssues,
  validateDraftDecisionCase as validateLegacyDraftDecisionCase,
} from './decision-core.js';

export * from './decision-core.js';

export const DRAFT_TOPOLOGY_BOUNDS = Object.freeze({
  uncertainties: Object.freeze({ min: 3, max: 3 }),
  objectives: Object.freeze({ min: 2, max: 4 }),
  relationships: Object.freeze({ min: 3, max: 3 }),
  strategies: Object.freeze({ min: 2, max: 3 }),
  scenarios: Object.freeze({ min: 2, max: 4 }),
});

const GUIDED_MODEL_TYPE = 'bounded guided comparison draft';

function boundedCount(value, field) {
  const bounds = DRAFT_TOPOLOGY_BOUNDS[field];
  const count = Number(value);
  if (!Number.isInteger(count) || count < bounds.min || count > bounds.max) {
    throw new RangeError(`${field} count must be between ${bounds.min} and ${bounds.max}.`);
  }
  return count;
}

export function createGuidedDecisionCase({ objectiveCount = 2, strategyCount = 2, scenarioCount = 2 } = {}) {
  const decision = createBlankDecisionCase();
  const objectiveLimit = boundedCount(objectiveCount, 'objectives');
  const strategyLimit = boundedCount(strategyCount, 'strategies');
  const scenarioLimit = boundedCount(scenarioCount, 'scenarios');

  decision.objectives = decision.objectives.slice(0, objectiveLimit);
  const objectiveIds = new Set(decision.objectives.map((item) => item.objective_id));

  decision.strategies = decision.strategies.slice(0, strategyLimit).map((strategy) => ({
    ...strategy,
    baseline: Object.fromEntries(
      Object.entries(strategy.baseline).filter(([objectiveId]) => objectiveIds.has(objectiveId)),
    ),
  }));
  const strategyIds = new Set(decision.strategies.map((item) => item.strategy_id));

  decision.scenarios = decision.scenarios.slice(0, scenarioLimit).map((scenario) => ({
    ...scenario,
    strategy_modifiers: Object.fromEntries(
      Object.entries(scenario.strategy_modifiers)
        .filter(([strategyId]) => strategyIds.has(strategyId))
        .map(([strategyId, modifiers]) => [
          strategyId,
          Object.fromEntries(
            Object.entries(modifiers).filter(([objectiveId]) => objectiveIds.has(objectiveId)),
          ),
        ]),
    ),
  }));

  decision.provenance.model_type = GUIDED_MODEL_TYPE;
  return decision;
}

function exactLegacyShape(decision) {
  return decision?.uncertainties?.length === 3
    && decision?.objectives?.length === 4
    && decision?.relationships?.length === 3
    && decision?.strategies?.length === 3
    && decision?.scenarios?.length === 4;
}

function guidedShapeErrors(decision) {
  const errors = [];
  if (decision?.provenance?.model_type !== GUIDED_MODEL_TYPE) {
    errors.push('Smaller draft topology is reserved for a guided FDE comparison.');
    return errors;
  }
  for (const field of ['uncertainties', 'objectives', 'relationships', 'strategies', 'scenarios']) {
    const bounds = DRAFT_TOPOLOGY_BOUNDS[field];
    const length = Array.isArray(decision?.[field]) ? decision[field].length : -1;
    if (length < bounds.min || length > bounds.max) {
      const expected = bounds.min === bounds.max ? `${bounds.min}` : `${bounds.min} to ${bounds.max}`;
      errors.push(`Draft ${field} must contain ${expected} items.`);
    }
  }

  const template = createBlankDecisionCase();
  const prefixMatches = (field, idField) => {
    const expected = template[field].slice(0, decision?.[field]?.length || 0).map((item) => item[idField]);
    const actual = (decision?.[field] || []).map((item) => item?.[idField]);
    return expected.length === actual.length && expected.every((value, index) => value === actual[index]);
  };
  if (!prefixMatches('objectives', 'objective_id')) errors.push('Guided objective IDs must preserve the system-generated order.');
  if (!prefixMatches('strategies', 'strategy_id')) errors.push('Guided strategy IDs must preserve the system-generated order.');
  if (!prefixMatches('scenarios', 'scenario_id')) errors.push('Guided scenario IDs must preserve the system-generated order.');
  return errors;
}

function paddedForLegacyValidation(decision) {
  const padded = JSON.parse(JSON.stringify(decision));
  const template = createBlankDecisionCase();

  const appendMissing = (field, count) => {
    while (padded[field].length < count) {
      padded[field].push(JSON.parse(JSON.stringify(template[field][padded[field].length])));
    }
  };
  appendMissing('objectives', 4);
  appendMissing('strategies', 3);
  appendMissing('scenarios', 4);

  const objectiveIds = padded.objectives.map((item) => item.objective_id);
  const strategyIds = padded.strategies.map((item) => item.strategy_id);

  for (const strategy of padded.strategies) {
    if (!strategy.baseline || typeof strategy.baseline !== 'object') strategy.baseline = {};
    const templateStrategy = template.strategies.find((item) => item.strategy_id === strategy.strategy_id);
    for (const objectiveId of objectiveIds) {
      if (!(objectiveId in strategy.baseline)) {
        strategy.baseline[objectiveId] = templateStrategy?.baseline?.[objectiveId] ?? null;
      }
    }
  }

  for (const scenario of padded.scenarios) {
    if (!scenario.strategy_modifiers || typeof scenario.strategy_modifiers !== 'object') scenario.strategy_modifiers = {};
    const templateScenario = template.scenarios.find((item) => item.scenario_id === scenario.scenario_id);
    for (const strategyId of strategyIds) {
      if (!scenario.strategy_modifiers[strategyId] || typeof scenario.strategy_modifiers[strategyId] !== 'object') {
        scenario.strategy_modifiers[strategyId] = {};
      }
      for (const objectiveId of objectiveIds) {
        if (!(objectiveId in scenario.strategy_modifiers[strategyId])) {
          scenario.strategy_modifiers[strategyId][objectiveId] =
            templateScenario?.strategy_modifiers?.[strategyId]?.[objectiveId] ?? null;
        }
      }
    }
  }
  return padded;
}

export function validateDraftDecisionCase(decisionCase) {
  if (exactLegacyShape(decisionCase)) return validateLegacyDraftDecisionCase(decisionCase);
  const shapeErrors = guidedShapeErrors(decisionCase);
  if (shapeErrors.length) return { valid: false, errors: shapeErrors };
  return validateLegacyDraftDecisionCase(paddedForLegacyValidation(decisionCase));
}

export function validateAnalysisReady(decisionCase) {
  const draft = validateDraftDecisionCase(decisionCase);
  const matrix = buildPerformanceMatrix(decisionCase);
  const expected = (decisionCase?.strategies?.length || 0)
    * (decisionCase?.scenarios?.length || 0)
    * (decisionCase?.objectives?.length || 0);
  const contract = requirementIssues(decisionCase, 'compare');
  const errors = [...contract.map((issue) => issue.message)];
  if (!draft.valid) errors.push('The bounded decision model structure needs attention. Open Inspect for technical details.');
  if (matrix.length !== expected) errors.push(`Expected ${expected} performance rows; received ${matrix.length}.`);
  for (const row of matrix) {
    if (![OUTCOME_STATE.VALID_PASS, OUTCOME_STATE.VALID_FAIL].includes(row.state)) {
      errors.push(`Invalid outcome for ${row.strategy_id}/${row.scenario_id}/${row.objective_id}.`);
    }
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
