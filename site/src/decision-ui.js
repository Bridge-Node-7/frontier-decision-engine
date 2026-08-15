import {
  buildPerformanceMatrix,
  createBlankDecisionCase,
  createDecisionCase,
  CANDIDATE_STATE,
  OUTCOME_STATE,
  robustCandidate,
  robustCandidateDecision,
  summarizeStrategies,
  validateAnalysisReady,
  validateCompletedDecisionCase,
  validateDecisionCase,
  validateDraftDecisionCase,
  vulnerabilityMap,
} from './lib/decision.js';
import { downloadText, safeFilename } from './lib/case.js';
import { readOptionalNumber, readTrimmedText } from './lib/input.js';
import { APPLICATION_VERSION } from './version.js';
import { canDownloadDraftBackup, clearSavedDecision, createDraftBackup, getBrowserStorage, loadSavedDecision, parseDecisionFile, saveDecision } from './lib/persistence.js';
import {
  activateDecisionSemantics,
  decisionPosture,
  EVIDENCE_STATES,
  CRITERION_OUTCOMES,
  semanticView,
  setCautiousOverride,
  summarizeFourP,
  updateVisibleCondition,
  updateVisibleMonitoring,
} from './lib/semantics.js';
import { deriveDecisionSynthesis } from './lib/synthesis.js';

const steps = ['Your decision', 'What matters', 'Your choices', 'What may change', 'What we learned', 'Choose next step'];

const browserStorage = getBrowserStorage(globalThis);
const restored = loadSavedDecision(browserStorage, validateDraftDecisionCase);
const state = {
  step: 0,
  decision: createBlankDecisionCase(),
  source: 'blank',
  pendingDraft: restored.decision,
  entryResolved: !restored.decision,
  maxReached: 0,
  expandAll: false,
  saveStatus: restored.decision ? 'A browser draft is available.' : restored.status,
};

function startDecision(decision, source, status) {
  state.decision = decision;
  state.source = source;
  state.pendingDraft = null;
  state.entryResolved = true;
  state.saveStatus = status;
  state.step = 0;
  state.maxReached = 0;
  state.expandAll = false;
}
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

function onePageIntro() {
  return `<section class="fde-hero" data-surface="fde-hero" aria-labelledby="fde-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <h1 id="fde-title">Frontier Decision Engine</h1>
    <p class="hero-line">Decide with clarity.</p>
    <p class="lede">Frame what matters. Compare real choices across what may change. You choose what happens next.</p>
    <div id="how-it-works" class="method-strand" data-surface="integrated-method" tabindex="-1" aria-labelledby="method-title">
      <h2 id="method-title" class="sr-only">How it works</h2>
      <div><strong>Frame</strong><span>What are you deciding?</span></div>
      <div><strong>Compare</strong><span>What matters across what may change?</span></div>
      <div><strong>Decide</strong><span>What controls the decision? What happens next?</span></div>
    </div>
    <p class="method-truth">Compare the same choices across plausible futures. Keep trade-offs and human judgment visible.</p>
  </section>`;
}

function stageSummary(index) {
  const decision = state.decision;
  if (index === 0) return decision.title || decision.question || 'State the decision';
  if (index === 1) return decision.objectives.map((item) => item.label).filter(Boolean).slice(0, 3).join(' · ') || 'Name what must be true';
  if (index === 2) return decision.strategies.map((item) => item.label).filter(Boolean).slice(0, 3).join(' · ') || 'Describe the real choices';
  if (index === 3) return decision.scenarios.map((item) => item.label).filter(Boolean).slice(0, 2).join(' · ') || 'Describe plausible futures';
  if (index === 4) {
    const synthesis = deriveDecisionSynthesis(decision);
    return synthesis.posture ? `${synthesis.posture} · ${synthesis.strongest_alternative?.label || 'Review the comparison'}` : 'Review what the comparison found';
  }
  const selected = decision.strategies.find((item) => item.strategy_id === decision.human_decision.selected_strategy_id);
  return selected?.label || 'Record the human decision';
}

const stageActionLabels = ['Continue to What matters →', 'Continue to Your choices →', 'Continue to What may change →', 'See what we learned →', 'Choose next step →'];

function frameStep() {
  const item = state.decision;
  const semantics = semanticView(item);
  return `<div class="stack">
    <div><h2 id="decision-step-heading-0" tabindex="-1">What are you deciding?</h2></div>
    <div class="primary-decision-field">${textarea('State the decision', 'decision-question', item.question, 'One clear question that a person can answer.')}</div>
    <details class="soft-panel"><summary><strong>Add context</strong><span class="help">Name, responsibility, timing, urgency, and reversibility</span></summary><div class="grid-2 decision-section-body">
      ${field('Short name', 'decision-title', item.title, 'text', 'Optional here; FDE derives one from the decision when needed.')}
      ${field('Who is responsible for deciding?', 'decision-owner', item.decision_owner, 'text', 'Use a person or role, such as Research lead.')}
      ${field('How far ahead are you thinking?', 'decision-horizon', item.time_horizon, 'text', 'Example: 90 days, one year, or five years.')}
      <label class="field">How soon is the choice needed?<select id="decision-urgency"><option value="" ${item.urgency ? '' : 'selected'}>Choose when known</option><option value="immediate" ${item.urgency === 'immediate' ? 'selected' : ''}>Immediate</option><option value="near-term" ${item.urgency === 'near-term' ? 'selected' : ''}>Near term</option><option value="planned" ${item.urgency === 'planned' ? 'selected' : ''}>Planned</option></select></label>
      <label class="field">Can the choice be changed later?<select id="decision-reversibility"><option value="" ${item.reversibility ? '' : 'selected'}>Choose when known</option><option value="reversible" ${item.reversibility === 'reversible' ? 'selected' : ''}>Reversible</option><option value="partially-reversible" ${item.reversibility === 'partially-reversible' ? 'selected' : ''}>Partially reversible</option><option value="irreversible" ${item.reversibility === 'irreversible' ? 'selected' : ''}>Irreversible</option></select></label>
    </div></details>
    <details class="soft-panel"><summary><strong>Choose a decision approach</strong><span class="help">Optional method and posture controls</span></summary><div class="stack decision-section-body"><label class="field">Decision lens<select id="decision-semantic-mode"><option value="general" ${semantics.mode === 'general' ? 'selected' : ''}>General</option><option value="sustainability-seer" ${semantics.mode === 'sustainability-seer' ? 'selected' : ''}>Consider People · Planet · Profits · Product</option></select><span class="help">The four dimensions remain independent.</span></label><label class="field"><span><input id="enable-decision-posture" type="checkbox" ${semantics.posture_enabled ? 'checked' : ''}> Use Decision posture</span><span class="help">Optional in General mode; included with the SEER-informed lens. It never changes the comparison.</span></label></div></details>
  </div>`;
}

