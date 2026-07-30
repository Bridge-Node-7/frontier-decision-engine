import {
  buildPerformanceMatrix,
  createDecisionCase,
  robustCandidate,
  summarizeStrategies,
  validateDecisionCase,
  vulnerabilityMap,
} from './lib/decision.js';
import { downloadText, safeFilename } from './lib/case.js';

const steps = ['Decision frame', 'Decision map', 'Strategies', 'Plausible futures', 'Stress test', 'Decision brief'];

const state = {
  step: 0,
  decision: createDecisionCase(),
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatPercent = (value) => `${Math.round(Number(value || 0) * 100)}%`;

function badge(label, className = '') {
  return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
}

function field(label, id, value, type = 'text', help = '') {
  return `<label class="field">${escapeHtml(label)}<input id="${id}" type="${type}" value="${escapeHtml(value)}">${help ? `<span class="help">${escapeHtml(help)}</span>` : ''}</label>`;
}

function textarea(label, id, value, help = '') {
  return `<label class="field">${escapeHtml(label)}<textarea id="${id}">${escapeHtml(value)}</textarea>${help ? `<span class="help">${escapeHtml(help)}</span>` : ''}</label>`;
}

function decisionNav() {
  return `<nav class="wizard-nav panel" aria-label="Decision workflow">${steps.map((label, index) => `
    <button class="wizard-step" type="button" data-decision-step="${index}" aria-controls="decision-step-content" ${index === state.step ? 'aria-current="step"' : ''}>
      <span class="number">${index + 1}</span><span class="step-label">${escapeHtml(label)}</span>
    </button>`).join('')}</nav>`;
}

function frameStep() {
  const item = state.decision;
  return `<div class="stack">
    <div><span class="eyebrow">Step 1 · Purpose before analysis</span><h2 id="decision-step-heading" tabindex="-1">Frame the real decision</h2><p class="muted">The tool begins with the action that must be chosen, not with a model or an upload.</p></div>
    ${field('Decision title', 'decision-title', item.title)}
    ${textarea('What decision must be made?', 'decision-question', item.question)}
    <div class="grid-2">
      ${field('Decision owner', 'decision-owner', item.decision_owner)}
      ${field('Time horizon', 'decision-horizon', item.time_horizon)}
      <label class="field">Urgency<select id="decision-urgency"><option value="immediate" ${item.urgency === 'immediate' ? 'selected' : ''}>Immediate</option><option value="near-term" ${item.urgency === 'near-term' ? 'selected' : ''}>Near term</option><option value="planned" ${item.urgency === 'planned' ? 'selected' : ''}>Planned</option></select></label>
      <label class="field">Reversibility<select id="decision-reversibility"><option value="reversible" ${item.reversibility === 'reversible' ? 'selected' : ''}>Reversible</option><option value="partially-reversible" ${item.reversibility === 'partially-reversible' ? 'selected' : ''}>Partially reversible</option><option value="irreversible" ${item.reversibility === 'irreversible' ? 'selected' : ''}>Irreversible</option></select></label>
    </div>
    <div class="callout"><strong>Decision discipline</strong><p class="muted">A technically interesting analysis is not decision support until the owner, horizon, affected parties, and consequences are explicit.</p></div>
  </div>`;
}

function mapStep() {
  const item = state.decision;
  return `<div class="stack">
    <div><span class="eyebrow">Step 2 · XLRM decision map</span><h2 id="decision-step-heading" tabindex="-1">Make uncertainty and values visible</h2><p class="muted">The interface keeps uncertainties, levers, relationships, and performance measures separate.</p></div>
    <div class="decision-map">
      <section class="panel stack"><div class="actions"><strong>X · Uncertainties</strong>${badge(`${item.uncertainties.length}`)}</div>${item.uncertainties.map((uncertainty) => `<div class="map-item"><strong>${escapeHtml(uncertainty.label)}</strong><p class="help">${escapeHtml(uncertainty.description)}</p><div class="actions">${uncertainty.states.map((entry) => badge(entry)).join('')}</div></div>`).join('')}</section>
      <section class="panel stack"><div class="actions"><strong>L · Levers</strong>${badge(`${item.strategies.length}`)}</div>${item.strategies.map((strategy) => `<div class="map-item"><strong>${escapeHtml(strategy.label)}</strong><p class="help">${escapeHtml(strategy.description)}</p></div>`).join('')}</section>
      <section class="panel stack"><div class="actions"><strong>R · Relationships</strong>${badge(`${item.relationships.length}`)}</div>${item.relationships.map((relationship) => `<div class="map-item"><strong>${escapeHtml(relationship.evidence_class)}</strong><p class="help">${escapeHtml(relationship.statement)}</p></div>`).join('')}</section>
      <section class="panel stack"><div class="actions"><strong>M · Measures</strong>${badge(`${item.objectives.length}`)}</div>${item.objectives.map((objective, index) => `<label class="field map-item">${escapeHtml(objective.label)} threshold<input data-objective-threshold="${index}" type="number" min="0" max="100" step="1" value="${objective.threshold}"><span class="help">${escapeHtml(objective.description)} Higher scores are more desirable.</span></label>`).join('')}</section>
    </div>
    <div class="callout warning"><strong>No hidden utility function</strong><p class="muted">Objectives remain separate. The app checks declared thresholds and reveals trade-offs rather than inventing one universal value score.</p></div>
  </div>`;
}

function strategiesStep() {
  const objectives = state.decision.objectives;
  return `<div class="stack">
    <div><span class="eyebrow">Step 3 · Competing actions</span><h2 id="decision-step-heading" tabindex="-1">Compare meaningful strategies</h2><p class="muted">The sample includes a low-cost option, an immediate deployment, and an adaptive staged strategy.</p></div>
    ${state.decision.strategies.map((strategy, strategyIndex) => `<article class="panel stack">
      <div class="grid-2">${field('Strategy', `strategy-label-${strategyIndex}`, strategy.label)}${textarea('Description', `strategy-description-${strategyIndex}`, strategy.description)}</div>
      <div class="score-grid">${objectives.map((objective) => `<label class="score-field">${escapeHtml(objective.label)}<input data-strategy-score="${strategyIndex}:${objective.objective_id}" type="number" min="0" max="100" value="${strategy.baseline[objective.objective_id]}"><span class="help">Baseline desirability, 0–100</span></label>`).join('')}</div>
      <details><summary>Adaptive pathway fields</summary><div class="grid-2" style="margin-top:1rem">${textarea('Act now', `strategy-action-${strategyIndex}`, strategy.action_now)}${textarea('Monitor', `strategy-monitor-${strategyIndex}`, strategy.monitor)}${textarea('Trigger', `strategy-trigger-${strategyIndex}`, strategy.trigger)}${textarea('Contingency', `strategy-contingency-${strategyIndex}`, strategy.contingency)}</div></details>
    </article>`).join('')}
    <div class="callout"><strong>Why baseline scores?</strong><p class="muted">They are transparent analyst inputs for this reference implementation, not empirical probabilities. Every value can be inspected and changed.</p></div>
  </div>`;
}

function scenariosStep() {
  const objectives = state.decision.objectives;
  const strategies = state.decision.strategies;
  return `<div class="stack">
    <div><span class="eyebrow">Step 4 · Explore many futures</span><h2 id="decision-step-heading" tabindex="-1">Describe plausible conditions, not one forecast</h2><p class="muted">Each future may affect each strategy differently. These transparent response modifiers are analyst inputs, not probabilities.</p></div>
    ${state.decision.scenarios.map((scenario, scenarioIndex) => `<article class="panel stack">
      <div class="grid-2">${field('Scenario', `scenario-label-${scenarioIndex}`, scenario.label)}${textarea('Description', `scenario-description-${scenarioIndex}`, scenario.description)}</div>
      <div class="actions">${Object.entries(scenario.states).map(([uncertaintyId, value]) => badge(`${uncertaintyId}: ${value}`)).join('')}</div>
      <details open><summary><strong>Strategy-specific response modifiers</strong></summary><div class="stack" style="margin-top:1rem">${strategies.map((strategy) => `<section class="soft-panel stack"><strong>${escapeHtml(strategy.label)}</strong><div class="score-grid">${objectives.map((objective) => `<label class="score-field">${escapeHtml(objective.label)} modifier<input data-scenario-strategy-modifier="${scenarioIndex}:${strategy.strategy_id}:${objective.objective_id}" type="number" min="-100" max="100" value="${scenario.strategy_modifiers?.[strategy.strategy_id]?.[objective.objective_id] ?? 0}"><span class="help">Added only to this strategy</span></label>`).join('')}</div></section>`).join('')}</div></details>
    </article>`).join('')}
    <div class="callout warning"><strong>Plausibility is not probability</strong><p class="muted">The model asks whether a strategy survives a future and where it fails. It does not estimate how likely that future is.</p></div>
  </div>`;
}

function resultsStep() {
  const summaries = summarizeStrategies(state.decision);
  const candidate = robustCandidate(state.decision);
  const objectives = new Map(state.decision.objectives.map((item) => [item.objective_id, item]));
  const selectedStrategyId = state.decision.human_decision.selected_strategy_id || candidate?.strategy_id;
  const vulnerabilities = vulnerabilityMap(state.decision, selectedStrategyId);
  const matrix = buildPerformanceMatrix(state.decision);
  const failureLabel = (failure) => {
    const objective = objectives.get(failure.objective_id);
    const relation = objective?.direction === 'at-most' ? '>' : '<';
    return `${objective?.label}: ${failure.value} ${relation} ${failure.threshold}`;
  };
  return `<div class="stack">
    <div><span class="eyebrow">Step 5 · Vulnerability before recommendation</span><h2 id="decision-step-heading" tabindex="-1">Stress-test every strategy</h2><p class="muted">Robustness is evaluated across declared thresholds, with critical-objective failures treated as gates before broader performance comparisons.</p></div>
    <div class="grid-3">${summaries.map((summary) => `<article class="metric-card-like ${summary.strategy_id === candidate?.strategy_id ? `candidate ${summary.critical_failure_scenario_count > 0 ? 'has-critical-gaps' : ''}` : ''}"><span class="help">${summary.strategy_id === candidate?.strategy_id ? (summary.critical_failure_scenario_count > 0 ? 'Leading candidate · critical gaps remain' : 'Robust candidate') : 'Strategy'}</span><strong>${escapeHtml(summary.label)}</strong><div class="big-number">${formatPercent(summary.overall_pass_rate)}</div><span class="help">Overall threshold pass rate</span><div class="result-line"><span>Worst scenario</span><strong>${formatPercent(summary.worst_case_pass_rate)}</strong></div><div class="result-line"><span>Critical-failure futures</span><strong>${summary.critical_failure_scenario_count}</strong></div><div class="result-line"><span>Critical misses</span><strong>${summary.critical_failure_count}</strong></div></article>`).join('')}</div>
    <details class="matrix-details soft-panel"><summary><strong>Inspect the full strategy × scenario × objective matrix</strong><span class="help">Detailed values remain available without overwhelming the initial decision view.</span></summary><div class="table-wrap" style="margin-top:1rem"><table><caption>Strategy performance across every included scenario and objective</caption><thead><tr><th scope="col">Strategy</th><th scope="col">Scenario</th>${state.decision.objectives.map((objective) => `<th scope="col">${escapeHtml(objective.label)}<br><span class="help">Threshold ${objective.threshold}${objective.critical ? ' · critical' : ''}</span></th>`).join('')}</tr></thead><tbody>${state.decision.strategies.flatMap((strategy) => state.decision.scenarios.map((scenario) => `<tr><th scope="row">${escapeHtml(strategy.label)}</th><td>${escapeHtml(scenario.label)}</td>${state.decision.objectives.map((objective) => { const row = matrix.find((entry) => entry.strategy_id === strategy.strategy_id && entry.scenario_id === scenario.scenario_id && entry.objective_id === objective.objective_id); return `<td><strong>${row.value}</strong><br>${row.passed ? badge('Pass', 'measured') : badge(objective.critical ? 'Critical miss' : 'Miss', 'interpreted')}</td>`; }).join('')}</tr>`)).join('')}</tbody></table></div></details>
    <section class="panel stack"><div class="section-head"><div><span class="eyebrow">Vulnerability map</span><h3>${escapeHtml(state.decision.strategies.find((item) => item.strategy_id === selectedStrategyId)?.label || '')}</h3></div><p>Where the currently selected human strategy misses declared thresholds.</p></div>${vulnerabilities.map((scenario) => `<div class="vulnerability ${scenario.vulnerable ? 'is-vulnerable' : 'is-resilient'}"><div><strong>${escapeHtml(scenario.label)}</strong><p class="help">${escapeHtml(scenario.description)}</p></div><div>${scenario.failures.length ? scenario.failures.map((failure) => badge(failureLabel(failure), failure.critical ? 'interpreted' : 'assumed')).join('') : badge('All thresholds met', 'measured')}</div></div>`).join('')}</section>
    <div class="callout"><strong>Machine-generated candidate, human-owned decision</strong><p class="muted">The candidate first minimizes futures with critical-objective failures, then compares worst-case critical performance, worst-case overall performance, and overall performance. Decision owners may choose differently and must record why.</p></div>
  </div>`;
}

function decisionBriefStep() {
  const decision = state.decision;
  const candidate = robustCandidate(decision);
  const selected = decision.strategies.find((item) => item.strategy_id === decision.human_decision.selected_strategy_id) || decision.strategies[0];
  const validation = validateDecisionCase(decision);
  const selectedVulnerabilities = vulnerabilityMap(decision, selected?.strategy_id).filter((item) => item.vulnerable);
  return `<div class="stack">
    <div><span class="eyebrow">Step 6 · Decision-ready output</span><h2 id="decision-step-heading" tabindex="-1">Robust Decision Brief</h2><p class="muted">Leaders receive one bounded decision, its assumptions, the conditions that could break it, and the next action.</p></div>
    <section class="decision-brief">
      <div class="brief-head"><div><span class="eyebrow">Decision question</span><h3>${escapeHtml(decision.question)}</h3></div><div class="actions">${badge(decision.status)}${badge(`Profile: ${decision.profile}`)}</div></div>
      <div class="brief-grid">
        <div><span class="help">Decision owner</span><strong>${escapeHtml(decision.decision_owner)}</strong></div>
        <div><span class="help">Time horizon</span><strong>${escapeHtml(decision.time_horizon)}</strong></div>
        <div><span class="help">Machine candidate</span><strong>${escapeHtml(candidate?.label || 'Not available')}</strong>${candidate?.critical_failure_scenario_count ? `<span class="help">Critical gaps remain in ${candidate.critical_failure_scenario_count} included future${candidate.critical_failure_scenario_count === 1 ? '' : 's'}.</span>` : ''}</div>
        <div><span class="help">Human selection</span><strong>${escapeHtml(selected?.label || 'Not selected')}</strong></div>
      </div>
      <label class="field">Human-selected strategy<select id="human-strategy">${decision.strategies.map((strategy) => `<option value="${strategy.strategy_id}" ${strategy.strategy_id === selected?.strategy_id ? 'selected' : ''}>${escapeHtml(strategy.label)}</option>`).join('')}</select></label>
      <label class="field">Decision rationale<textarea id="human-rationale" required>${escapeHtml(decision.human_decision.rationale)}</textarea><span class="help">Required. Explain why the human selection is justified, especially when it differs from the machine candidate.</span></label>
      <label class="field">Single next action<textarea id="human-next-action" required>${escapeHtml(decision.human_decision.next_action)}</textarea><span class="help">Required. State one accountable action that can be executed and reviewed.</span></label>
      <details class="decision-section soft-panel" open><summary><strong>Evidence, assumptions, and vulnerabilities</strong></summary><div class="grid-2 decision-section-body">
        <div class="stack"><h3>What is known</h3><ul>${decision.evidence_summary.known.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="stack"><h3>What is assumed</h3><ul>${decision.evidence_summary.assumed.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="stack"><h3>What remains uncertain</h3><ul>${decision.evidence_summary.unknown.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="stack"><h3>Conditions that could break the selection</h3>${selectedVulnerabilities.length ? `<ul>${selectedVulnerabilities.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${item.failures.map((failure) => escapeHtml(decision.objectives.find((objective) => objective.objective_id === failure.objective_id)?.label || failure.objective_id)).join(', ')}</li>`).join('')}</ul>` : '<p class="muted">No declared threshold failures in the included futures.</p>'}</div>
      </div></details>
      <details class="decision-section soft-panel" open><summary><strong>Adaptive pathway</strong></summary><div class="grid-2 decision-section-body"><div class="stack"><h3>Act now</h3><ul>${decision.adaptive_pathway.act_now.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="stack"><h3>Monitor</h3><ul>${decision.adaptive_pathway.monitor.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="stack"><h3>Trigger</h3><ul>${decision.adaptive_pathway.triggers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="stack"><h3>Contingencies</h3><ul>${decision.adaptive_pathway.contingencies.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></div><p><strong>Reassessment:</strong> ${escapeHtml(decision.adaptive_pathway.reassessment)}</p></details>
    </section>
    <div class="actions"><button id="export-decision-json" class="primary" type="button">Download decision JSON</button><button id="export-decision-html" type="button">Download decision brief</button><button id="reset-decision" class="ghost" type="button">Restore reference case</button></div>
    <div id="decision-validation" class="status-line" role="alert" tabindex="-1" aria-live="assertive">${validation.valid ? 'Decision case passes v0.2.10 structural validation.' : escapeHtml(validation.errors.join(' '))}</div>
  </div>`;
}

export const decisionStepRenderers = [frameStep, mapStep, strategiesStep, scenariosStep, resultsStep, decisionBriefStep];

function syncStep() {
  const decision = state.decision;
  if (state.step === 0) {
    decision.title = document.querySelector('#decision-title')?.value.trim() || decision.title;
    decision.question = document.querySelector('#decision-question')?.value.trim() || decision.question;
    decision.decision_owner = document.querySelector('#decision-owner')?.value.trim() || decision.decision_owner;
    decision.time_horizon = document.querySelector('#decision-horizon')?.value.trim() || decision.time_horizon;
    decision.urgency = document.querySelector('#decision-urgency')?.value || decision.urgency;
    decision.reversibility = document.querySelector('#decision-reversibility')?.value || decision.reversibility;
  }
  if (state.step === 1) {
    document.querySelectorAll('[data-objective-threshold]').forEach((input) => {
      decision.objectives[Number(input.dataset.objectiveThreshold)].threshold = Number(input.value);
    });
  }
  if (state.step === 2) {
    decision.strategies.forEach((strategy, index) => {
      strategy.label = document.querySelector(`#strategy-label-${index}`)?.value.trim() || strategy.label;
      strategy.description = document.querySelector(`#strategy-description-${index}`)?.value.trim() || strategy.description;
      strategy.action_now = document.querySelector(`#strategy-action-${index}`)?.value.trim() || strategy.action_now;
      strategy.monitor = document.querySelector(`#strategy-monitor-${index}`)?.value.trim() || strategy.monitor;
      strategy.trigger = document.querySelector(`#strategy-trigger-${index}`)?.value.trim() || strategy.trigger;
      strategy.contingency = document.querySelector(`#strategy-contingency-${index}`)?.value.trim() || strategy.contingency;
    });
    document.querySelectorAll('[data-strategy-score]').forEach((input) => {
      const [strategyIndex, objectiveId] = input.dataset.strategyScore.split(':');
      decision.strategies[Number(strategyIndex)].baseline[objectiveId] = Number(input.value);
    });
  }
  if (state.step === 3) {
    decision.scenarios.forEach((scenario, index) => {
      scenario.label = document.querySelector(`#scenario-label-${index}`)?.value.trim() || scenario.label;
      scenario.description = document.querySelector(`#scenario-description-${index}`)?.value.trim() || scenario.description;
    });
    document.querySelectorAll('[data-scenario-strategy-modifier]').forEach((input) => {
      const [scenarioIndex, strategyId, objectiveId] = input.dataset.scenarioStrategyModifier.split(':');
      decision.scenarios[Number(scenarioIndex)].strategy_modifiers[strategyId][objectiveId] = Number(input.value);
    });
  }
  if (state.step === 5) {
    decision.human_decision.selected_strategy_id = document.querySelector('#human-strategy')?.value || decision.human_decision.selected_strategy_id;
    decision.human_decision.rationale = document.querySelector('#human-rationale')?.value.trim() || '';
    decision.human_decision.next_action = document.querySelector('#human-next-action')?.value.trim() || '';
  }
}

export function buildDecisionHtml(decision) {
  const summaries = summarizeStrategies(decision);
  const candidate = robustCandidate(decision);
  const selected = decision.strategies.find((item) => item.strategy_id === decision.human_decision.selected_strategy_id);
  const vulnerabilities = vulnerabilityMap(decision, selected?.strategy_id).filter((item) => item.vulnerable);
  const list = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(decision.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 20px;line-height:1.55;color:#172033}section{margin:28px 0;padding-top:12px;border-top:1px solid #d7dce5}table{width:100%;border-collapse:collapse}caption{text-align:left;font-weight:700;margin-bottom:8px}th,td{text-align:left;padding:8px;border-bottom:1px solid #d7dce5}.tag{display:inline-block;border:1px solid #aeb7c7;border-radius:999px;padding:3px 9px;margin:2px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}@media(max-width:650px){.grid{grid-template-columns:1fr}}@media print{body{max-width:none;margin:0;padding:0;color:#000}section{break-inside:avoid}.no-print{display:none}}</style></head><body><h1>${escapeHtml(decision.title)}</h1><p>${escapeHtml(decision.question)}</p><p><span class="tag">${escapeHtml(decision.profile)}</span><span class="tag">Human-governed</span><span class="tag">${decision.provenance.probability_model_used ? 'Probability model disclosed' : 'No probability model'}</span></p><section><h2>Decision</h2><p><strong>Machine candidate:</strong> ${escapeHtml(candidate?.label || 'Not available')}${candidate?.critical_failure_scenario_count ? ` <em>(critical gaps in ${candidate.critical_failure_scenario_count} included future${candidate.critical_failure_scenario_count === 1 ? '' : 's'})</em>` : ''}</p><p><strong>Human selection:</strong> ${escapeHtml(selected?.label || 'Not selected')}</p><p>${escapeHtml(decision.human_decision.rationale)}</p><p><strong>Next action:</strong> ${escapeHtml(decision.human_decision.next_action)}</p></section><section><h2>Evidence boundary</h2><div class="grid"><div><h3>Known</h3>${list(decision.evidence_summary.known)}</div><div><h3>Assumed</h3>${list(decision.evidence_summary.assumed)}</div><div><h3>Unknown</h3>${list(decision.evidence_summary.unknown)}</div><div><h3>Selected-strategy vulnerabilities</h3>${vulnerabilities.length ? `<ul>${vulnerabilities.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${item.failures.map((failure) => escapeHtml(decision.objectives.find((objective) => objective.objective_id === failure.objective_id)?.label || failure.objective_id)).join(', ')}</li>`).join('')}</ul>` : '<p>No declared threshold failures in the included futures.</p>'}</div></div></section><section><h2>Strategy stress test</h2><table><caption>Threshold performance by strategy</caption><thead><tr><th scope="col">Strategy</th><th scope="col">Overall pass</th><th scope="col">Worst scenario</th><th scope="col">Critical-failure futures</th><th scope="col">Critical misses</th></tr></thead><tbody>${summaries.map((item) => `<tr><th scope="row">${escapeHtml(item.label)}</th><td>${formatPercent(item.overall_pass_rate)}</td><td>${formatPercent(item.worst_case_pass_rate)}</td><td>${item.critical_failure_scenario_count}</td><td>${item.critical_failure_count}</td></tr>`).join('')}</tbody></table></section><section><h2>Adaptive pathway</h2><div class="grid"><div><h3>Act now</h3>${list(decision.adaptive_pathway.act_now)}</div><div><h3>Monitor</h3>${list(decision.adaptive_pathway.monitor)}</div><div><h3>Triggers</h3>${list(decision.adaptive_pathway.triggers)}</div><div><h3>Contingencies</h3>${list(decision.adaptive_pathway.contingencies)}</div></div><p><strong>Reassessment:</strong> ${escapeHtml(decision.adaptive_pathway.reassessment)}</p></section><p>Generated by Frontier Decision Engine v0.2.10. Scores are transparent analyst inputs, not probabilities.</p></body></html>`;
}

function focusValidationFailure(root, result) {
  const rationale = root.querySelector('#human-rationale');
  const nextAction = root.querySelector('#human-next-action');
  for (const element of [rationale, nextAction]) element?.removeAttribute('aria-invalid');
  if (!String(rationale?.value || '').trim()) {
    rationale?.setAttribute('aria-invalid', 'true');
    rationale?.focus();
    return;
  }
  if (!String(nextAction?.value || '').trim()) {
    nextAction?.setAttribute('aria-invalid', 'true');
    nextAction?.focus();
    return;
  }
  const message = root.querySelector('#decision-validation');
  if (message) {
    message.textContent = result.errors.join(' ');
    message.focus();
  }
}

function bindEvents(root) {
  root.querySelectorAll('[data-decision-step]').forEach((button) => button.addEventListener('click', () => {
    syncStep();
    state.step = Number(button.dataset.decisionStep);
    renderInto(root.closest('main') || root, { focusStep: true });
  }));
  root.querySelector('#decision-back')?.addEventListener('click', () => {
    syncStep();
    state.step = Math.max(0, state.step - 1);
    renderInto(root.closest('main') || root, { focusStep: true });
  });
  root.querySelector('#decision-next')?.addEventListener('click', () => {
    syncStep();
    state.step = Math.min(steps.length - 1, state.step + 1);
    renderInto(root.closest('main') || root, { focusStep: true });
  });
  root.querySelector('#human-strategy')?.addEventListener('change', (event) => {
    state.decision.human_decision.selected_strategy_id = event.target.value;
  });
  root.querySelector('#export-decision-json')?.addEventListener('click', () => {
    syncStep();
    state.decision.provenance.generated_at = new Date().toISOString();
    const result = validateDecisionCase(state.decision);
    const message = root.querySelector('#decision-validation');
    if (!result.valid) {
      if (message) message.textContent = result.errors.join(' ');
      focusValidationFailure(root, result);
      return;
    }
    downloadText(safeFilename(state.decision.title, 'fde.json'), `${JSON.stringify(state.decision, null, 2)}\n`, 'application/json');
  });
  root.querySelector('#export-decision-html')?.addEventListener('click', () => {
    syncStep();
    state.decision.provenance.generated_at = new Date().toISOString();
    const result = validateDecisionCase(state.decision);
    const message = root.querySelector('#decision-validation');
    if (!result.valid) {
      if (message) message.textContent = result.errors.join(' ');
      focusValidationFailure(root, result);
      return;
    }
    downloadText(safeFilename(state.decision.title, 'decision.html'), buildDecisionHtml(state.decision), 'text/html');
  });
  root.querySelector('#reset-decision')?.addEventListener('click', () => {
    state.decision = createDecisionCase();
    state.step = 0;
    renderInto(root.closest('main') || root, { focusStep: true });
  });
}

function renderInto(main, { focusStep = false } = {}) {
  main.innerHTML = `
    <div class="breadcrumbs"><a href="#/">Home</a><span aria-hidden="true">/</span><span>Decision Lab</span></div>
    <section class="section-head"><div><span class="eyebrow">Frontier Decision Engine</span><h1 class="page-title">Decide well when prediction fails.</h1></div><p>Reference vertical slice: one decision, three strategies, four futures, explicit objectives, visible assumptions, and a human-owned conclusion.</p></section>
    <div class="wizard decision-wizard">
      ${decisionNav()}
      <div class="wizard-content panel"><div id="decision-step-content">${decisionStepRenderers[state.step]()}</div>
        <div class="wizard-actions"><button id="decision-back" type="button" ${state.step === 0 ? 'disabled' : ''}>Back</button><span class="status-line">Step ${state.step + 1} of ${steps.length}</span><button id="decision-next" class="primary" type="button" ${state.step === steps.length - 1 ? 'disabled' : ''}>Continue</button></div>
      </div>
    </div>`;
  bindEvents(main);
  if (focusStep) requestAnimationFrame(() => {
    const heading = main.querySelector('#decision-step-heading');
    if (!heading) return;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
}

export function renderDecisionLab(main) {
  renderInto(main);
}
