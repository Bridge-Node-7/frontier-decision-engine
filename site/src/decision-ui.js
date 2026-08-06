import {
  buildPerformanceMatrix,
  createDecisionCase,
  CANDIDATE_STATE,
  OUTCOME_STATE,
  robustCandidate,
  robustCandidateDecision,
  summarizeStrategies,
  validateAnalysisReady,
  validateDecisionCase,
  vulnerabilityMap,
} from './lib/decision.js';
import { downloadText, safeFilename } from './lib/case.js';
import { readOptionalNumber, readTrimmedText } from './lib/input.js';
import { clearSavedDecision, getBrowserStorage, loadSavedDecision, parseDecisionFile, saveDecision } from './lib/persistence.js';

const steps = ['Your decision', 'What matters', 'Your choices', 'What may change', 'What we learned', 'Choose next step'];

const browserStorage = getBrowserStorage(globalThis);
const restored = loadSavedDecision(browserStorage, validateDecisionCase);
const state = {
  step: 0,
  decision: restored.decision || createDecisionCase(),
  saveStatus: restored.status,
};
function persistDecision() {
  const result = saveDecision(browserStorage, state.decision);
  state.saveStatus = result.status;
  return result;
}

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
    <div><span class="eyebrow">Step 1 · Your decision</span><h2 id="decision-step-heading" tabindex="-1">What are you trying to choose?</h2><p class="muted">Write the choice in ordinary words. You do not need data, statistics, or a perfect answer to begin.</p></div>
    ${field('Give this decision a short name', 'decision-title', item.title, 'text', 'Example: Should we qualify a second critical-material source?')}
    ${textarea('What choice needs to be made?', 'decision-question', item.question, 'Write one clear question that a person can answer.')}
    <div class="grid-2">
      ${field('Who is responsible for deciding?', 'decision-owner', item.decision_owner, 'text', 'Use a person or role, such as Research lead.')}
      ${field('How far ahead are you thinking?', 'decision-horizon', item.time_horizon, 'text', 'Example: 90 days, one year, or five years.')}
      <label class="field">How soon is the choice needed?<select id="decision-urgency"><option value="immediate" ${item.urgency === 'immediate' ? 'selected' : ''}>Immediate</option><option value="near-term" ${item.urgency === 'near-term' ? 'selected' : ''}>Near term</option><option value="planned" ${item.urgency === 'planned' ? 'selected' : ''}>Planned</option></select></label>
      <label class="field">Can the choice be changed later?<select id="decision-reversibility"><option value="reversible" ${item.reversibility === 'reversible' ? 'selected' : ''}>Reversible</option><option value="partially-reversible" ${item.reversibility === 'partially-reversible' ? 'selected' : ''}>Partially reversible</option><option value="irreversible" ${item.reversibility === 'irreversible' ? 'selected' : ''}>Irreversible</option></select></label>
    </div>
    <div class="beginner-note"><strong>Why this matters</strong><span>A clear question and a responsible decision owner keep the tool focused on a real action.</span></div>
  </div>`;
}

function mapStep() {
  const item = state.decision;
  return `<div class="stack">
    <div><span class="eyebrow">Step 2 · What matters</span><h2 id="decision-step-heading" tabindex="-1">What matters, and what may change?</h2><p class="muted">Keep goals, unknowns, choices, and assumptions in separate boxes so they do not get confused.</p></div>
    <div class="decision-map">
      <section class="panel stack"><div class="actions"><strong>What may change <span class="method-word">(X · uncertainties)</span></strong>${badge(`${item.uncertainties.length}`)}</div>${item.uncertainties.map((uncertainty) => `<div class="map-item"><strong>${escapeHtml(uncertainty.label)}</strong><p class="help">${escapeHtml(uncertainty.description)}</p><div class="actions">${uncertainty.states.map((entry) => badge(entry)).join('')}</div></div>`).join('')}</section>
      <section class="panel stack"><div class="actions"><strong>Choices you control <span class="method-word">(L · levers)</span></strong>${badge(`${item.strategies.length}`)}</div>${item.strategies.map((strategy) => `<div class="map-item"><strong>${escapeHtml(strategy.label)}</strong><p class="help">${escapeHtml(strategy.description)}</p></div>`).join('')}</section>
      <section class="panel stack"><div class="actions"><strong>How things may connect <span class="method-word">(R · relationships)</span></strong>${badge(`${item.relationships.length}`)}</div>${item.relationships.map((relationship) => `<div class="map-item"><strong>${escapeHtml(relationship.evidence_class)}</strong><p class="help">${escapeHtml(relationship.statement)}</p></div>`).join('')}</section>
      <section class="panel stack"><div class="actions"><strong>What success looks like <span class="method-word">(M · measures)</span></strong>${badge(`${item.objectives.length}`)}</div>${item.objectives.map((objective, index) => `<label class="field map-item">${escapeHtml(objective.label)} good-enough line<input data-objective-threshold="${index}" type="number" min="0" max="100" step="1" value="${objective.threshold}"><span class="help">${escapeHtml(objective.description)} ${objective.direction === 'at-most' ? 'Lower values are better.' : 'Higher values are better.'} <span class="method-word">This good-enough line is called a threshold.</span></span></label>`).join('')}</section>
    </div>
    <div class="beginner-note"><strong>No secret final score</strong><span>Each goal stays visible. The tool shows trade-offs instead of hiding everything inside one number.</span></div>
  </div>`;
}

function strategiesStep() {
  const objectives = state.decision.objectives;
  return `<div class="stack">
    <div><span class="eyebrow">Step 3 · Your choices</span><h2 id="decision-step-heading" tabindex="-1">What could you actually do?</h2><p class="muted">A choice should describe a real action. The ready example includes a low-cost choice, an immediate choice, and a staged choice.</p></div>
    ${state.decision.strategies.map((strategy, strategyIndex) => `<article class="panel stack">
      <div class="grid-2">${field('Choice name', `strategy-label-${strategyIndex}`, strategy.label)}${textarea('What would this choice do?', `strategy-description-${strategyIndex}`, strategy.description)}</div>
      <div class="score-grid">${objectives.map((objective) => `<label class="score-field">${escapeHtml(objective.label)}<input data-strategy-score="${strategyIndex}:${objective.objective_id}" type="number" min="0" max="100" value="${strategy.baseline[objective.objective_id]}"><span class="help">Starting score in this simple example: 0 means weak, 100 means strong. <span class="method-word">This is an analyst-assigned baseline, not a probability.</span></span></label>`).join('')}</div>
      <details><summary>Plan for change <span class="method-word">(adaptive planning fields)</span></summary><div class="grid-2" style="margin-top:1rem">${textarea('What would you do now?', `strategy-action-${strategyIndex}`, strategy.action_now)}${textarea('What would you watch?', `strategy-monitor-${strategyIndex}`, strategy.monitor)}${textarea('What would make you change course?', `strategy-trigger-${strategyIndex}`, strategy.trigger)}${textarea('What is the backup plan?', `strategy-contingency-${strategyIndex}`, strategy.contingency)}</div></details>
    </article>`).join('')}
    <div class="beginner-note"><strong>About the 0–100 scores</strong><span>They are visible example inputs, not facts or probabilities. You can inspect and change every value.</span></div>
  </div>`;
}

function scenariosStep() {
  const objectives = state.decision.objectives;
  const strategies = state.decision.strategies;
  return `<div class="stack">
    <div><span class="eyebrow">Step 4 · What may change</span><h2 id="decision-step-heading" tabindex="-1">Explore more than one possible future</h2><p class="muted">We do not pretend to know which future will happen. We compare how every choice performs in each one.</p></div>
    ${state.decision.scenarios.map((scenario, scenarioIndex) => `<article class="panel stack">
      <div class="grid-2">${field('Future name', `scenario-label-${scenarioIndex}`, scenario.label)}${textarea('What happens in this future?', `scenario-description-${scenarioIndex}`, scenario.description)}</div>
      <div class="actions">${Object.entries(scenario.states).map(([uncertaintyId, value]) => badge(`${uncertaintyId}: ${value}`)).join('')}</div>
      <details><summary><strong>Advanced: how this future changes each choice</strong></summary><div class="stack" style="margin-top:1rem">${strategies.map((strategy) => `<section class="soft-panel stack"><strong>${escapeHtml(strategy.label)}</strong><div class="score-grid">${objectives.map((objective) => `<label class="score-field">${escapeHtml(objective.label)} modifier<input data-scenario-strategy-modifier="${scenarioIndex}:${strategy.strategy_id}:${objective.objective_id}" type="number" min="-100" max="100" value="${scenario.strategy_modifiers?.[strategy.strategy_id]?.[objective.objective_id] ?? 0}"><span class="help">Change to this choice in this future. <span class="method-word">This is a response modifier.</span></span></label>`).join('')}</div></section>`).join('')}</div></details>
    </article>`).join('')}
    <div class="beginner-note"><strong>Possible does not mean likely</strong><span>The tool explores what may happen. It does not claim how likely each future is.</span></div>
  </div>`;
}

function resultsStep() {
  const readiness = validateAnalysisReady(state.decision);
  if (!readiness.valid) {
    return `<div class="stack"><div><span class="eyebrow">Step 5 · Validation before analysis</span><h2 id="decision-step-heading" tabindex="-1">One update is needed</h2><p class="muted">FDE pauses comparison until every expected outcome is complete and usable.</p></div><div class="callout warning"><strong>Complete the case before comparison</strong><ul>${readiness.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul></div></div>`;
  }
  const summaries = summarizeStrategies(state.decision);
  const candidateResult = robustCandidateDecision(state.decision);
  const candidate = candidateResult.status === CANDIDATE_STATE.UNIQUE_LEADER ? candidateResult.candidates[0] : null;
  const objectives = new Map(state.decision.objectives.map((item) => [item.objective_id, item]));
  const selectedStrategyId = state.decision.human_decision.selected_strategy_id || candidate?.strategy_id;
  const vulnerabilities = vulnerabilityMap(state.decision, selectedStrategyId);
  const matrix = buildPerformanceMatrix(state.decision);
  const candidateNotice = candidateResult.status === CANDIDATE_STATE.TIED_LEADERS
    ? `<div class="callout warning"><strong>Tied leading choices</strong><p class="muted">${candidateResult.candidates.map((item) => escapeHtml(item.label)).join('; ')} are indistinguishable under the declared ranking rules. FDE does not resolve the tie by array order.</p></div>`
    : candidateResult.status === CANDIDATE_STATE.INSUFFICIENT_DATA
      ? '<div class="callout warning"><strong>More complete information needed</strong><p class="muted">A strongest tested alignment appears after every expected outcome is complete and usable.</p></div>'
      : '';
  const failureLabel = (failure) => {
    const objective = objectives.get(failure.objective_id);
    const relation = objective?.direction === 'at-most' ? '>' : '<';
    return `${objective?.label}: ${failure.value} ${relation} ${failure.threshold}`;
  };
  const outcomeBadge = (row, objective) => {
    if (row.state === OUTCOME_STATE.VALID_PASS) return badge('Pass', 'measured');
    if (row.state === OUTCOME_STATE.VALID_FAIL) return badge(objective.critical ? 'Important goal not yet met' : 'Goal not yet met', 'interpreted');
    return badge('Invalid outcome', 'assumed');
  };
  return `<div class="stack">
    <div><span class="eyebrow">Step 5 · What we learned</span><h2 id="decision-step-heading" tabindex="-1">How do the choices perform across changing conditions?</h2><p class="muted">The tool compares each choice across every future and every good-enough line. Goals that need attention appear first.</p></div>
    ${candidateNotice}
    <div class="grid-3">${summaries.map((summary) => `<article class="metric-card-like ${summary.strategy_id === candidate?.strategy_id ? `candidate ${summary.critical_failure_scenario_count > 0 ? 'has-critical-gaps' : ''}` : ''}"><span class="help">${!summary.analysis_valid ? 'Invalid data · not ranked' : summary.strategy_id === candidate?.strategy_id ? (summary.critical_failure_scenario_count > 0 ? 'Strongest alignment in this comparison · goals to strengthen' : 'Strongest alignment in this comparison') : 'Strategy'}</span><strong>${escapeHtml(summary.label)}</strong><div class="big-number">${summary.analysis_valid ? formatPercent(summary.overall_pass_rate) : '—'}</div><span class="help">Share of selected goals reached across tested futures</span><div class="result-line"><span>Most demanding tested future</span><strong>${summary.analysis_valid ? formatPercent(summary.worst_case_pass_rate) : '—'}</strong></div><div class="result-line"><span>Tested futures with goals to strengthen</span><strong>${summary.critical_failure_scenario_count}</strong></div><div class="result-line"><span>Outcomes needing attention</span><strong>${summary.invalid_outcome_count}</strong></div></article>`).join('')}</div>
    <details class="matrix-details soft-panel"><summary><strong>See the detailed calculation table</strong><span class="help">Detailed values remain available after the plain-language summary.</span></summary><div class="table-wrap" style="margin-top:1rem"><table><caption>How every choice performed across the tested futures and goals</caption><thead><tr><th scope="col">Strategy</th><th scope="col">Scenario</th>${state.decision.objectives.map((objective) => `<th scope="col">${escapeHtml(objective.label)}<br><span class="help">Threshold ${objective.threshold}${objective.critical ? ' · critical' : ''}</span></th>`).join('')}</tr></thead><tbody>${state.decision.strategies.flatMap((strategy) => state.decision.scenarios.map((scenario) => `<tr><th scope="row">${escapeHtml(strategy.label)}</th><td>${escapeHtml(scenario.label)}</td>${state.decision.objectives.map((objective) => { const row = matrix.find((entry) => entry.strategy_id === strategy.strategy_id && entry.scenario_id === scenario.scenario_id && entry.objective_id === objective.objective_id); return `<td><strong>${row?.value ?? '—'}</strong><br>${outcomeBadge(row, objective)}</td>`; }).join('')}</tr>`)).join('')}</tbody></table></div></details>
    <section class="panel stack"><div class="section-head"><div><span class="eyebrow">Conditions to watch and strengthen</span><h3>${escapeHtml(state.decision.strategies.find((item) => item.strategy_id === selectedStrategyId)?.label || '')}</h3></div><p>The tested conditions where the selected choice may need more support to reach a good-enough line.</p></div>${vulnerabilities.map((scenario) => `<div class="vulnerability ${scenario.vulnerable ? 'is-vulnerable' : 'is-resilient'}"><div><strong>${escapeHtml(scenario.label)}</strong><p class="help">${escapeHtml(scenario.description)}</p></div><div>${scenario.invalids.length ? badge('Outcome needs attention · comparison paused', 'assumed') : scenario.failures.length ? scenario.failures.map((failure) => badge(failureLabel(failure), failure.critical ? 'interpreted' : 'assumed')).join('') : badge('All selected goals reached', 'measured')}</div></div>`).join('')}</section>
    <div class="callout"><strong>The comparison informs. A person decides.</strong><p class="muted">FDE shows ties, information that needs attention, and goals that are not yet met. You may choose differently, but you should explain why.</p></div>
  </div>`;
}
function decisionBriefStep() {
  const decision = state.decision;
  const candidateResult = robustCandidateDecision(decision);
  const candidate = candidateResult.status === CANDIDATE_STATE.UNIQUE_LEADER ? candidateResult.candidates[0] : null;
  const machineCandidateLabel = candidateResult.status === CANDIDATE_STATE.TIED_LEADERS
    ? `Tie: ${candidateResult.candidates.map((item) => item.label).join('; ')}`
    : candidate?.label || (candidateResult.status === CANDIDATE_STATE.INSUFFICIENT_DATA ? 'More complete information needed' : 'Not available');
  const selected = decision.strategies.find((item) => item.strategy_id === decision.human_decision.selected_strategy_id) || decision.strategies[0];
  const validation = validateDecisionCase(decision);
  const selectedVulnerabilities = vulnerabilityMap(decision, selected?.strategy_id).filter((item) => item.vulnerable);
  return `<div class="stack">
    <div><span class="eyebrow">Step 6 · Choose next step</span><h2 id="decision-step-heading" tabindex="-1">What advances next?</h2><p class="muted">Choose an option, explain why, and name one action that someone can complete and review.</p></div>
    <section class="decision-brief">
      <div class="brief-head"><div><span class="eyebrow">Decision question</span><h3>${escapeHtml(decision.question)}</h3></div><div class="actions">${badge(decision.status)}${badge(`Profile: ${decision.profile}`)}</div></div>
      <div class="brief-grid">
        <div><span class="help">Decision owner</span><strong>${escapeHtml(decision.decision_owner)}</strong></div>
        <div><span class="help">Time horizon</span><strong>${escapeHtml(decision.time_horizon)}</strong></div>
        <div><span class="help">Leading tested choice</span><strong>${escapeHtml(machineCandidateLabel)}</strong>${candidate?.critical_failure_scenario_count ? `<span class="help">Critical gaps remain in ${candidate.critical_failure_scenario_count} included future${candidate.critical_failure_scenario_count === 1 ? '' : 's'}.</span>` : ''}</div>
        <div><span class="help">Your decision</span><strong>${escapeHtml(selected?.label || 'Not selected')}</strong></div>
      </div>
      <label class="field">Which choice are you making?<select id="human-strategy">${decision.strategies.map((strategy) => `<option value="${strategy.strategy_id}" ${strategy.strategy_id === selected?.strategy_id ? 'selected' : ''}>${escapeHtml(strategy.label)}</option>`).join('')}</select></label>
      <label class="field">Why are you choosing it?<textarea id="human-rationale" required>${escapeHtml(decision.human_decision.rationale)}</textarea><span class="help">Use ordinary words. Mention the trade-off and any important uncertainty.</span></label>
      <label class="field">What advances next?<textarea id="human-next-action" required>${escapeHtml(decision.human_decision.next_action)}</textarea><span class="help">Name one action, one owner, and a time to check progress.</span></label>
      <details class="decision-section soft-panel" open><summary><strong>What we know, what we estimated, and what to strengthen</strong></summary><div class="grid-2 decision-section-body">
        <div class="stack"><h3>What is known</h3><ul>${decision.evidence_summary.known.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="stack"><h3>What is assumed</h3><ul>${decision.evidence_summary.assumed.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="stack"><h3>What remains uncertain</h3><ul>${decision.evidence_summary.unknown.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="stack"><h3>Conditions that could break the selection</h3>${selectedVulnerabilities.length ? `<ul>${selectedVulnerabilities.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${item.failures.map((failure) => escapeHtml(decision.objectives.find((objective) => objective.objective_id === failure.objective_id)?.label || failure.objective_id)).join(', ')}</li>`).join('')}</ul>` : '<p class="muted">No declared threshold failures in the included futures.</p>'}</div>
      </div></details>
      <details class="decision-section soft-panel" open><summary><strong>Plan for change <span class="method-word">(adaptive planning)</span></strong></summary><div class="grid-2 decision-section-body"><div class="stack"><h3>Act now</h3><ul>${decision.adaptive_pathway.act_now.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="stack"><h3>Monitor</h3><ul>${decision.adaptive_pathway.monitor.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="stack"><h3>Trigger</h3><ul>${decision.adaptive_pathway.triggers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="stack"><h3>Contingencies</h3><ul>${decision.adaptive_pathway.contingencies.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></div><p><strong>Reassessment:</strong> ${escapeHtml(decision.adaptive_pathway.reassessment)}</p></details>
    </section>
    <div class="self-service-panel" data-surface="decision-output"><div><strong>Finish and keep the record.</strong><p>Download the decision file for continued editing or the readable summary for review.</p></div><div class="actions"><button id="export-decision-json" data-action="download-decision-file" class="primary" type="button">Download your decision file</button><button id="export-decision-html" data-action="download-readable-summary" type="button">Download a readable summary</button><button id="reset-decision" class="ghost" type="button">Restore the ready case</button></div></div>
    <div id="decision-validation" class="status-line" role="alert" tabindex="-1" aria-live="assertive">${validation.valid ? 'Decision case passes v0.2.10 structural validation.' : escapeHtml(validation.errors.join(' '))}</div>
  </div>`;
}

export const decisionStepRenderers = [frameStep, mapStep, strategiesStep, scenariosStep, resultsStep, decisionBriefStep];

function syncStep() {
  const decision = state.decision;
  if (state.step === 0) {
    decision.title = readTrimmedText(document.querySelector('#decision-title'), decision.title);
    decision.question = readTrimmedText(document.querySelector('#decision-question'), decision.question);
    decision.decision_owner = readTrimmedText(document.querySelector('#decision-owner'), decision.decision_owner);
    decision.time_horizon = readTrimmedText(document.querySelector('#decision-horizon'), decision.time_horizon);
    decision.urgency = document.querySelector('#decision-urgency')?.value || decision.urgency;
    decision.reversibility = document.querySelector('#decision-reversibility')?.value || decision.reversibility;
  }
  if (state.step === 1) {
    document.querySelectorAll('[data-objective-threshold]').forEach((input) => {
      decision.objectives[Number(input.dataset.objectiveThreshold)].threshold = readOptionalNumber(input);
    });
  }
  if (state.step === 2) {
    decision.strategies.forEach((strategy, index) => {
      strategy.label = readTrimmedText(document.querySelector(`#strategy-label-${index}`), strategy.label);
      strategy.description = readTrimmedText(document.querySelector(`#strategy-description-${index}`), strategy.description);
      strategy.action_now = readTrimmedText(document.querySelector(`#strategy-action-${index}`), strategy.action_now);
      strategy.monitor = readTrimmedText(document.querySelector(`#strategy-monitor-${index}`), strategy.monitor);
      strategy.trigger = readTrimmedText(document.querySelector(`#strategy-trigger-${index}`), strategy.trigger);
      strategy.contingency = readTrimmedText(document.querySelector(`#strategy-contingency-${index}`), strategy.contingency);
    });
    document.querySelectorAll('[data-strategy-score]').forEach((input) => {
      const [strategyIndex, objectiveId] = input.dataset.strategyScore.split(':');
      decision.strategies[Number(strategyIndex)].baseline[objectiveId] = readOptionalNumber(input);
    });
  }
  if (state.step === 3) {
    decision.scenarios.forEach((scenario, index) => {
      scenario.label = readTrimmedText(document.querySelector(`#scenario-label-${index}`), scenario.label);
      scenario.description = readTrimmedText(document.querySelector(`#scenario-description-${index}`), scenario.description);
    });
    document.querySelectorAll('[data-scenario-strategy-modifier]').forEach((input) => {
      const [scenarioIndex, strategyId, objectiveId] = input.dataset.scenarioStrategyModifier.split(':');
      decision.scenarios[Number(scenarioIndex)].strategy_modifiers[strategyId][objectiveId] = readOptionalNumber(input);
    });
  }
  if (state.step === 5) {
    decision.human_decision.selected_strategy_id = document.querySelector('#human-strategy')?.value || decision.human_decision.selected_strategy_id;
    decision.human_decision.rationale = document.querySelector('#human-rationale')?.value.trim() || '';
    decision.human_decision.next_action = document.querySelector('#human-next-action')?.value.trim() || '';
  }
  persistDecision();
}

export function buildDecisionHtml(decision) {
  const summaries = summarizeStrategies(decision);
  const candidateResult = robustCandidateDecision(decision);
  const candidate = candidateResult.status === CANDIDATE_STATE.UNIQUE_LEADER ? candidateResult.candidates[0] : null;
  const machineCandidateLabel = candidateResult.status === CANDIDATE_STATE.TIED_LEADERS
    ? `Tie: ${candidateResult.candidates.map((item) => item.label).join('; ')}`
    : candidate?.label || (candidateResult.status === CANDIDATE_STATE.INSUFFICIENT_DATA ? 'More complete information needed' : 'Not available');
  const selected = decision.strategies.find((item) => item.strategy_id === decision.human_decision.selected_strategy_id);
  const vulnerabilities = vulnerabilityMap(decision, selected?.strategy_id).filter((item) => item.vulnerable);
  const list = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(decision.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 20px;line-height:1.55;color:#172033}section{margin:28px 0;padding-top:12px;border-top:1px solid #d7dce5}table{width:100%;border-collapse:collapse}caption{text-align:left;font-weight:700;margin-bottom:8px}th,td{text-align:left;padding:8px;border-bottom:1px solid #d7dce5}.tag{display:inline-block;border:1px solid #aeb7c7;border-radius:999px;padding:3px 9px;margin:2px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}@media(max-width:650px){.grid{grid-template-columns:1fr}}@media print{body{max-width:none;margin:0;padding:0;color:#000}section{break-inside:avoid}.no-print{display:none}}</style></head><body><h1>${escapeHtml(decision.title)}</h1><p>${escapeHtml(decision.question)}</p><p><span class="tag">${escapeHtml(decision.profile)}</span><span class="tag">Human-governed</span><span class="tag">${decision.provenance.probability_model_used ? 'Probability model disclosed' : 'No probability model'}</span></p><section><h2>Decision</h2><p><strong>Leading tested choice:</strong> ${escapeHtml(machineCandidateLabel)}${candidate?.critical_failure_scenario_count ? ` <em>(critical gaps in ${candidate.critical_failure_scenario_count} included future${candidate.critical_failure_scenario_count === 1 ? '' : 's'})</em>` : ''}</p><p><strong>Your decision:</strong> ${escapeHtml(selected?.label || 'Not selected')}</p><p>${escapeHtml(decision.human_decision.rationale)}</p><p><strong>Next action:</strong> ${escapeHtml(decision.human_decision.next_action)}</p></section><section><h2>Evidence boundary</h2><div class="grid"><div><h3>Known</h3>${list(decision.evidence_summary.known)}</div><div><h3>Assumed</h3>${list(decision.evidence_summary.assumed)}</div><div><h3>Unknown</h3>${list(decision.evidence_summary.unknown)}</div><div><h3>Selected-strategy vulnerabilities</h3>${vulnerabilities.length ? `<ul>${vulnerabilities.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${item.failures.map((failure) => escapeHtml(decision.objectives.find((objective) => objective.objective_id === failure.objective_id)?.label || failure.objective_id)).join(', ')}</li>`).join('')}</ul>` : '<p>No declared threshold failures in the included futures.</p>'}</div></div></section><section><h2>Strategy comparison</h2><table><caption>Threshold performance by strategy</caption><thead><tr><th scope="col">Strategy</th><th scope="col">Overall pass</th><th scope="col">Worst scenario</th><th scope="col">Critical-failure futures</th><th scope="col">Critical misses</th></tr></thead><tbody>${summaries.map((item) => `<tr><th scope="row">${escapeHtml(item.label)}</th><td>${formatPercent(item.overall_pass_rate)}</td><td>${formatPercent(item.worst_case_pass_rate)}</td><td>${item.critical_failure_scenario_count}</td><td>${item.critical_failure_count}</td></tr>`).join('')}</tbody></table></section><section><h2>Adaptive pathway</h2><div class="grid"><div><h3>Act now</h3>${list(decision.adaptive_pathway.act_now)}</div><div><h3>Monitor</h3>${list(decision.adaptive_pathway.monitor)}</div><div><h3>Triggers</h3>${list(decision.adaptive_pathway.triggers)}</div><div><h3>Contingencies</h3>${list(decision.adaptive_pathway.contingencies)}</div></div><p><strong>Reassessment:</strong> ${escapeHtml(decision.adaptive_pathway.reassessment)}</p></section><p>Generated by Frontier Decision Engine v0.2.10. Scores are transparent analyst inputs, not probabilities.</p></body></html>`;
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
  root.querySelector('#toggle-method-words')?.addEventListener('click', (event) => {
    const visible = document.documentElement.classList.toggle('show-method-words');
    event.currentTarget.setAttribute('aria-pressed', String(visible));
    event.currentTarget.textContent = visible ? 'Hide method words' : 'Show method words';
  });
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
  root.querySelector('#open-decision-file')?.addEventListener('click', () => root.querySelector('#decision-file-input')?.click());
  root.querySelector('#decision-file-input')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = await parseDecisionFile(file, validateDecisionCase);
    const message = root.querySelector('#decision-validation');
    if (!parsed.ok) {
      if (message) message.textContent = parsed.errors.join(' ');
      message?.focus();
      event.target.value = '';
      return;
    }
    state.decision = parsed.decision;
    state.step = 0;
    persistDecision();
    renderInto(root.closest('main') || root, { focusStep: true });
  });
  root.addEventListener('input', () => {
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = window.setTimeout(() => {
      syncStep();
      const status = document.querySelector('#decision-save-status');
      if (status) status.textContent = state.saveStatus;
    }, 250);
  });
  root.querySelector('#reset-decision')?.addEventListener('click', () => {
    if (!window.confirm('Start over with the ready example? This removes the decision saved in this browser.')) return;
    clearSavedDecision(browserStorage);
    state.decision = createDecisionCase();
    state.saveStatus = 'Ready example restored.';
    state.step = 0;
    renderInto(root.closest('main') || root, { focusStep: true });
  });
}

function renderInto(main, { focusStep = false } = {}) {
  main.innerHTML = `
    <div class="breadcrumbs"><a href="#/">Home</a><span aria-hidden="true">/</span><span>Decision Lab</span></div>
    <section class="section-head interface-heading" data-surface="working-interface"><div><span class="eyebrow">Working interface</span><h1 class="page-title">Decision Lab</h1></div><p>A synthetic critical-material case is loaded. Edit it through six steps or open a saved FDE decision file.</p></section>
    <div class="interface-entry-panel" data-surface="decision-entry">
      <div>
        <strong>Ready case loaded</strong>
        <p>Move through the six steps. Changes save in this browser.</p>
        <span id="decision-save-status" class="status-line" aria-live="polite">${escapeHtml(state.saveStatus)}</span>
      </div>
      <div class="actions">
        <button id="open-decision-file" data-action="open-saved-decision" type="button">Open a saved decision file</button>
        <input id="decision-file-input" type="file" accept="application/json,.json,.fde.json" hidden aria-label="Open a saved decision file">
        <button id="toggle-method-words" type="button" aria-pressed="false">Show method words</button>
      </div>
    </div>
    <div class="wizard decision-wizard">
      ${decisionNav()}
      <div class="wizard-content panel"><div id="decision-step-content">${decisionStepRenderers[state.step]()}</div>
        <div class="wizard-actions"><button id="decision-back" type="button" ${state.step === 0 ? 'disabled' : ''}>Back</button><span class="status-line">Step ${state.step + 1} of ${steps.length}: ${escapeHtml(steps[state.step])}</span><button id="decision-next" class="primary" type="button" ${state.step === steps.length - 1 ? 'disabled' : ''}>${state.step < steps.length - 1 ? `Next: ${escapeHtml(steps[state.step + 1])}` : 'Ready to review'}</button></div>
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

export function renderDecisionLab(main, { openFile = false } = {}) {
  renderInto(main);
  if (openFile) requestAnimationFrame(() => main.querySelector('#open-decision-file')?.click());
}