function mapStep() {
  const item = state.decision;
  const semantics = semanticView(item);
  const dimensionPrompts = { people: 'Who could be affected, and what must remain true?', planet: 'What environmental or resource boundary matters?', profits: 'Is the pathway economically durable?', product: 'Does the product or system actually meet the requirement?', general: 'What must remain true for this decision?' };
  const fourPSummaries = new Map(summarizeFourP(item).map((entry) => [entry.dimension, entry]));
  const dimensions = semantics.mode === 'sustainability-seer' ? ['people', 'planet', 'profits', 'product'] : ['general'];
  const semanticCriteria = item.schema_version === '0.3.0' ? `<section class="stack" data-surface="decision-semantics-criteria"><div><span class="eyebrow">${semantics.mode === 'sustainability-seer' ? 'Four independent dimensions' : 'Decision posture'}</span><h3>What must remain true?</h3><p class="muted">Review one dimension at a time. Evidence and outcome stay separate; required criteria affect posture, not the comparison.</p></div><div class="dimension-overview">${dimensions.map((dimension, dimensionIndex) => { const criteria = semantics.criteria.map((criterion, index) => ({ criterion, index })).filter((entry) => entry.criterion.dimension === dimension); const stateLabel = dimension === 'general' ? (criteria.length ? 'Review criteria' : 'Not assessed') : fourPSummaries.get(dimension)?.state || 'Not assessed'; const requiredCount = criteria.filter((entry) => entry.criterion.must_be_true).length; return `<details class="panel dimension-card" ${dimensionIndex === 0 ? 'open' : ''} data-dimension="${dimension}"><summary><span><strong>${escapeHtml(dimension[0].toUpperCase() + dimension.slice(1))}</strong><span class="help">${escapeHtml(dimensionPrompts[dimension])}</span></span><span class="dimension-status"><strong>${escapeHtml(stateLabel)}</strong><span class="help">${criteria.length} ${criteria.length === 1 ? 'criterion' : 'criteria'}${requiredCount ? ` · ${requiredCount} required` : ''}</span><span class="review-label">Review</span></span></summary><div class="dimension-detail stack">${criteria.map(({ criterion, index }) => `<article class="semantic-criterion stack" data-semantic-criterion="${index}"><div class="grid-2">${field('What matters?', `semantic-label-${index}`, criterion.label)}${field('What must be true?', `semantic-requirement-${index}`, criterion.requirement)}<label class="field">What do we know?<select id="semantic-evidence-${index}">${EVIDENCE_STATES.map((value) => `<option value="${value}" ${criterion.evidence_state === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label class="field">Does it meet the requirement?<select id="semantic-outcome-${index}">${CRITERION_OUTCOMES.map((value) => `<option value="${value}" ${criterion.outcome === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>${field('What evidence would resolve this?', `semantic-evidence-need-${index}`, criterion.evidence_need || '')}<label class="field required-control"><span><input id="semantic-required-${index}" type="checkbox" ${criterion.must_be_true ? 'checked' : ''}> Required to move forward</span></label></div></article>`).join('')}</div></details>`; }).join('')}</div></section>` : '';
  const collapsedSemanticCriteria = semanticCriteria.replace(' open data-dimension=', ' data-dimension=');
  return `<div class="stack">
    <div><h2 id="decision-step-heading-1" tabindex="-1">What must be true?</h2></div>
    <details class="comparison-model"><summary><strong>Review the comparison model</strong><span class="help">Goals, uncertainties, relationships, and thresholds remain available without crowding the first view.</span></summary><div class="decision-map">
      <section class="panel stack"><div class="actions"><strong>What may change <span class="method-word">(X · uncertainties)</span></strong>${badge(`${item.uncertainties.length}`)}</div>${item.uncertainties.map((uncertainty) => `<div class="map-item"><strong>${escapeHtml(uncertainty.label)}</strong><p class="help">${escapeHtml(uncertainty.description)}</p><div class="actions">${uncertainty.states.map((entry) => badge(entry)).join('')}</div></div>`).join('')}</section>
      <section class="panel stack"><div class="actions"><strong>Choices you control <span class="method-word">(L · levers)</span></strong>${badge(`${item.strategies.length}`)}</div>${item.strategies.map((strategy) => `<div class="map-item"><strong>${escapeHtml(strategy.label)}</strong><p class="help">${escapeHtml(strategy.description)}</p></div>`).join('')}</section>
      <section class="panel stack"><div class="actions"><strong>How things may connect <span class="method-word">(R · relationships)</span></strong>${badge(`${item.relationships.length}`)}</div>${item.relationships.map((relationship) => `<div class="map-item"><strong>${escapeHtml(relationship.evidence_class)}</strong><p class="help">${escapeHtml(relationship.statement)}</p></div>`).join('')}</section>
      <section class="panel stack"><div class="actions"><strong>What success looks like <span class="method-word">(M · measures)</span></strong>${badge(`${item.objectives.length}`)}</div>${item.objectives.map((objective, index) => `<label class="field map-item">${escapeHtml(objective.label || `Goal ${index + 1}`)} good-enough line<input data-objective-threshold="${index}" type="number" min="0" max="100" step="1" value="${objective.threshold ?? ''}"><span class="help">${escapeHtml(objective.description)} ${objective.direction === 'at-most' ? 'Lower values are better.' : 'Higher values are better.'} <span class="method-word">This good-enough line is called a threshold.</span></span></label>`).join('')}</section>
    </div></details>
    ${collapsedSemanticCriteria}
    <div class="beginner-note"><strong>No secret final score</strong><span>Each goal stays visible. The tool shows trade-offs instead of hiding everything inside one number.</span></div>
  </div>`;
}

function strategiesStep() {
  const objectives = state.decision.objectives;
  const scoreField = (strategy, strategyIndex, objective, objectiveIndex) => {
    const trace = strategy.score_rationales?.[objective.objective_id];
    return `<div class="score-field"><label>${escapeHtml(objective.label || `Goal ${objectiveIndex + 1}`)}<input data-strategy-score="${strategyIndex}:${objective.objective_id}" type="number" min="0" max="100" value="${strategy.baseline[objective.objective_id] ?? ''}"></label><span class="help">Analyst-assigned normalized input, not a probability.</span>${state.decision.schema_version === '0.3.0' ? `<details class="score-rationale"><summary>Why this score?</summary><div class="stack"><label class="field">Basis<select data-score-basis="${strategyIndex}:${objective.objective_id}"><option value="analyst-judgment" ${trace?.basis !== 'declared-rubric' && trace?.basis !== 'other' ? 'selected' : ''}>Analyst judgment</option><option value="declared-rubric" ${trace?.basis === 'declared-rubric' ? 'selected' : ''}>Declared rubric</option><option value="other" ${trace?.basis === 'other' ? 'selected' : ''}>Other stated basis</option></select></label><label class="field">Rationale<textarea data-score-rationale="${strategyIndex}:${objective.objective_id}" placeholder="No rationale recorded.">${escapeHtml(trace?.rationale || '')}</textarea></label></div></details>` : ''}</div>`;
  };
  return `<div class="stack">
    <div><h2 id="decision-step-heading-2" tabindex="-1">What can you actually do?</h2></div>
    ${state.decision.strategies.map((strategy, strategyIndex) => `<article class="panel stack">
      <div class="grid-2">${field('Choice name', `strategy-label-${strategyIndex}`, strategy.label)}${textarea('What would this choice do?', `strategy-description-${strategyIndex}`, strategy.description)}</div>
      <details><summary><strong>Review comparison inputs</strong></summary><div class="score-grid decision-section-body">${objectives.map((objective, objectiveIndex) => scoreField(strategy, strategyIndex, objective, objectiveIndex)).join('')}</div></details>
      <details><summary>Plan for change <span class="method-word">(adaptive planning fields)</span></summary><div class="grid-2" style="margin-top:1rem">${textarea('What would you do now?', `strategy-action-${strategyIndex}`, strategy.action_now)}${textarea('What would you watch?', `strategy-monitor-${strategyIndex}`, strategy.monitor)}${textarea('What would make you change course?', `strategy-trigger-${strategyIndex}`, strategy.trigger)}${textarea('What is the backup plan?', `strategy-contingency-${strategyIndex}`, strategy.contingency)}</div></details>
    </article>`).join('')}
  </div>`;
}

function scenariosStep() {
  const objectives = state.decision.objectives;
  const strategies = state.decision.strategies;
  return `<div class="stack">
    <div><h2 id="decision-step-heading-3" tabindex="-1">What could change?</h2><p class="muted">Plausible futures worth testing. No probability required.</p></div>
    ${state.decision.scenarios.map((scenario, scenarioIndex) => `<article class="panel stack">
      <div class="grid-2">${field('Future name', `scenario-label-${scenarioIndex}`, scenario.label)}${textarea('What happens in this future?', `scenario-description-${scenarioIndex}`, scenario.description)}</div>
      <div class="actions">${Object.entries(scenario.states).map(([uncertaintyId, value]) => badge(`${uncertaintyId}: ${value}`)).join('')}</div>
      <details><summary><strong>Advanced: how this future changes each choice</strong></summary><div class="stack" style="margin-top:1rem">${strategies.map((strategy, strategyIndex) => `<section class="soft-panel stack"><strong>${escapeHtml(strategy.label || `Choice ${strategyIndex + 1}`)}</strong><div class="score-grid">${objectives.map((objective, objectiveIndex) => `<label class="score-field">${escapeHtml(objective.label || `Goal ${objectiveIndex + 1}`)} modifier<input data-scenario-strategy-modifier="${scenarioIndex}:${strategy.strategy_id}:${objective.objective_id}" type="number" min="-100" max="100" value="${scenario.strategy_modifiers?.[strategy.strategy_id]?.[objective.objective_id] ?? ''}"><span class="help">Change to this choice in this future. <span class="method-word">This is a response modifier.</span></span></label>`).join('')}</div></section>`).join('')}</div></details>
    </article>`).join('')}
    <div class="beginner-note"><strong>Possible does not mean likely</strong><span>The tool explores what may happen. It does not claim how likely each future is.</span></div>
  </div>`;
}

function resultsStep() {
  const readiness = validateAnalysisReady(state.decision);
  if (!readiness.valid) {
    return `<div class="stack"><div><h2 id="decision-step-heading-4" tabindex="-1">One update is needed</h2><p class="muted">FDE pauses comparison until every expected outcome is complete and usable.</p></div><div class="callout warning"><strong>Complete the case before comparison</strong><ul>${readiness.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul></div></div>`;
  }
  const summaries = summarizeStrategies(state.decision);
  const candidateResult = robustCandidateDecision(state.decision);
  const candidate = candidateResult.status === CANDIDATE_STATE.UNIQUE_LEADER ? candidateResult.candidates[0] : null;
  const objectives = new Map(state.decision.objectives.map((item) => [item.objective_id, item]));
  const selectedStrategyId = state.decision.human_decision.selected_strategy_id || candidate?.strategy_id;
  const vulnerabilities = vulnerabilityMap(state.decision, selectedStrategyId);
  const matrix = buildPerformanceMatrix(state.decision);
  const semantics = semanticView(state.decision);
  const posture = decisionPosture(state.decision);
  const synthesis = deriveDecisionSynthesis(state.decision);
  const semanticSummary = state.decision.schema_version === '0.3.0' && (semantics.mode === 'sustainability-seer' || semantics.posture_enabled) ? `<section class="panel stack signature-synthesis" data-surface="decision-posture"><span class="eyebrow">Brief · Decision signature</span><div class="signature-grid"><div><span class="help">Decision posture</span><strong class="posture-value">${escapeHtml(synthesis.posture || 'Inactive')}</strong></div><div><span class="help">Controlling issue</span><strong>${escapeHtml(synthesis.controlling_issue)}</strong></div><div><span class="help">Strongest tested alternative</span><strong>${escapeHtml(synthesis.strongest_alternative?.label || 'No unique leader')}</strong></div><div><span class="help">Recorded human decision</span><strong>${escapeHtml(synthesis.recorded_human_decision?.label || 'Not selected')}</strong></div></div>${synthesis.four_p.length ? `<div class="grid-4 four-p-summary">${synthesis.four_p.map((item) => `<div><span class="help">${escapeHtml(item.dimension[0].toUpperCase() + item.dimension.slice(1))}</span><strong>${escapeHtml(item.state)}</strong></div>`).join('')}</div>` : ''}${synthesis.changes.length ? `<div><strong>What would change this decision?</strong><ul>${synthesis.changes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}${synthesis.next_evidence ? `<p><strong>Most decision-relevant next evidence:</strong> ${escapeHtml(synthesis.next_evidence.evidence_need)}</p>` : ''}<p class="help">The posture, strongest tested alternative, and recorded human decision are separate. Decision posture is software decision support—not approval, authorization, certification, qualification, consent, or investment approval.</p></section>` : '';
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
  const scoreTraceability = state.decision.schema_version === '0.3.0' ? `<details class="soft-panel score-traceability"><summary><strong>Why these normalized inputs?</strong></summary><div class="stack">${state.decision.strategies.map((strategy) => `<section><h4>${escapeHtml(strategy.label)}</h4><ul>${state.decision.objectives.map((objective) => { const trace = strategy.score_rationales?.[objective.objective_id]; return `<li><strong>${escapeHtml(objective.label)} ${strategy.baseline[objective.objective_id]}</strong> · ${trace ? `${escapeHtml(trace.basis)} · ${escapeHtml(trace.rationale)}` : 'No rationale recorded.'}</li>`; }).join('')}</ul></section>`).join('')}</div></details>` : '';
  return `<div class="stack">
    <div><h2 id="decision-step-heading-4" tabindex="-1">What did we learn?</h2><p class="muted">The answer first. Evidence on demand.</p></div>
    ${candidateNotice}
    ${semanticSummary}
    <details class="projection soft-panel" data-projection="brief" open><summary><strong>Brief</strong><span class="help">Conclusion and control point</span></summary><div class="projection-body"><p><strong>Strongest tested alternative:</strong> ${escapeHtml(synthesis.strongest_alternative?.label || 'No unique leader')}</p><p>${synthesis.posture ? `The controlling issue determines posture. ` : ''}The comparison identifies an alternative; a person records the decision.</p></div></details>
    <details class="projection soft-panel" data-projection="review"><summary><strong>Review</strong><span class="help">Four-P status, uncertainties, and decision conditions</span></summary><div class="projection-body">${synthesis.uncertainty_summary.length ? `<h3>What remains uncertain</h3><ul>${synthesis.uncertainty_summary.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>No uncertainties were declared.</p>'}</div></details>
    <details class="projection soft-panel" data-projection="review-conditions"><summary><strong>Review conditions</strong><span class="help">Tested vulnerabilities and conditions to strengthen</span></summary><div class="projection-body"><ul>${vulnerabilities.filter((item) => item.vulnerable).map((item) => `<li><strong>${escapeHtml(item.label)}</strong> · ${item.invalids.length ? 'Outcome needs attention' : item.failures.map(failureLabel).join('; ')}</li>`).join('') || '<li>No tested vulnerabilities were identified.</li>'}</ul></div></details>
    <details class="projection soft-panel" data-projection="inspect"><summary><strong>Inspect</strong><span class="help">Normalized values, thresholds, and traceability</span></summary><div class="projection-body stack"><p><strong>Normalized comparison traceability.</strong> Basis: ${state.decision.provenance.values_are_analyst_assigned ? 'Analyst judgment' : 'Declared normalization rubric'}. Each normalized score is a declared comparison input, not an arithmetic conversion of an objective’s original unit or threshold. Source references remain attached where declared.</p>${scoreTraceability}
    <div class="grid-3">${summaries.map((summary) => `<article class="metric-card-like ${summary.strategy_id === candidate?.strategy_id ? `candidate ${summary.critical_failure_scenario_count > 0 ? 'has-critical-gaps' : ''}` : ''}"><span class="help">${!summary.analysis_valid ? 'Invalid data · not ranked' : summary.strategy_id === candidate?.strategy_id ? (summary.critical_failure_scenario_count > 0 ? 'Strongest alignment in this comparison · goals to strengthen' : 'Strongest alignment in this comparison') : 'Strategy'}</span><strong>${escapeHtml(summary.label)}</strong><div class="big-number">${summary.analysis_valid ? formatPercent(summary.overall_pass_rate) : '—'}</div><span class="help">Share of selected goals reached across tested futures</span><div class="result-line"><span>Most demanding tested future</span><strong>${summary.analysis_valid ? formatPercent(summary.worst_case_pass_rate) : '—'}</strong></div><div class="result-line"><span>Tested futures with goals to strengthen</span><strong>${summary.critical_failure_scenario_count}</strong></div><div class="result-line"><span>Outcomes needing attention</span><strong>${summary.invalid_outcome_count}</strong></div></article>`).join('')}</div>
    <details class="matrix-details soft-panel"><summary><strong>See the detailed calculation table</strong><span class="help">Detailed values remain available after the plain-language summary.</span></summary><div class="table-wrap" style="margin-top:1rem"><table><caption>How every choice performed across the tested futures and goals</caption><thead><tr><th scope="col">Strategy</th><th scope="col">Scenario</th>${state.decision.objectives.map((objective) => `<th scope="col">${escapeHtml(objective.label)}<br><span class="help">Threshold ${objective.threshold}${objective.critical ? ' · critical' : ''}</span></th>`).join('')}</tr></thead><tbody>${state.decision.strategies.flatMap((strategy) => state.decision.scenarios.map((scenario) => `<tr><th scope="row">${escapeHtml(strategy.label)}</th><td>${escapeHtml(scenario.label)}</td>${state.decision.objectives.map((objective) => { const row = matrix.find((entry) => entry.strategy_id === strategy.strategy_id && entry.scenario_id === scenario.scenario_id && entry.objective_id === objective.objective_id); return `<td><strong>${row?.value ?? '—'}</strong><br>${outcomeBadge(row, objective)}</td>`; }).join('')}</tr>`)).join('')}</tbody></table></div></details></div></details>
    <section class="panel stack"><div class="section-head"><div><span class="eyebrow">Conditions to watch and strengthen</span><h3>${escapeHtml(state.decision.strategies.find((item) => item.strategy_id === selectedStrategyId)?.label || '')}</h3></div><p>The tested conditions where the selected choice may need more support to reach a good-enough line.</p></div>${vulnerabilities.map((scenario) => `<div class="vulnerability ${scenario.vulnerable ? 'is-vulnerable' : 'is-resilient'}"><div><strong>${escapeHtml(scenario.label)}</strong><p class="help">${escapeHtml(scenario.description)}</p></div><div>${scenario.invalids.length ? badge('Outcome needs attention · comparison paused', 'assumed') : scenario.failures.length ? scenario.failures.map((failure) => badge(failureLabel(failure), failure.critical ? 'interpreted' : 'assumed')).join('') : badge('All selected goals reached', 'measured')}</div></div>`).join('')}</section>
    <div class="callout"><strong>The comparison informs. A person decides.</strong><p class="muted">FDE shows ties, information that needs attention, and goals that are not yet met. You may choose differently, but you should explain why.</p></div>
  </div>`;
}
function decisionBriefStep() {
  const decision = state.decision;
  const synthesis = deriveDecisionSynthesis(decision);
  const candidateResult = robustCandidateDecision(decision);
  const candidate = candidateResult.status === CANDIDATE_STATE.UNIQUE_LEADER ? candidateResult.candidates[0] : null;
  const machineCandidateLabel = candidateResult.status === CANDIDATE_STATE.TIED_LEADERS
    ? `Tie: ${candidateResult.candidates.map((item) => item.label).join('; ')}`
    : candidate?.label || (candidateResult.status === CANDIDATE_STATE.INSUFFICIENT_DATA ? 'More complete information needed' : 'Not available');
  const selected = decision.strategies.find((item) => item.strategy_id === decision.human_decision.selected_strategy_id);
  const validation = validateDecisionCase(decision);
  const selectedVulnerabilities = vulnerabilityMap(decision, selected?.strategy_id).filter((item) => item.vulnerable);
  const semantics = semanticView(decision);
  const posture = decisionPosture(decision);
  const visibleConditionTarget = semantics.conditions[0]?.criterion_refs?.length === 1 ? semantics.conditions[0].criterion_refs[0] : '';
  const semanticControls = decision.schema_version === '0.3.0' ? `<section class="soft-panel stack" data-surface="semantic-controls"><div><span class="eyebrow">Human-declared proceed conditions</span><h3>Decision posture controls</h3></div><label class="field"><span><input id="posture-enabled" type="checkbox" ${semantics.posture_enabled ? 'checked' : ''}> Show Decision posture</span></label><label class="field">Have proceed conditions been reviewed?<select id="proceed-conditions-state"><option value="unreviewed" ${semantics.proceed_conditions_state === 'unreviewed' ? 'selected' : ''}>Not reviewed</option><option value="declared" ${semantics.proceed_conditions_state === 'declared' ? 'selected' : ''}>Required criteria declared</option><option value="none-required" ${semantics.proceed_conditions_state === 'none-required' ? 'selected' : ''}>None required — deliberately confirmed</option></select></label><div class="grid-2">${field('Required condition or safeguard', 'semantic-condition-statement', semantics.conditions[0]?.statement || '')}<label class="field">This condition applies to<select id="semantic-condition-target"><option value="" ${visibleConditionTarget ? '' : 'selected'}>Whole decision (not remediation)</option>${semantics.criteria.map((criterion) => `<option value="${escapeHtml(criterion.criterion_id)}" ${visibleConditionTarget === criterion.criterion_id ? 'selected' : ''}>${escapeHtml(criterion.dimension[0].toUpperCase() + criterion.dimension.slice(1))}: ${escapeHtml(criterion.label || criterion.criterion_id)}</option>`).join('')}</select><span class="help">Only an explicitly targeted open condition can remediate that criterion.</span></label><label class="field">Condition state<select id="semantic-condition-state"><option value="open" ${semantics.conditions[0]?.state !== 'satisfied' ? 'selected' : ''}>Open</option><option value="satisfied" ${semantics.conditions[0]?.state === 'satisfied' ? 'selected' : ''}>Satisfied</option></select></label>${field('Monitoring obligation', 'semantic-monitoring-observable', semantics.monitoring[0]?.observable || '')}${field('Reassessment', 'semantic-reassessment', semantics.reassessment || '')}</div><p class="help">This compact view edits the first condition and monitoring record only; additional imported records remain preserved.</p><label class="field">Cautious human posture override<select id="posture-override"><option value="">No override</option>${['ADVANCE WITH CONDITIONS','REWORK','HOLD','STOP'].map((value) => `<option value="${value}" ${semantics.posture_override === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>${textarea('Why use a more cautious posture?', 'posture-override-reason', semantics.posture_override_reason || '')}<p><strong>Current Decision posture:</strong> ${escapeHtml(posture.posture || 'Inactive')}</p><p class="help">These controls do not choose a strategy. Your final decision remains below.</p></section>` : '';
  return `<div class="stack">
    <div><h2 id="decision-step-heading-5" tabindex="-1">What do you choose?</h2></div>
    <section class="decision-brief">
      <div class="brief-head"><div><span class="eyebrow">Decision question</span><h3>${escapeHtml(decision.question || 'Decision not yet framed')}</h3></div><div class="actions">${badge(decision.status)}${badge(`Profile: ${decision.profile}`)}</div></div>
      <div class="brief-grid">
        <div><span class="help">Decision owner</span><strong>${escapeHtml(decision.decision_owner)}</strong></div>
        <div><span class="help">Time horizon</span><strong>${escapeHtml(decision.time_horizon)}</strong></div>
        <div><span class="help">Leading tested choice</span><strong>${escapeHtml(machineCandidateLabel)}</strong>${candidate?.critical_failure_scenario_count ? `<span class="help">Critical gaps remain in ${candidate.critical_failure_scenario_count} included future${candidate.critical_failure_scenario_count === 1 ? '' : 's'}.</span>` : ''}</div>
        <div><span class="help">Your decision</span><strong>${escapeHtml(selected?.label || 'Not selected')}</strong></div>
        <div><span class="help">Decision posture</span><strong>${escapeHtml(synthesis.posture || 'Inactive')}</strong></div>
        <div><span class="help">Controlling issue</span><strong>${escapeHtml(synthesis.controlling_issue)}</strong></div>
      </div>
      <label class="field">Choice<select id="human-strategy"><option value="" ${selected ? '' : 'selected'}>Choose only when a person decides</option>${decision.strategies.map((strategy, index) => `<option value="${strategy.strategy_id}" ${strategy.strategy_id === selected?.strategy_id ? 'selected' : ''}>${escapeHtml(strategy.label || `Choice ${index + 1}`)}</option>`).join('')}</select></label>
      <label class="field">Why?<textarea id="human-rationale" required>${escapeHtml(decision.human_decision.rationale)}</textarea><span class="help">State the trade-off and important uncertainty.</span></label>
      <label class="field">What happens next?<textarea id="human-next-action" required>${escapeHtml(decision.human_decision.next_action)}</textarea><span class="help">Name one action, one owner, and when to check progress.</span></label>
      ${semanticControls ? `<details class="decision-section soft-panel" data-surface="advanced-governance"><summary><strong>Review conditions, safeguards, monitoring, and reassessment</strong><span class="help">Optional decision-governance controls</span></summary><div class="decision-section-body">${semanticControls}</div></details>` : ''}
      <details class="decision-section soft-panel" open><summary><strong>What we know, what we estimated, and what to strengthen</strong></summary><div class="grid-2 decision-section-body">
        <div class="stack"><h3>What is known</h3><ul>${decision.evidence_summary.known.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="stack"><h3>What is assumed</h3><ul>${decision.evidence_summary.assumed.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="stack"><h3>What remains uncertain</h3><ul>${decision.evidence_summary.unknown.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="stack"><h3>Conditions that could break the selection</h3>${selectedVulnerabilities.length ? `<ul>${selectedVulnerabilities.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${item.failures.map((failure) => escapeHtml(decision.objectives.find((objective) => objective.objective_id === failure.objective_id)?.label || failure.objective_id)).join(', ')}</li>`).join('')}</ul>` : '<p class="muted">No declared threshold failures in the included futures.</p>'}</div>
      </div></details>
      <details class="decision-section soft-panel" open><summary><strong>Plan for change <span class="method-word">(adaptive planning)</span></strong></summary><div class="grid-2 decision-section-body"><div class="stack"><h3>Act now</h3><ul>${decision.adaptive_pathway.act_now.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="stack"><h3>Monitor</h3><ul>${decision.adaptive_pathway.monitor.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="stack"><h3>Trigger</h3><ul>${decision.adaptive_pathway.triggers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="stack"><h3>Contingencies</h3><ul>${decision.adaptive_pathway.contingencies.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></div><p><strong>Reassessment:</strong> ${escapeHtml(decision.adaptive_pathway.reassessment)}</p></details>
    </section>
    <div class="self-service-panel decision-output" data-surface="decision-output"><div class="record-prompt"><strong>Record the decision.</strong><p>Validate the human choice, reason, and next action.</p></div><div class="record-prompt actions"><button id="record-decision" class="primary" type="button">Record decision →</button></div><div class="decision-complete stack" data-surface="decision-complete" hidden><h3 id="decision-recorded-heading" tabindex="-1">Decision recorded.</h3><p>Keep the record before moving on.</p><div class="actions"><button id="export-decision-html" data-action="download-readable-summary" class="primary" type="button">Download Decision Brief</button><button id="export-decision-json" data-action="download-decision-file" type="button">Save decision</button><button id="reset-decision" class="ghost" type="button">Use ready example</button></div></div></div>
    <div id="decision-validation" class="status-line" role="alert" tabindex="-1" aria-live="assertive">${validation.valid ? `Decision case passes v${escapeHtml(decision.schema_version)} structural validation.` : escapeHtml(validation.errors.join(' '))}</div>
  </div>`;
}

export const decisionStepRenderers = [frameStep, mapStep, strategiesStep, scenariosStep, resultsStep, decisionBriefStep];

function syncStep() {
  const decision = state.decision;
  if (state.step === 0) {
    const nextMode = document.querySelector('#decision-semantic-mode')?.value || 'general';
    const enablePosture = Boolean(document.querySelector('#enable-decision-posture')?.checked);
    if (nextMode === 'sustainability-seer' || enablePosture || decision.schema_version === '0.3.0') {
      activateDecisionSemantics(decision, nextMode);
      decision.decision_semantics.posture_enabled = nextMode === 'sustainability-seer' || enablePosture;
      if (nextMode === 'general' && enablePosture && decision.decision_semantics.criteria.length === 0) {
        decision.decision_semantics.criteria.push({ criterion_id: 'CRT-001', dimension: 'general', label: '', requirement: '', must_be_true: false, evidence_state: 'unknown', outcome: 'not-assessable', source_refs: [], evidence_need: '', affected_party_ids: [], missing_perspectives: [], assumptions: [], limitations: [] });
      }
    }
    decision.title = readTrimmedText(document.querySelector('#decision-title'), decision.title);
    decision.question = readTrimmedText(document.querySelector('#decision-question'), decision.question);
    decision.decision_owner = readTrimmedText(document.querySelector('#decision-owner'), decision.decision_owner);
    decision.time_horizon = readTrimmedText(document.querySelector('#decision-horizon'), decision.time_horizon);
    decision.urgency = document.querySelector('#decision-urgency')?.value ?? decision.urgency;
    decision.reversibility = document.querySelector('#decision-reversibility')?.value ?? decision.reversibility;
  }
  if (state.step === 1) {
    document.querySelectorAll('[data-objective-threshold]').forEach((input) => {
      decision.objectives[Number(input.dataset.objectiveThreshold)].threshold = readOptionalNumber(input);
    });
    if (decision.schema_version === '0.3.0') decision.decision_semantics.criteria.forEach((criterion, index) => {
      criterion.label = readTrimmedText(document.querySelector(`#semantic-label-${index}`), criterion.label);
      criterion.requirement = readTrimmedText(document.querySelector(`#semantic-requirement-${index}`), criterion.requirement);
      criterion.evidence_state = document.querySelector(`#semantic-evidence-${index}`)?.value || criterion.evidence_state;
      criterion.outcome = document.querySelector(`#semantic-outcome-${index}`)?.value || criterion.outcome;
      if (['unknown', 'invalid'].includes(criterion.evidence_state)) criterion.outcome = 'not-assessable';
      criterion.evidence_need = readTrimmedText(document.querySelector(`#semantic-evidence-need-${index}`), criterion.evidence_need);
      criterion.must_be_true = Boolean(document.querySelector(`#semantic-required-${index}`)?.checked);
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
    if (decision.schema_version === '0.3.0') document.querySelectorAll('[data-score-rationale]').forEach((input) => {
      const [strategyIndex, objectiveId] = input.dataset.scoreRationale.split(':');
      const strategy = decision.strategies[Number(strategyIndex)];
      const rationale = input.value.trim();
      const basis = document.querySelector(`[data-score-basis="${strategyIndex}:${objectiveId}"]`)?.value || 'analyst-judgment';
      strategy.score_rationales ||= {};
      if (rationale) strategy.score_rationales[objectiveId] = { basis, rationale };
      else delete strategy.score_rationales[objectiveId];
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
    if (decision.schema_version === '0.3.0') {
      const semantics = decision.decision_semantics;
      semantics.posture_enabled = Boolean(document.querySelector('#posture-enabled')?.checked);
      semantics.proceed_conditions_state = document.querySelector('#proceed-conditions-state')?.value || semantics.proceed_conditions_state;
      semantics.reassessment = readTrimmedText(document.querySelector('#semantic-reassessment'), semantics.reassessment);
      const conditionStatement = readTrimmedText(document.querySelector('#semantic-condition-statement'), semantics.conditions[0]?.statement || '');
      updateVisibleCondition(semantics, { statement: conditionStatement, state: document.querySelector('#semantic-condition-state')?.value || 'open', targetCriterionId: document.querySelector('#semantic-condition-target')?.value || '' });
      const observable = readTrimmedText(document.querySelector('#semantic-monitoring-observable'), semantics.monitoring[0]?.observable || '');
      updateVisibleMonitoring(semantics, { observable });
      const override = document.querySelector('#posture-override')?.value || null;
      const overrideReason = document.querySelector('#posture-override-reason')?.value.trim() || '';
      setCautiousOverride(semantics, override, overrideReason);
    }
    decision.human_decision.selected_strategy_id = document.querySelector('#human-strategy')?.value || decision.human_decision.selected_strategy_id;
    decision.human_decision.rationale = document.querySelector('#human-rationale')?.value.trim() || '';
    decision.human_decision.next_action = document.querySelector('#human-next-action')?.value.trim() || '';
  }
  persistDecision();
}

export function buildDecisionHtml(decision) {
  const synthesis = deriveDecisionSynthesis(decision);
  const summaries = summarizeStrategies(decision);
  const candidateResult = robustCandidateDecision(decision);
  const candidate = candidateResult.status === CANDIDATE_STATE.UNIQUE_LEADER ? candidateResult.candidates[0] : null;
  const machineCandidateLabel = candidateResult.status === CANDIDATE_STATE.TIED_LEADERS
    ? `Tie: ${candidateResult.candidates.map((item) => item.label).join('; ')}`
    : candidate?.label || (candidateResult.status === CANDIDATE_STATE.INSUFFICIENT_DATA ? 'More complete information needed' : 'Not available');
  const selected = decision.strategies.find((item) => item.strategy_id === decision.human_decision.selected_strategy_id);
  const vulnerabilities = vulnerabilityMap(decision, selected?.strategy_id).filter((item) => item.vulnerable);
  const list = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  const semantics = semanticView(decision);
  const posture = decisionPosture(decision);
  const semanticSection = decision.schema_version === '0.3.0' && (semantics.mode === 'sustainability-seer' || semantics.posture_enabled) ? `<section><h2>Decision signature</h2><p><strong>Decision posture:</strong> ${escapeHtml(synthesis.posture || 'Inactive')}</p><p><strong>Controlling issue:</strong> ${escapeHtml(synthesis.controlling_issue)}</p><p><strong>Strongest tested alternative:</strong> ${escapeHtml(synthesis.strongest_alternative?.label || 'No unique leader')}</p><p><strong>Recorded human decision:</strong> ${escapeHtml(synthesis.recorded_human_decision?.label || 'Not selected')}</p>${synthesis.four_p.length ? `<div class="grid">${synthesis.four_p.map((item) => `<div><h3>${escapeHtml(item.dimension[0].toUpperCase() + item.dimension.slice(1))}</h3><p>${escapeHtml(item.state)}</p></div>`).join('')}</div>` : ''}${synthesis.changes.length ? `<h3>What would change this decision?</h3>${list(synthesis.changes)}` : ''}${synthesis.next_evidence ? `<p><strong>Most decision-relevant next evidence:</strong> ${escapeHtml(synthesis.next_evidence.evidence_need)}</p>` : ''}<p><em>The posture, strongest tested alternative, and recorded human decision are separate. Decision posture is software decision support, not approval or authorization.</em></p></section>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(decision.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 20px;line-height:1.55;color:#172033}section{margin:28px 0;padding-top:12px;border-top:1px solid #d7dce5}table{width:100%;border-collapse:collapse}caption{text-align:left;font-weight:700;margin-bottom:8px}th,td{text-align:left;padding:8px;border-bottom:1px solid #d7dce5}.tag{display:inline-block;border:1px solid #aeb7c7;border-radius:999px;padding:3px 9px;margin:2px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}@media(max-width:650px){.grid{grid-template-columns:1fr}}@media print{body{max-width:none;margin:0;padding:0;color:#000}section{break-inside:avoid}.no-print{display:none}}</style></head><body><h1>${escapeHtml(decision.title)}</h1><p>${escapeHtml(decision.question)}</p><p><span class="tag">${escapeHtml(decision.profile)}</span><span class="tag">Human-governed</span><span class="tag">${decision.provenance.probability_model_used ? 'Probability model disclosed' : 'No probability model'}</span></p><section><h2>Decision</h2><p><strong>Leading tested choice:</strong> ${escapeHtml(machineCandidateLabel)}${candidate?.critical_failure_scenario_count ? ` <em>(critical gaps in ${candidate.critical_failure_scenario_count} included future${candidate.critical_failure_scenario_count === 1 ? '' : 's'})</em>` : ''}</p><p><strong>Your decision:</strong> ${escapeHtml(selected?.label || 'Not selected')}</p><p>${escapeHtml(decision.human_decision.rationale)}</p><p><strong>Next action:</strong> ${escapeHtml(decision.human_decision.next_action)}</p></section>${semanticSection}<section><h2>Evidence boundary</h2><div class="grid"><div><h3>Known</h3>${list(decision.evidence_summary.known)}</div><div><h3>Assumed</h3>${list(decision.evidence_summary.assumed)}</div><div><h3>Unknown</h3>${list(decision.evidence_summary.unknown)}</div><div><h3>Selected-strategy vulnerabilities</h3>${vulnerabilities.length ? `<ul>${vulnerabilities.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${item.failures.map((failure) => escapeHtml(decision.objectives.find((objective) => objective.objective_id === failure.objective_id)?.label || failure.objective_id)).join(', ')}</li>`).join('')}</ul>` : '<p>No declared threshold failures in the included futures.</p>'}</div></div></section><section><h2>Strategy comparison</h2><table><caption>Threshold performance by strategy</caption><thead><tr><th scope="col">Strategy</th><th scope="col">Overall pass</th><th scope="col">Worst scenario</th><th scope="col">Critical-failure futures</th><th scope="col">Critical misses</th></tr></thead><tbody>${summaries.map((item) => `<tr><th scope="row">${escapeHtml(item.label)}</th><td>${formatPercent(item.overall_pass_rate)}</td><td>${formatPercent(item.worst_case_pass_rate)}</td><td>${item.critical_failure_scenario_count}</td><td>${item.critical_failure_count}</td></tr>`).join('')}</tbody></table></section><section><h2>Adaptive pathway</h2><div class="grid"><div><h3>Act now</h3>${list(decision.adaptive_pathway.act_now)}</div><div><h3>Monitor</h3>${list(decision.adaptive_pathway.monitor)}</div><div><h3>Triggers</h3>${list(decision.adaptive_pathway.triggers)}</div><div><h3>Contingencies</h3>${list(decision.adaptive_pathway.contingencies)}</div></div><p><strong>Reassessment:</strong> ${escapeHtml(decision.adaptive_pathway.reassessment)}</p></section><p>Generated by Frontier Decision Engine v${APPLICATION_VERSION}. Scores are transparent analyst inputs, not probabilities.</p></body></html>`;
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

async function openDecisionFile(file, main, input) {
  if (!file) return;
  const parsed = await parseDecisionFile(file, validateCompletedDecisionCase, validateDraftDecisionCase);
  const message = main.querySelector('#decision-entry-status') || main.querySelector('#decision-validation');
  if (!parsed.ok) {
    if (message) message.textContent = parsed.errors.join(' ');
    message?.focus();
    input.value = '';
    return;
  }
  const isDraftBackup = parsed.kind === 'draft-backup';
  startDecision(
    parsed.decision,
    isDraftBackup ? 'imported-draft-backup' : 'imported-file',
    isDraftBackup ? 'Opened from an in-progress draft backup and saved in this browser.' : 'Opened from a completed decision file and saved in this browser.',
  );
  persistDecision();
  renderInto(main, { focusStep: true });
}

function renderDraftReturn(main, { openFile = false, focusMethod = false } = {}) {
  const backupAvailable = canDownloadDraftBackup(state.pendingDraft);
  main.innerHTML = `
    ${onePageIntro()}
    <section class="panel stack" data-surface="saved-draft-return" aria-labelledby="saved-draft-title">
      <span class="eyebrow">Frontier Decision Engine</span>
      <h2 id="saved-draft-title">Welcome back.</h2>
      <p>Your decision is saved in this browser.</p>
      <div class="callout warning"><strong>Browser privacy boundary</strong><p>Anyone with access to this browser profile may be able to reopen the saved decision. Browser storage is not encrypted confidential storage.</p></div>
      <div class="actions"><button id="resume-browser-draft" class="primary" type="button">Resume your decision →</button></div>
      <details class="soft-panel"><summary><strong>Other options</strong></summary><div class="actions decision-section-body"><button id="download-browser-draft" type="button" ${backupAvailable ? '' : 'disabled'}>${backupAvailable ? 'Download draft backup' : 'Draft backup unavailable'}</button><button id="start-blank-decision" type="button">Start fresh</button><button id="start-ready-example" type="button">Use ready example</button><button id="open-decision-file" type="button">Open a saved decision</button><button id="clear-browser-draft" type="button">Clear browser draft</button><input id="decision-file-input" type="file" accept="application/json,.json,.fde.json,.fde-draft.json" hidden aria-label="Open a saved decision or in-progress draft backup"></div></details>
      <div id="decision-entry-status" class="status-line" role="alert" tabindex="-1" aria-live="assertive"></div>
    </section>`;
  const replaceDraft = (decision, source, status) => {
    clearSavedDecision(browserStorage);
    startDecision(decision, source, status);
    renderInto(main, { focusStep: true });
  };
  main.querySelector('#resume-browser-draft')?.addEventListener('click', () => {
    startDecision(state.pendingDraft, 'restored-browser-draft', 'Restored from this browser.');
    renderInto(main, { focusStep: true });
  });
  main.querySelector('#download-browser-draft')?.addEventListener('click', () => {
    if (!backupAvailable) return;
    const backup = createDraftBackup(state.pendingDraft);
    downloadText(safeFilename(state.pendingDraft.title || 'frontier-decision', 'fde-draft.json'), `${JSON.stringify(backup, null, 2)}\n`, 'application/json');
  });
  main.querySelector('#clear-browser-draft')?.addEventListener('click', () => {
    clearSavedDecision(browserStorage);
    startDecision(createDecisionCase(), 'ready-example', 'Browser draft cleared. Ready example loaded.');
    renderInto(main, { focusStep: true });
  });
  main.querySelector('#start-blank-decision')?.addEventListener('click', () => replaceDraft(createBlankDecisionCase(), 'blank', 'Fresh blank decision started.'));
  main.querySelector('#start-ready-example')?.addEventListener('click', () => replaceDraft(createDecisionCase(), 'ready-example', 'Ready example loaded.'));
  main.querySelector('#open-decision-file')?.addEventListener('click', () => main.querySelector('#decision-file-input')?.click());
  main.querySelector('#decision-file-input')?.addEventListener('change', (event) => openDecisionFile(event.target.files?.[0], main, event.target));
  if (openFile) requestAnimationFrame(() => main.querySelector('#open-decision-file')?.click());
  if (focusMethod) requestAnimationFrame(() => {
    main.querySelector('#how-it-works')?.focus({ preventScroll: true });
    main.querySelector('#how-it-works')?.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
}

function renderDecisionEntry(main, { openFile = false } = {}) {
  main.innerHTML = `
    <div class="breadcrumbs"><a href="#/">Home</a><span aria-hidden="true">/</span><span>Decision Lab</span></div>
    <section class="engine-launch decision-direct-entry" data-surface="decision-entry-front-door" aria-labelledby="decision-entry-title">
      <div class="engine-intro stack">
        <span class="eyebrow">Working Decision Lab</span>
        <h1 id="decision-entry-title"><span class="gradient-text">Frontier Decision Engine</span></h1>
        <p class="lede">What are you deciding?</p>
      </div>
      <aside class="launch-panel panel stack" aria-label="Begin a decision">
        <a class="button primary launch-primary" id="start-blank-decision" href="#/decision/new">Start a decision</a>
        <a class="button" id="start-ready-example" href="#/decision/example">Try the ready example</a>
        <button id="open-decision-file" data-action="open-saved-decision" type="button">Open an FDE file</button>
        <input id="decision-file-input" type="file" accept="application/json,.json,.fde.json,.fde-draft.json" hidden aria-label="Open a completed decision file or in-progress draft backup">
        <a class="quiet-link" href="./start.html">See how it works →</a>
        <div class="launch-privacy">No account. No default upload. Changes save in this browser.</div>
        <div id="decision-entry-status" class="status-line" role="alert" tabindex="-1" aria-live="assertive"></div>
      </aside>
    </section>`;
  main.querySelector('#open-decision-file')?.addEventListener('click', () => main.querySelector('#decision-file-input')?.click());
  main.querySelector('#decision-file-input')?.addEventListener('change', (event) => openDecisionFile(event.target.files?.[0], main, event.target));
  if (openFile) requestAnimationFrame(() => main.querySelector('#open-decision-file')?.click());
}

function validateStage(index, root) {
  syncStep();
  if (index === 0 && !state.decision.question.trim()) {
    const message = root.querySelector('[data-stage-validation="0"]');
    if (message) message.textContent = 'State the decision before continuing.';
    root.querySelector('#decision-question')?.focus();
    return false;
  }
  if (index === 0 && !state.decision.title.trim()) {
    state.decision.title = state.decision.question.trim().replace(/[?.!]$/, '').slice(0, 80);
  }
  persistDecision();
  return true;
}

function bindEvents(root) {
  root.querySelector('#toggle-method-words')?.addEventListener('click', (event) => {
    const visible = document.documentElement.classList.toggle('show-method-words');
    event.currentTarget.setAttribute('aria-pressed', String(visible));
    event.currentTarget.textContent = visible ? 'Hide method words' : 'Show method words';
  });
  root.querySelector('#use-ready-example')?.addEventListener('click', () => {
    if (!window.confirm('Open the ready example? This replaces the decision currently open in this browser.')) return;
    clearSavedDecision(browserStorage);
    startDecision(createDecisionCase(), 'ready-example', 'Fresh ready example loaded.');
    renderInto(root.closest('main') || root, { focusStep: true });
  });
  root.querySelector('#toggle-all-stages')?.addEventListener('click', () => {
    syncStep();
    state.expandAll = !state.expandAll;
    renderInto(root.closest('main') || root);
  });
  root.querySelectorAll('[data-decision-stage]').forEach((details) => details.addEventListener('toggle', () => {
    if (!details.open || state.expandAll) return;
    syncStep();
    state.step = Number(details.dataset.decisionStage);
    root.querySelectorAll('[data-decision-stage]').forEach((other) => {
      if (other !== details) other.removeAttribute('open');
      other.toggleAttribute('data-active', other === details);
    });
    requestAnimationFrame(() => details.querySelector('h2')?.focus({ preventScroll: true }));
  }));
  root.querySelectorAll('[data-stage-next]').forEach((button) => button.addEventListener('click', () => {
    const current = Number(button.dataset.stageNext);
    state.step = current;
    if (!validateStage(current, root)) return;
    state.maxReached = Math.max(state.maxReached, current + 1);
    state.step = Math.min(steps.length - 1, current + 1);
    state.expandAll = false;
    renderInto(root.closest('main') || root, { focusStep: true });
  }));
  root.querySelectorAll('[data-stage-back]').forEach((button) => button.addEventListener('click', () => {
    syncStep();
    state.step = Math.max(0, Number(button.dataset.stageBack) - 1);
    state.expandAll = false;
    renderInto(root.closest('main') || root, { focusStep: true });
  }));
  root.querySelector('#human-strategy')?.addEventListener('change', (event) => {
    state.decision.human_decision.selected_strategy_id = event.target.value;
  });
  root.querySelector('#record-decision')?.addEventListener('click', () => {
    syncStep();
    state.decision.provenance.generated_at = new Date().toISOString();
    const result = validateCompletedDecisionCase(state.decision);
    const message = root.querySelector('#decision-validation');
    if (!result.valid) {
      if (message) message.textContent = result.errors.join(' ');
      focusValidationFailure(root, result);
      return;
    }
    root.querySelector('[data-surface="decision-output"]')?.setAttribute('data-recorded', 'true');
    root.querySelector('[data-surface="decision-complete"]')?.removeAttribute('hidden');
    root.querySelector('#decision-recorded-heading')?.focus();
  });
  root.querySelector('#export-decision-json')?.addEventListener('click', () => {
    syncStep();
    state.decision.provenance.generated_at = new Date().toISOString();
    const result = validateCompletedDecisionCase(state.decision);
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
    const result = validateCompletedDecisionCase(state.decision);
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
    await openDecisionFile(event.target.files?.[0], root.closest('main') || root, event.target);
  });
  root.addEventListener('input', (event) => {
    const stage = event.target.closest('[data-decision-stage]');
    if (stage) state.step = Number(stage.dataset.decisionStage);
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
    startDecision(createDecisionCase(), 'ready-example', 'Ready example restored.');
    renderInto(root.closest('main') || root, { focusStep: true });
  });
}

function renderInto(main, { focusStep = false, focusMethod = false } = {}) {
  const sourceLabel = state.source === 'ready-example' ? 'Synthetic example' : state.source.includes('imported') ? 'Saved decision opened' : 'Saved in this browser';
  const stages = steps.map((label, index) => {
    const open = state.expandAll || index === state.step;
    const complete = index < state.maxReached;
    const actions = index < steps.length - 1 ? `<div class="stage-actions"><button data-stage-back="${index}" type="button" ${index === 0 ? 'disabled' : ''}>Back</button><span class="status-line" data-stage-validation="${index}" role="alert"></span><button data-stage-next="${index}" class="primary" type="button">${stageActionLabels[index]}</button></div>` : `<div class="stage-actions"><button data-stage-back="${index}" type="button">Back</button></div>`;
    return `<details class="fde-stage" data-decision-stage="${index}" ${open ? 'open' : ''} ${index === state.step ? 'data-active' : ''}>
      <summary aria-controls="decision-stage-${index}"><span class="stage-number">${complete ? '✓' : index + 1}</span><span class="stage-name">${escapeHtml(label)}</span><span class="stage-summary">${escapeHtml(stageSummary(index))}</span></summary>
      <div id="decision-stage-${index}" class="stage-body">${decisionStepRenderers[index]()}${actions}</div>
    </details>`;
  }).join('');
  main.innerHTML = `${onePageIntro()}
    <section id="decision-work" class="decision-work" data-surface="working-interface" aria-labelledby="decision-work-title">
      <div class="work-heading"><div><span class="eyebrow">Your decision</span><h2 id="decision-work-title">Make the decision.</h2></div><span id="decision-save-status" class="save-status" aria-live="polite">${escapeHtml(sourceLabel)}</span></div>
      <details class="begin-options" data-surface="decision-entry"><summary>Other ways to begin</summary><div class="actions">
        <button id="use-ready-example" type="button">Try an example</button>
        <button id="open-decision-file" data-action="open-saved-decision" type="button">Open a saved decision</button>
        <input id="decision-file-input" type="file" accept="application/json,.json,.fde.json,.fde-draft.json" hidden aria-label="Open a saved decision or in-progress draft backup">
        <button id="toggle-method-words" type="button" aria-pressed="false">Technical terms</button>
      </div></details>
      <div class="stage-toolbar"><button id="toggle-all-stages" class="quiet-control" type="button">${state.expandAll ? 'Collapse all' : 'Expand all'}</button></div>
      <div class="fde-stages">${stages}</div>
    </section>`;
  if (state.step === 5 && !state.expandAll) main.querySelectorAll('.decision-section[open]').forEach((details) => details.removeAttribute('open'));
  bindEvents(main);
  if (focusStep) requestAnimationFrame(() => {
    const heading = main.querySelector(`#decision-step-heading-${state.step}`);
    if (!heading) return;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
  if (focusMethod) requestAnimationFrame(() => {
    const method = main.querySelector('#how-it-works');
    method?.focus({ preventScroll: true });
    method?.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
}

export function renderDecisionLab(main, { openFile = false, entryMode = null, focusMethod = false } = {}) {
  if (state.pendingDraft && !state.entryResolved) {
    renderDraftReturn(main, { openFile, focusMethod });
    return;
  }
  if (entryMode === 'blank') {
    clearSavedDecision(browserStorage);
    startDecision(createBlankDecisionCase(), 'blank', 'Fresh blank decision started.');
  }
  if (entryMode === 'ready-example') {
    clearSavedDecision(browserStorage);
    startDecision(createDecisionCase(), 'ready-example', 'Fresh ready example loaded.');
  }
  renderInto(main, { focusMethod });
  if (openFile) requestAnimationFrame(() => main.querySelector('#open-decision-file')?.click());
}
