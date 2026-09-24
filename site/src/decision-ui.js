import {
  buildPerformanceMatrix,
  createBlankDecisionCase,
  createDecisionCase,
  CANDIDATE_STATE,
  OUTCOME_STATE,
  robustCandidate,
  robustCandidateDecision,
  summarizeStrategies,
  setScenarioNoModeledChange,
  validateAnalysisReady,
  validateCompletedDecisionCase,
  validateDecisionCase,
  validateDraftDecisionCase,
  validateStageRequirements,
  requirementIssues,
  REQUIREMENT_CLASS,
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
  summarizeSeerProfile,
  updateVisibleCondition,
  updateVisibleMonitoring,
} from './lib/semantics.js';
import { SEER_DIMENSIONS, SEER_DIMENSION_PROMPTS, SEER_PROFILE_ID, isSeerProfile } from './lib/profiles/seer.js';
import { deriveDecisionSynthesis } from './lib/synthesis.js';
import { buildDecisionBriefText } from './lib/decision-brief.js';
import { boundaryForInput } from './lib/input-boundaries.js';
import { AUTHORITY_LABELS, AUTHORITY_ROLES, authorityPermissions, authorityValidation, createAuthority } from './lib/authority.js';
import { decisionEvidenceReadiness, evidenceDisposition, EVIDENCE_READINESS } from './lib/evidence-readiness.js';
import { HUMAN_ATTESTATION_STATEMENT, createDecisionRecord, decisionContentSha256, decisionFingerprint, recordFromPortableDecision, recordMatchesDecision, validDecisionRecord } from './lib/recording.js';

const steps = ['Decision', 'What matters', 'Choices', 'What may change', 'What the comparison shows', 'Choose next step'];

const browserStorage = getBrowserStorage(globalThis);
const restored = loadSavedDecision(browserStorage, validateDraftDecisionCase);
const state = {
  step: 0,
  decision: createBlankDecisionCase(),
  source: 'blank',
  pendingDraft: restored.decision,
  pendingRecord: restored.record,
  pendingAuthority: restored.authority,
  authority: createAuthority(restored.authority || { owner: restored.decision?.decision_owner || '' }),
  record: null,
  entryResolved: !restored.decision,
  maxReached: 0,
  expandAll: false,
  saveStatus: restored.decision ? 'A browser draft is available.' : restored.status,
  validationIssues: [],
};

function startDecision(decision, source, status, record = null, authority = null) {
  state.decision = decision;
  state.source = source;
  state.pendingDraft = null;
  state.pendingRecord = null;
  state.pendingAuthority = null;
  state.authority = createAuthority(authority || record?.authority || { owner: decision.decision_owner || '' });
  state.record = validDecisionRecord(record) && record.decision_id === decision.decision_id ? record : null;
  state.entryResolved = true;
  state.saveStatus = status;
  state.step = 0;
  state.maxReached = 0;
  state.expandAll = false;
  state.validationIssues = [];
}
function persistDecision() {
  const result = saveDecision(browserStorage, state.decision, state.record, state.authority);
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

function field(label, id, value, type = 'text', help = '', requirement = '') {
  const required = [REQUIREMENT_CLASS.CONTINUE, REQUIREMENT_CLASS.COMPARE, REQUIREMENT_CLASS.RECORD].includes(requirement);
  const helpId = help || requirement ? `${id}-help` : '';
  return `<label class="field" for="${id}">${escapeHtml(label)}${requirement ? `<span class="requirement">* ${escapeHtml(requirement)}</span>` : ''}<input id="${id}" type="${type}" value="${escapeHtml(value)}" ${required ? 'required' : ''} ${helpId ? `aria-describedby="${helpId}"` : ''}>${helpId ? `<span id="${helpId}" class="help">${escapeHtml(help)}</span>` : ''}</label>`;
}

function textarea(label, id, value, help = '', requirement = '') {
  const required = [REQUIREMENT_CLASS.CONTINUE, REQUIREMENT_CLASS.COMPARE, REQUIREMENT_CLASS.RECORD].includes(requirement);
  const helpId = help || requirement ? `${id}-help` : '';
  return `<label class="field" for="${id}">${escapeHtml(label)}${requirement ? `<span class="requirement">* ${escapeHtml(requirement)}</span>` : ''}<textarea id="${id}" ${required ? 'required' : ''} ${helpId ? `aria-describedby="${helpId}"` : ''}>${escapeHtml(value)}</textarea>${helpId ? `<span id="${helpId}" class="help">${escapeHtml(help)}</span>` : ''}</label>`;
}

function recordingLifecycle() {
  const hasValidRecord = validDecisionRecord(state.record);
  if (hasValidRecord && recordMatchesDecision(state.decision, state.record)) return { key: 'recorded', label: 'Human decision recorded', action: 'Recorded' };
  if (hasValidRecord) return { key: 'changed', label: 'Changed since recording', action: 'Review and Record Again' };
  const permissions = authorityPermissions(state.authority);
  if (state.authority.role === 'ownership_unknown') return { key: 'ownership-needed', label: 'Decision owner needed', action: 'Confirm decision owner' };
  if (!permissions.mayRecordDecision && validateAnalysisReady(state.decision).valid) return { key: 'owner-review', label: 'Ready for owner review', action: 'Prepare owner brief' };
  if (requirementIssues(state.decision, 'record').length === 0 && validateAnalysisReady(state.decision).valid) return { key: 'ready-record', label: 'Ready to Record', action: 'Record human decision' };
  if (validateAnalysisReady(state.decision).valid) return { key: 'ready-compare', label: 'Ready to Compare', action: 'Complete the human decision' };
  return { key: 'draft', label: 'Draft', action: 'Continue decision' };
}

function comparisonReadinessGroups(decision) {
  const labels = ['Decision', 'What matters', 'Choices', 'What may change'];
  const grouped = new Map();

  for (const issue of requirementIssues(decision, 'compare')) {
    if (!grouped.has(issue.stage)) grouped.set(issue.stage, []);
    grouped.get(issue.stage).push(issue);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([stage, issues]) => ({
      label: labels[stage] || 'Decision',
      first: issues[0].message,
      count: issues.length,
    }));
}

function stageComplete(index) {
  if (index === 4) return validateAnalysisReady(state.decision).valid;
  if (index === 5) return Boolean(state.record && recordMatchesDecision(state.decision, state.record));
  return validateStageRequirements(state.decision, index, { forRecord: index === 0 }).valid;
}

function onePageIntro() {
  return `<section class="fde-hero" data-surface="fde-hero" aria-labelledby="fde-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <h1 id="fde-title">Frontier Decision Engine</h1>
    <p class="hero-line">Decide with clarity.</p>
    <p class="lede">Frame what matters. Test real choices against what may change. Decide what happens next.</p>
    <div id="how-it-works" class="method-strand" data-surface="integrated-method" tabindex="-1" aria-labelledby="method-title">
      <h2 id="method-title" class="sr-only">How it works</h2>
      <div><strong>Frame</strong><span>What decision needs to be made?</span></div>
      <div><strong>Compare</strong><span>What matters across what may change?</span></div>
      <div><strong>Decide</strong><span>What controls the decision? What happens next?</span></div>
    </div>
    <p class="method-truth">Compare the same choices across plausible futures. Keep trade-offs and human judgment visible.</p>
  </section>`;
}

function stageSummary(index) {
  const decision = state.decision;
  if (index === 0) return decision.title || decision.question || '';
  if (index === 1) return decision.objectives.map((item) => item.label).filter(Boolean).slice(0, 3).join(' · ');
  if (index === 2) return decision.strategies.map((item) => item.label).filter(Boolean).slice(0, 3).join(' · ');
  if (index === 3) return decision.scenarios.map((item) => item.label).filter(Boolean).slice(0, 2).join(' · ');
  if (index === 4) {
    if (state.maxReached < 4 && state.source !== 'ready-example' && !state.source.includes('imported')) return '';
    const synthesis = deriveDecisionSynthesis(decision, state.record);
    return synthesis.posture ? `${synthesis.posture} · ${synthesis.strongest_alternative?.label || 'More evidence needed'}` : '';
  }
  const selected = decision.strategies.find((item) => item.strategy_id === decision.human_decision.selected_strategy_id);
  return selected?.label || '';
}

const stageActionLabels = ['Continue to What matters →', 'Continue to Your choices →', 'Continue to What may change →', 'See what we learned →', 'Choose next step →'];

function frameStep() {
  const item = state.decision;
  const semantics = semanticView(item);
  return `<div class="stack">
    <div><h2 id="decision-step-heading-0" tabindex="-1">What decision needs to be made?</h2></div>
    <div class="primary-decision-field">${textarea('State the decision', 'decision-question', item.question, 'One clear question that a person can answer.', REQUIREMENT_CLASS.CONTINUE)}</div>
    <details class="soft-panel"><summary><strong>Add context</strong><span class="help">Name, responsibility, timing, urgency, and reversibility</span></summary><div class="grid-2 decision-section-body">
      ${field('Short name', 'decision-title', item.title, 'text', 'Optional here; FDE derives one from the decision when needed.')}
      ${field('Who is responsible for deciding?', 'decision-owner', item.decision_owner, 'text', 'Use a person or role, such as Research lead.', REQUIREMENT_CLASS.RECORD)}
      <label class="field" for="decision-authority-role">My role in this decision<span class="requirement">* ${REQUIREMENT_CLASS.COMPARE}</span><select id="decision-authority-role" required aria-describedby="decision-authority-role-help"><option value="accountable_owner" ${state.authority.role === 'accountable_owner' ? 'selected' : ''}>I am the accountable decision-maker</option><option value="delegated_decider" ${state.authority.role === 'delegated_decider' ? 'selected' : ''}>I have delegated authority to decide</option><option value="advisor" ${state.authority.role === 'advisor' ? 'selected' : ''}>I am supporting or recommending to the decision-maker</option><option value="ownership_unknown" ${state.authority.role === 'ownership_unknown' ? 'selected' : ''}>I am not sure who owns this decision</option></select><span id="decision-authority-role-help" class="help">Analysis does not imply decision authority. Advisors can prepare a brief; only accountable or delegated decision-makers can record the human decision.</span></label>
      ${field('Authority basis', 'decision-authority-basis', state.authority.basis, 'text', state.authority.role === 'delegated_decider' ? 'Required for delegated authority.' : 'Optional context, such as role charter or delegated authority.')}
      ${field('How far ahead are you thinking?', 'decision-horizon', item.time_horizon, 'text', 'Example: 90 days, one year, or five years.')}
      <label class="field">How soon is the choice needed?<select id="decision-urgency"><option value="" ${item.urgency ? '' : 'selected'}>Choose when known</option><option value="immediate" ${item.urgency === 'immediate' ? 'selected' : ''}>Immediate</option><option value="near-term" ${item.urgency === 'near-term' ? 'selected' : ''}>Near term</option><option value="planned" ${item.urgency === 'planned' ? 'selected' : ''}>Planned</option></select></label>
      <label class="field">Can the choice be changed later?<select id="decision-reversibility"><option value="" ${item.reversibility ? '' : 'selected'}>Choose when known</option><option value="reversible" ${item.reversibility === 'reversible' ? 'selected' : ''}>Reversible</option><option value="partially-reversible" ${item.reversibility === 'partially-reversible' ? 'selected' : ''}>Partially reversible</option><option value="irreversible" ${item.reversibility === 'irreversible' ? 'selected' : ''}>Irreversible</option></select></label>
    </div></details>
    <details class="soft-panel"><summary><strong>Optional considerations</strong><span class="help">Extra reminders when they are useful</span></summary><div class="stack decision-section-body"><label class="field"><span><input id="enable-seer-reminder" type="checkbox" ${isSeerProfile(semantics.mode) ? 'checked' : ''}> Consider sustainability with SEER</span><span class="help">Optional reminder across People, Planet, Profits, and Product. Use it when relevant; the dimensions remain independent and never override the comparison or human decision authority.</span></label><label class="field"><span><input id="enable-decision-posture" type="checkbox" ${semantics.posture_enabled ? 'checked' : ''}> Show assurance posture</span><span class="help">Optional view of required criteria, evidence, conditions, and unresolved issues. It is automatically included when the SEER reminder is on and never changes the comparison.</span></label></div></details>
  </div>`;
}

function mapStep() {
  const item = state.decision;
  const semantics = semanticView(item);
  const dimensionPrompts = { ...SEER_DIMENSION_PROMPTS, general: 'What must remain true for this decision?' };
  const profileSummaries = new Map(summarizeSeerProfile(item).map((entry) => [entry.dimension, entry]));
  const dimensions = isSeerProfile(semantics.mode) ? SEER_DIMENSIONS : ['general'];
  const semanticCriteria = item.schema_version === '0.3.0' ? `<section class="stack" data-surface="decision-semantics-criteria"><div><span class="eyebrow">${isSeerProfile(semantics.mode) ? 'Sustainability reminder · SEER' : 'Assurance posture'}</span><h3>What must remain true?</h3><p class="muted">Review one dimension at a time. Evidence and outcome stay separate; required criteria affect posture, not the comparison.</p></div><div class="dimension-overview">${dimensions.map((dimension, dimensionIndex) => { const criteria = semantics.criteria.map((criterion, index) => ({ criterion, index })).filter((entry) => entry.criterion.dimension === dimension); const stateLabel = dimension === 'general' ? (criteria.length ? 'Review criteria' : 'Not assessed') : profileSummaries.get(dimension)?.state || 'Not assessed'; const requiredCount = criteria.filter((entry) => entry.criterion.must_be_true).length; return `<details class="panel dimension-card" ${dimensionIndex === 0 ? 'open' : ''} data-dimension="${dimension}"><summary><span><strong>${escapeHtml(dimension[0].toUpperCase() + dimension.slice(1))}</strong><span class="help">${escapeHtml(dimensionPrompts[dimension])}</span></span><span class="dimension-status"><strong>${escapeHtml(stateLabel)}</strong><span class="help">${criteria.length} ${criteria.length === 1 ? 'criterion' : 'criteria'}${requiredCount ? ` · ${requiredCount} required` : ''}</span><span class="review-label">Review</span></span></summary><div class="dimension-detail stack">${criteria.map(({ criterion, index }) => `<article class="semantic-criterion stack" data-semantic-criterion="${index}"><div class="grid-2">${field('What matters?', `semantic-label-${index}`, criterion.label)}${field('What must be true?', `semantic-requirement-${index}`, criterion.requirement)}<label class="field">What do we know?<select id="semantic-evidence-${index}">${EVIDENCE_STATES.map((value) => `<option value="${value}" ${criterion.evidence_state === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label class="field">Does it meet the requirement?<select id="semantic-outcome-${index}">${CRITERION_OUTCOMES.map((value) => `<option value="${value}" ${criterion.outcome === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>${field('What evidence would resolve this?', `semantic-evidence-need-${index}`, criterion.evidence_need || '')}<label class="field required-control"><span><input id="semantic-required-${index}" type="checkbox" ${criterion.must_be_true ? 'checked' : ''}> Required to move forward</span></label></div></article>`).join('')}</div></details>`; }).join('')}</div></section>` : '';
  const collapsedSemanticCriteria = semanticCriteria
    ? `<details class="comparison-model semantic-model" data-surface="semantic-model"><summary><strong>Review decision conditions</strong><span class="help">Evidence, outcomes, and required conditions</span></summary><div class="decision-section-body">${semanticCriteria.replace(' open data-dimension=', ' data-dimension=')}</div></details>`
    : '';
  return `<div class="stack">
    <div><h2 id="decision-step-heading-1" tabindex="-1">What needs to be true?</h2></div>
    <details class="comparison-model"><summary><strong>Review the comparison model</strong><span class="help">Goals, uncertainties, relationships, and thresholds remain available without crowding the first view.</span></summary><div class="decision-map">
      <section class="panel stack"><div class="actions"><strong>What may change <span class="method-word">(X · uncertainties)</span></strong>${badge(`${item.uncertainties.length}`)}</div>${item.uncertainties.map((uncertainty, index) => `<div class="map-item"><strong>${escapeHtml(uncertainty.label || `Future driver ${index + 1}`)}</strong><p class="help">${escapeHtml(uncertainty.description || 'System-configured bounded future states.')}</p></div>`).join('')}</section>
      <section class="panel stack"><div class="actions"><strong>Choices you control <span class="method-word">(L · levers)</span></strong>${badge(`${item.strategies.length}`)}</div>${item.strategies.map((strategy) => `<div class="map-item"><strong>${escapeHtml(strategy.label)}</strong><p class="help">${escapeHtml(strategy.description)}</p></div>`).join('')}</section>
      <section class="panel stack"><div class="actions"><strong>How things may connect <span class="method-word">(R · relationships)</span></strong>${badge(`${item.relationships.length}`)}</div>${item.relationships.map((relationship) => relationship.statement ? `<div class="map-item"><p class="help">${escapeHtml(relationship.statement)}</p></div>` : '').join('') || '<p class="help">Optional relationships can be added through a compatible imported decision.</p>'}</section>
      <section class="panel stack"><div class="actions"><strong>What success looks like <span class="method-word">(M · measures)</span></strong>${badge(`${item.objectives.length}`)}</div><p class="help">Use the normalized 0–100 decision-model scale. These values are not probabilities or native scientific or commercial measurements.</p>${item.objectives.map((objective, index) => `<div class="map-item grid-2">${field(`Goal ${index + 1} name`, `objective-label-${index}`, objective.label, 'text', 'Use a meaningful outcome name.', REQUIREMENT_CLASS.COMPARE)}<label class="field" for="objective-threshold-${index}">Good-enough line<span class="requirement">* ${REQUIREMENT_CLASS.COMPARE}</span><input id="objective-threshold-${index}" data-objective-threshold="${index}" type="number" min="0" max="100" step="1" value="${objective.threshold ?? ''}" required aria-describedby="objective-threshold-${index}-help"><span id="objective-threshold-${index}-help" class="help">0–100 normalized scale. ${objective.direction === 'at-most' ? 'Lower values are better.' : 'Higher values are better.'}</span></label><label class="field">Direction<select data-objective-direction="${index}"><option value="at-least" ${objective.direction === 'at-least' ? 'selected' : ''}>Meet or exceed</option><option value="at-most" ${objective.direction === 'at-most' ? 'selected' : ''}>Stay at or below</option></select><span class="help">Defaulted to meet or exceed.</span></label>${textarea('Helpful detail', `objective-description-${index}`, objective.description, 'Optional.')}</div>`).join('')}</section>
    </div></details>
    ${collapsedSemanticCriteria}
    <div class="beginner-note"><strong>No secret final score</strong><span>Each goal stays visible. The tool shows trade-offs instead of hiding everything inside one number.</span></div>
  </div>`;
}

function strategiesStep() {
  const objectives = state.decision.objectives;
  const scoreField = (strategy, strategyIndex, objective, objectiveIndex) => {
    const trace = strategy.score_rationales?.[objective.objective_id];
    return `<div class="score-field"><label for="strategy-score-${strategyIndex}-${objectiveIndex}">${escapeHtml(objective.label || `Goal ${objectiveIndex + 1}`)}<span class="requirement">* ${REQUIREMENT_CLASS.COMPARE}</span><input id="strategy-score-${strategyIndex}-${objectiveIndex}" data-strategy-score="${strategyIndex}:${objective.objective_id}" type="number" min="0" max="100" value="${strategy.baseline[objective.objective_id] ?? ''}" required aria-describedby="strategy-score-${strategyIndex}-${objectiveIndex}-help"></label><span id="strategy-score-${strategyIndex}-${objectiveIndex}-help" class="help">Normalized 0–100 decision-model value; not a probability or native measurement.</span>${state.decision.schema_version === '0.3.0' ? `<details class="score-rationale"><summary>Why this score?</summary><div class="stack"><label class="field">Basis<select data-score-basis="${strategyIndex}:${objective.objective_id}"><option value="analyst-judgment" ${trace?.basis !== 'declared-rubric' && trace?.basis !== 'other' ? 'selected' : ''}>Analyst judgment</option><option value="declared-rubric" ${trace?.basis === 'declared-rubric' ? 'selected' : ''}>Declared rubric</option><option value="other" ${trace?.basis === 'other' ? 'selected' : ''}>Other stated basis</option></select></label><label class="field">Rationale<textarea data-score-rationale="${strategyIndex}:${objective.objective_id}" placeholder="No rationale recorded.">${escapeHtml(trace?.rationale || '')}</textarea></label></div></details>` : ''}</div>`;
  };
  return `<div class="stack">
    <div><h2 id="decision-step-heading-2" tabindex="-1">What choices are available?</h2></div>
    ${state.decision.strategies.map((strategy, strategyIndex) => `<article class="panel stack">
      <div class="grid-2">${field('Choice name', `strategy-label-${strategyIndex}`, strategy.label, 'text', 'Use a distinct, meaningful name.', REQUIREMENT_CLASS.COMPARE)}${textarea('What would this choice do?', `strategy-description-${strategyIndex}`, strategy.description, 'Optional context.')}</div>
      <details><summary><strong>Review comparison inputs</strong></summary><div class="score-grid decision-section-body">${objectives.map((objective, objectiveIndex) => scoreField(strategy, strategyIndex, objective, objectiveIndex)).join('')}</div></details>
      <details><summary>Plan for change <span class="method-word">(adaptive planning fields)</span></summary><div class="grid-2" style="margin-top:1rem">${textarea('What would you do now?', `strategy-action-${strategyIndex}`, strategy.action_now)}${textarea('What would you watch?', `strategy-monitor-${strategyIndex}`, strategy.monitor)}${textarea('What would make you change course?', `strategy-trigger-${strategyIndex}`, strategy.trigger)}${textarea('What is the backup plan?', `strategy-contingency-${strategyIndex}`, strategy.contingency)}</div></details>
    </article>`).join('')}
  </div>`;
}

function scenariosStep() {
  const objectives = state.decision.objectives;
  const strategies = state.decision.strategies;
  return `<div class="stack">
    <div><h2 id="decision-step-heading-3" tabindex="-1">What could change?</h2><p class="muted">Possible futures to test. No probability required.</p></div>
    ${state.decision.scenarios.map((scenario, scenarioIndex) => { const modifiers = strategies.flatMap((strategy) => objectives.map((objective) => scenario.strategy_modifiers?.[strategy.strategy_id]?.[objective.objective_id])); const noChange = modifiers.length > 0 && modifiers.every((value) => value === 0); return `<article class="panel stack">
      <div class="grid-2">${field('Future name', `scenario-label-${scenarioIndex}`, scenario.label, 'text', 'Use a meaningful condition name.', REQUIREMENT_CLASS.COMPARE)}${textarea('What changes in this future?', `scenario-description-${scenarioIndex}`, scenario.description, 'Optional plain-language context.')}</div>
      <label class="no-change-control"><input data-scenario-no-change="${scenarioIndex}" type="checkbox" ${noChange ? 'checked' : ''}> <strong>No Modeled Change</strong><span class="help">Explicitly record zero change for every choice and goal in this future. Blank remains Not Assessed.</span></label>
      <details><summary><strong>Advanced / Inspect: changes by choice and goal</strong></summary><div class="stack" style="margin-top:1rem"><p class="help">Enter how much this future raises or lowers each choice's normalized value (−100 to +100). Zero means explicitly no modeled change; blank means Not Assessed.</p>${strategies.map((strategy, strategyIndex) => `<section class="soft-panel stack"><strong>${escapeHtml(strategy.label || `Choice ${strategyIndex + 1}`)}</strong><div class="score-grid">${objectives.map((objective, objectiveIndex) => `<label class="score-field" for="scenario-modifier-${scenarioIndex}-${strategyIndex}-${objectiveIndex}">${escapeHtml(objective.label || `Goal ${objectiveIndex + 1}`)} change<span class="requirement">* ${REQUIREMENT_CLASS.COMPARE}</span><input id="scenario-modifier-${scenarioIndex}-${strategyIndex}-${objectiveIndex}" data-scenario-strategy-modifier="${scenarioIndex}:${strategy.strategy_id}:${objective.objective_id}" type="number" min="-100" max="100" value="${scenario.strategy_modifiers?.[strategy.strategy_id]?.[objective.objective_id] ?? ''}" required><span class="help">Normalized change, not a probability.</span></label>`).join('')}</div></section>`).join('')}<details class="technical-inspect"><summary>Inspect bounded future-state mapping</summary><div class="actions">${Object.entries(scenario.states).map(([uncertaintyId, value]) => badge(`${uncertaintyId}: ${value}`)).join('')}</div></details></div></details>
    </article>`; }).join('')}
    <div class="beginner-note"><strong>Possible does not mean likely</strong><span>The tool explores what may happen. It does not claim how likely each future is.</span></div>
  </div>`;
}

function resultsStep() {
  const readiness = validateAnalysisReady(state.decision);
  if (!readiness.valid) {
    const groups = comparisonReadinessGroups(state.decision);
    const contractMessages = new Set(requirementIssues(state.decision, 'compare').map((issue) => issue.message));
    const technicalAttention = readiness.errors.some((error) => !contractMessages.has(error));
    const groupedItems = groups.map((group) => `<li><strong>${escapeHtml(group.label)}:</strong> ${escapeHtml(group.first)}${group.count > 1 ? ` <span class="help">${group.count - 1} more required ${group.count - 1 === 1 ? 'input remains' : 'inputs remain'} in this stage.</span>` : ''}</li>`).join('');
    return `<div class="stack"><div><h2 id="decision-step-heading-4" tabindex="-1">More information is needed</h2><p class="muted">Complete the required decision inputs before comparing the choices.</p></div><div class="callout warning"><strong>Finish these parts first</strong>${groupedItems ? `<ul>${groupedItems}</ul>` : '<p>Review the required decision inputs.</p>'}${technicalAttention ? '<p class="help">Technical validation also needs attention. Details remain available under Inspect technical validation.</p>' : ''}</div></div>`;
  }
  const summaries = summarizeStrategies(state.decision);
  const candidateResult = robustCandidateDecision(state.decision);
  const candidate = candidateResult.status === CANDIDATE_STATE.UNIQUE_LEADER ? candidateResult.candidates[0] : null;
  const objectives = new Map(state.decision.objectives.map((item) => [item.objective_id, item]));
  const humanSelectedStrategyId = state.decision.human_decision.selected_strategy_id;
  const selectedStrategyId = humanSelectedStrategyId || candidate?.strategy_id;
  const vulnerabilitySubject = humanSelectedStrategyId ? 'selected human choice' : candidate ? 'leading tested choice' : 'comparison target';
  const vulnerabilities = vulnerabilityMap(state.decision, selectedStrategyId);
  const matrix = buildPerformanceMatrix(state.decision);
  const semantics = semanticView(state.decision);
  const posture = decisionPosture(state.decision);
  const synthesis = deriveDecisionSynthesis(state.decision, state.record);
  const semanticSummary = state.decision.schema_version === '0.3.0' && (isSeerProfile(semantics.mode) || semantics.posture_enabled) ? `<section class="panel stack signature-synthesis" data-surface="decision-posture"><span class="eyebrow">Brief · Decision signature</span><div class="signature-grid"><div><span class="help">Assurance posture</span><strong class="posture-value">${escapeHtml(synthesis.posture || 'Inactive')}</strong></div><div><span class="help">Controlling issue</span><strong>${escapeHtml(synthesis.controlling_issue)}</strong></div><div><span class="help">Leading tested choice</span><strong>${escapeHtml(synthesis.strongest_alternative?.label || 'No unique leader')}</strong></div><div><span class="help">Recorded human decision</span><strong>${escapeHtml(synthesis.recorded_human_decision?.label || 'Not recorded')}</strong></div></div>${synthesis.sustainability_profile.length ? `<div class="grid-4 sustainability-profile-summary">${synthesis.sustainability_profile.map((item) => `<div><span class="help">${escapeHtml(item.dimension[0].toUpperCase() + item.dimension.slice(1))}</span><strong>${escapeHtml(item.state)}</strong></div>`).join('')}</div>` : ''}${synthesis.changes.length ? `<div><strong>What would change this decision?</strong><ul>${synthesis.changes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}${synthesis.next_evidence ? `<p><strong>Most decision-relevant next evidence:</strong> ${escapeHtml(synthesis.next_evidence.evidence_need)}</p>` : ''}<p class="help">The posture, leading tested choice, and recorded human decision are separate. Assurance posture is software decision support—not approval, authorization, certification, qualification, consent, or investment approval.</p></section>` : '';
  const compactSemanticSummary = semanticSummary
    ? `<details class="projection soft-panel" data-projection="decision-signature"><summary><strong>Assurance posture and conditions</strong><span class="help">Optional decision-semantics detail</span></summary><div class="projection-body">${semanticSummary}</div></details>`
    : '';
  const evidenceReadiness = decisionEvidenceReadiness(state.decision);
  const comparisonOutcome = candidateResult.status === CANDIDATE_STATE.UNIQUE_LEADER
    ? candidateResult.candidates[0].label
    : candidateResult.status === CANDIDATE_STATE.TIED_LEADERS
      ? `Tie: ${candidateResult.candidates.map((item) => item.label).join('; ')}`
      : candidateResult.status === CANDIDATE_STATE.NO_ACCEPTABLE_STRATEGY
        ? 'No acceptable choice under the declared critical-goal rules'
        : 'More complete information needed';
  const comparisonWhy = candidateResult.status === CANDIDATE_STATE.TIED_LEADERS
    ? 'The declared ranking rules do not separate the leading choices.'
    : candidateResult.status === CANDIDATE_STATE.NO_ACCEPTABLE_STRATEGY
      ? 'No tested choice satisfies the declared critical-goal gate across the included futures.'
      : candidateResult.status === CANDIDATE_STATE.INSUFFICIENT_DATA
        ? 'Required comparison outcomes are incomplete.'
        : (synthesis.controlling_issue || 'The comparison reflects the declared goals, thresholds, and modeled futures.');
  const decisionValueChanges = synthesis.changes.length
    ? synthesis.changes
    : vulnerabilities.filter((item) => item.vulnerable).map((item) => item.label);
  const nextProofItems = evidenceReadiness.proof_requests.map((item) => `${item.label}: ${item.evidence_need}`);
  const nextActionText = nextProofItems.length
    ? 'Resolve the required proof before adding confidence to the decision basis.'
    : 'Continue to Choose next step. The comparison informs; a person decides.';
  const resultFirstSummary = `<section class="decision-value-summary panel stack" data-surface="result-first"><span class="eyebrow">Decision value</span><div class="decision-value-grid"><div><span class="help">What held up</span><strong>${escapeHtml(comparisonOutcome)}</strong></div><div><span class="help">Why</span><strong>${escapeHtml(comparisonWhy)}</strong></div></div><div><h3>What could change it</h3>${decisionValueChanges.length ? `<ul>${decisionValueChanges.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="muted">No tested vulnerability or explicit change condition is currently surfaced for the comparison target.</p>'}</div><div><h3>Next Proof</h3>${nextProofItems.length ? `<ul>${nextProofItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="muted">No required proof currently blocks the formal evidence gate.</p>'}</div><div><h3>Next action</h3><p>${escapeHtml(nextActionText)}</p></div><div class="callout"><strong>You decide.</strong><p class="muted">The comparison informs. A person decides.</p></div></section>`;
  const candidateNotice = candidateResult.status === CANDIDATE_STATE.TIED_LEADERS
    ? `<div class="callout warning"><strong>Tied leading choices</strong><p class="muted">${candidateResult.candidates.map((item) => escapeHtml(item.label)).join('; ')} are indistinguishable under the declared ranking rules. FDE does not resolve the tie by array order.</p></div>`
    : candidateResult.status === CANDIDATE_STATE.NO_ACCEPTABLE_STRATEGY
      ? '<div class="callout warning"><strong>No acceptable choice under the current rules</strong><p class="muted">The declared critical-goal gate does not produce an acceptable tested choice. FDE does not force a winner.</p></div>'
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
    <div><h2 id="decision-step-heading-4" tabindex="-1">What the comparison shows</h2><p class="muted">Meaning first. Evidence on demand.</p></div>
    ${resultFirstSummary}
    ${candidateNotice}
    ${compactSemanticSummary}
    <details class="projection soft-panel" data-projection="brief" open><summary><strong>Brief</strong><span class="help">Conclusion and control point</span></summary><div class="projection-body"><p><strong>Leading tested choice:</strong> ${escapeHtml(synthesis.strongest_alternative?.label || 'No unique leader')}</p><p>${synthesis.posture ? `The controlling issue determines posture. ` : ''}The comparison identifies a leading tested choice; a person records the decision.</p></div></details>
    <details class="projection soft-panel" data-projection="review"><summary><strong>Review</strong><span class="help">Four-P status, uncertainties, and decision conditions</span></summary><div class="projection-body">${synthesis.uncertainty_summary.length ? `<h3>What remains uncertain</h3><ul>${synthesis.uncertainty_summary.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>No uncertainties were declared.</p>'}</div></details>
    <details class="projection soft-panel" data-projection="review-conditions"><summary><strong>Review conditions</strong><span class="help">Tested vulnerabilities and conditions to strengthen</span></summary><div class="projection-body"><ul>${vulnerabilities.filter((item) => item.vulnerable).map((item) => `<li><strong>${escapeHtml(item.label)}</strong> · ${item.invalids.length ? 'Outcome needs attention' : item.failures.map(failureLabel).join('; ')}</li>`).join('') || '<li>No tested vulnerabilities were identified.</li>'}</ul></div></details>
    <details class="projection soft-panel" data-projection="inspect"><summary><strong>Inspect</strong><span class="help">Normalized values, thresholds, and traceability</span></summary><div class="projection-body stack"><p><strong>Normalized comparison traceability.</strong> Basis: ${state.decision.provenance.values_are_analyst_assigned ? 'Analyst judgment' : 'Declared normalization rubric'}. Each normalized score is a declared comparison input, not an arithmetic conversion of an objective’s original unit or threshold. Source references remain attached where declared.</p>${scoreTraceability}
    <div class="grid-3">${summaries.map((summary) => `<article class="metric-card-like ${summary.strategy_id === candidate?.strategy_id ? `candidate ${summary.critical_failure_scenario_count > 0 ? 'has-critical-gaps' : ''}` : ''}"><span class="help">${!summary.analysis_valid ? 'Invalid data · not ranked' : summary.strategy_id === candidate?.strategy_id ? (summary.critical_failure_scenario_count > 0 ? 'Strongest alignment in this comparison · goals to strengthen' : 'Strongest alignment in this comparison') : 'Strategy'}</span><strong>${escapeHtml(summary.label)}</strong><div class="big-number">${summary.analysis_valid ? formatPercent(summary.overall_pass_rate) : '—'}</div><span class="help">Share of selected goals reached across tested futures</span><div class="result-line"><span>Most demanding tested future</span><strong>${summary.analysis_valid ? formatPercent(summary.worst_case_pass_rate) : '—'}</strong></div><div class="result-line"><span>Tested futures with goals to strengthen</span><strong>${summary.critical_failure_scenario_count}</strong></div><div class="result-line"><span>Outcomes needing attention</span><strong>${summary.invalid_outcome_count}</strong></div></article>`).join('')}</div>
    <details class="matrix-details soft-panel"><summary><strong>See the detailed calculation table</strong><span class="help">Detailed values remain available after the plain-language summary.</span></summary><div class="table-wrap" style="margin-top:1rem"><table><caption>How every choice performed across the tested futures and goals</caption><thead><tr><th scope="col">Strategy</th><th scope="col">Scenario</th>${state.decision.objectives.map((objective) => `<th scope="col">${escapeHtml(objective.label)}<br><span class="help">Threshold ${objective.threshold}${objective.critical ? ' · critical' : ''}</span></th>`).join('')}</tr></thead><tbody>${state.decision.strategies.flatMap((strategy) => state.decision.scenarios.map((scenario) => `<tr><th scope="row">${escapeHtml(strategy.label)}</th><td>${escapeHtml(scenario.label)}</td>${state.decision.objectives.map((objective) => { const row = matrix.find((entry) => entry.strategy_id === strategy.strategy_id && entry.scenario_id === scenario.scenario_id && entry.objective_id === objective.objective_id); return `<td><strong>${row?.value ?? '—'}</strong><br>${outcomeBadge(row, objective)}</td>`; }).join('')}</tr>`)).join('')}</tbody></table></div></details></div></details>
    <section class="panel stack"><div class="section-head"><div><span class="eyebrow">Conditions to watch and strengthen</span><h3>${escapeHtml(state.decision.strategies.find((item) => item.strategy_id === selectedStrategyId)?.label || '')}</h3></div><p>The tested conditions where the ${vulnerabilitySubject} may need more support to reach a good-enough line.</p></div>${vulnerabilities.map((scenario) => `<div class="vulnerability ${scenario.vulnerable ? 'is-vulnerable' : 'is-resilient'}"><div><strong>${escapeHtml(scenario.label)}</strong><p class="help">${escapeHtml(scenario.description)}</p></div><div>${scenario.invalids.length ? badge('Outcome needs attention · comparison paused', 'assumed') : scenario.failures.length ? scenario.failures.map((failure) => badge(failureLabel(failure), failure.critical ? 'interpreted' : 'assumed')).join('') : badge('All selected goals reached', 'measured')}</div></div>`).join('')}</section>
    <div class="callout"><strong>The comparison informs. A person decides.</strong><p class="muted">FDE shows ties, information that needs attention, and goals that are not yet met. You may choose differently, but you should explain why.</p></div>
  </div>`;
}
function workingDecisionBriefText() {
  const decision = state.decision;
  const synthesis = deriveDecisionSynthesis(decision, state.record);
  const candidateResult = robustCandidateDecision(decision);
  const leadingChoice = candidateResult.status === CANDIDATE_STATE.UNIQUE_LEADER
    ? candidateResult.candidates[0].label
    : candidateResult.status === CANDIDATE_STATE.TIED_LEADERS
      ? `Tie: ${candidateResult.candidates.map((item) => item.label).join('; ')}`
      : candidateResult.status === CANDIDATE_STATE.NO_ACCEPTABLE_STRATEGY
        ? 'No acceptable choice under the declared critical-goal rules'
        : 'More complete information needed';
  const selected = decision.strategies.find((item) => item.strategy_id === decision.human_decision.selected_strategy_id);
  const targetId = selected?.strategy_id || (candidateResult.status === CANDIDATE_STATE.UNIQUE_LEADER ? candidateResult.candidates[0].strategy_id : '');
  const testedChanges = targetId ? vulnerabilityMap(decision, targetId).filter((item) => item.vulnerable).map((item) => item.label) : [];
  const readiness = decisionEvidenceReadiness(decision);
  return buildDecisionBriefText({
    decision: decision.question,
    owner: decision.decision_owner,
    authority: AUTHORITY_LABELS[state.authority.role],
    leadingChoice,
    selectedChoice: selected?.label || 'No human selection',
    assurancePosture: synthesis.posture || 'Inactive',
    controllingIssue: synthesis.controlling_issue || '',
    changes: synthesis.changes.length ? synthesis.changes : testedChanges,
    nextProof: readiness.proof_requests.map((item) => `${item.label}: ${item.evidence_need}`),
    nextAction: decision.human_decision.next_action || '',
  });
}
function decisionBriefStep() {
  const decision = state.decision;
  const synthesis = deriveDecisionSynthesis(decision, state.record);
  const lifecycle = recordingLifecycle();
  const candidateResult = robustCandidateDecision(decision);
  const candidate = candidateResult.status === CANDIDATE_STATE.UNIQUE_LEADER ? candidateResult.candidates[0] : null;
  const machineCandidateLabel = candidateResult.status === CANDIDATE_STATE.TIED_LEADERS
    ? `Tie: ${candidateResult.candidates.map((item) => item.label).join('; ')}`
    : candidate?.label || (candidateResult.status === CANDIDATE_STATE.INSUFFICIENT_DATA ? 'More complete information needed' : 'Not available');
  const selected = decision.strategies.find((item) => item.strategy_id === decision.human_decision.selected_strategy_id);
  const validation = validateDecisionCase(decision);
  const reviewStrategyId = selected?.strategy_id || candidate?.strategy_id || '';
  const reviewSubject = selected ? 'selected human choice' : candidate ? 'leading tested choice' : 'comparison target';
  const reviewHeading = selected
    ? 'Conditions that could break the selected human choice'
    : candidate
      ? 'Conditions that could break the leading tested choice'
      : 'Conditions to review before selection';
  const reviewedVulnerabilities = reviewStrategyId
    ? vulnerabilityMap(decision, reviewStrategyId).filter((item) => item.vulnerable)
    : [];
  const semantics = semanticView(decision);
  const posture = decisionPosture(decision);
  const hasValidRecord = validDecisionRecord(state.record);
  const permissions = authorityPermissions(state.authority);
  const evidenceReadiness = decisionEvidenceReadiness(decision);
  const proofRequestItems = evidenceReadiness.proof_requests.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.evidence_need)}</li>`).join('');
  const evidenceGate = evidenceReadiness.state === EVIDENCE_READINESS.PROOF_REQUIRED
    ? `<section class="callout warning" data-surface="evidence-gate"><strong>Decision not ready for additional confidence.</strong><p>Required evidence remains unresolved. Gather the evidence first, or an accountable decision-maker may explicitly proceed under residual uncertainty.</p>${proofRequestItems ? `<ul>${proofRequestItems}</ul>` : '<p class="muted">Name the evidence needed for each required unresolved criterion before recording.</p>'}<label class="field"><span><input id="proceed-residual-uncertainty" type="checkbox"> Proceed under explicit residual uncertainty</span></label>${textarea('Why proceed despite the unresolved evidence?', 'residual-uncertainty-rationale', '', 'Required only when proceeding under residual uncertainty.')}</section>`
    : '<section class="callout" data-surface="evidence-gate"><strong>Evidence gate: ready.</strong><p>No required criterion is currently blocked by unresolved evidence in the formal decision semantics.</p></section>';
  const authorityPanel = `<section class="callout" data-surface="authority-gate"><strong>${escapeHtml(AUTHORITY_LABELS[state.authority.role])}</strong><p>Accountable owner: ${escapeHtml(state.authority.owner || 'Not established')}${state.authority.basis ? ` · ${escapeHtml(state.authority.basis)}` : ''}</p></section>`;
  const attestationPanel = permissions.mayRecordDecision
    ? `<section class="soft-panel stack" data-surface="human-attestation"><h3>Human attestation</h3><p>${escapeHtml(HUMAN_ATTESTATION_STATEMENT)}</p><div class="grid-2">${field('Attested by', 'attestation-name', state.authority.owner || decision.decision_owner, 'text', 'Name or accountable role.', REQUIREMENT_CLASS.RECORD)}${field('Attested role', 'attestation-role', state.authority.owner || decision.decision_owner, 'text', 'Role in the decision.', REQUIREMENT_CLASS.RECORD)}</div><label class="field"><span><input id="attestation-confirmed" type="checkbox"> I confirm this attestation.</span></label><p class="help">This is a human attestation, not a digital signature, identity-verification service, corporate approval, legal authorization, or execution authority.</p></section>`
    : '<section class="callout warning"><strong>Owner review required.</strong><p>You may prepare and export the analysis, but only an accountable owner or delegated decider can record an accountable Decision Receipt.</p></section>';
  const recordedOutput = hasValidRecord ? `<div class="decision-complete stack" data-surface="decision-complete"><h3 id="decision-recorded-heading" tabindex="-1">${lifecycle.key === 'recorded' ? 'Human decision recorded.' : 'Recorded version available.'}</h3><p><strong>Recorded human decision:</strong> ${escapeHtml(synthesis.recorded_human_decision?.label || 'Recorded decision available')}</p><div class="completion-actions"><button id="export-decision-html" data-action="download-readable-summary" class="primary" type="button">Download Decision Receipt</button><button id="export-decision-json" data-action="download-decision-file" type="button">Download Decision Receipt JSON</button><button id="reset-decision" class="ghost" type="button">Try an example</button></div></div>` : '';
  const visibleConditionTarget = semantics.conditions[0]?.criterion_refs?.length === 1 ? semantics.conditions[0].criterion_refs[0] : '';
  const semanticControls = decision.schema_version === '0.3.0' ? `<section class="soft-panel stack" data-surface="semantic-controls"><div><span class="eyebrow">Human-declared proceed conditions</span><h3>Assurance posture controls</h3></div><label class="field"><span><input id="posture-enabled" type="checkbox" ${semantics.posture_enabled ? 'checked' : ''}> Show assurance posture</span></label><label class="field">Have proceed conditions been reviewed?<select id="proceed-conditions-state"><option value="unreviewed" ${semantics.proceed_conditions_state === 'unreviewed' ? 'selected' : ''}>Not reviewed</option><option value="declared" ${semantics.proceed_conditions_state === 'declared' ? 'selected' : ''}>Required criteria declared</option><option value="none-required" ${semantics.proceed_conditions_state === 'none-required' ? 'selected' : ''}>None required — deliberately confirmed</option></select></label><div class="grid-2">${field('Required condition or safeguard', 'semantic-condition-statement', semantics.conditions[0]?.statement || '')}<label class="field">This condition applies to<select id="semantic-condition-target"><option value="" ${visibleConditionTarget ? '' : 'selected'}>Whole decision (not remediation)</option>${semantics.criteria.map((criterion) => `<option value="${escapeHtml(criterion.criterion_id)}" ${visibleConditionTarget === criterion.criterion_id ? 'selected' : ''}>${escapeHtml(criterion.dimension[0].toUpperCase() + criterion.dimension.slice(1))}: ${escapeHtml(criterion.label || criterion.criterion_id)}</option>`).join('')}</select><span class="help">Only an explicitly targeted open condition can remediate that criterion.</span></label><label class="field">Condition state<select id="semantic-condition-state"><option value="open" ${semantics.conditions[0]?.state !== 'satisfied' ? 'selected' : ''}>Open</option><option value="satisfied" ${semantics.conditions[0]?.state === 'satisfied' ? 'selected' : ''}>Satisfied</option></select></label>${field('Monitoring obligation', 'semantic-monitoring-observable', semantics.monitoring[0]?.observable || '')}${field('Reassessment', 'semantic-reassessment', semantics.reassessment || '')}</div><p class="help">This compact view edits the first condition and monitoring record only; additional imported records remain preserved.</p><label class="field">Cautious human posture override<select id="posture-override"><option value="">No override</option>${['ADVANCE WITH CONDITIONS','REWORK','HOLD','STOP'].map((value) => `<option value="${value}" ${semantics.posture_override === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>${textarea('Why use a more cautious posture?', 'posture-override-reason', semantics.posture_override_reason || '')}<p><strong>Current Assurance posture:</strong> ${escapeHtml(posture.posture || 'Inactive')}</p><p class="help">These controls do not choose a strategy. Your final decision remains below.</p></section>` : '';
  return `<div class="stack">
    <div><h2 id="decision-step-heading-5" tabindex="-1">Choose a path.</h2></div>
    <section class="decision-brief">
      <div class="brief-head"><div><span class="eyebrow">Decision question</span><h3>${escapeHtml(decision.question || 'Decision not yet framed')}</h3></div></div>
      <div class="brief-actions actions"><button id="copy-decision-brief" type="button">Copy Decision Brief</button><button id="download-decision-brief" type="button">Download Decision Brief</button><span id="decision-brief-status" class="status-line" role="status" aria-live="polite"></span></div>
      <div class="brief-grid">
        <div><span class="help">Decision owner</span><strong>${escapeHtml(decision.decision_owner)}</strong></div>
        <div><span class="help">Time horizon</span><strong>${escapeHtml(decision.time_horizon)}</strong></div>
        <div><span class="help">Leading tested choice</span><strong>${escapeHtml(machineCandidateLabel)}</strong>${candidate?.critical_failure_scenario_count ? `<span class="help">Leading tested choice has critical gaps in ${candidate.critical_failure_scenario_count} included future${candidate.critical_failure_scenario_count === 1 ? '' : 's'}.</span>` : ''}</div>
        <div><span class="help">Selected choice</span><strong data-human-selection-summary>${escapeHtml(selected?.label || 'No human selection')}</strong></div>
        <div><span class="help">Assurance posture</span><strong>${escapeHtml(synthesis.posture || 'Inactive')}</strong></div>
        <div><span class="help">Controlling issue</span><strong>${escapeHtml(synthesis.controlling_issue)}</strong></div>
      </div>
      <label class="field" for="human-strategy">Choice<span class="requirement">* ${REQUIREMENT_CLASS.RECORD}</span><select id="human-strategy" required aria-describedby="human-strategy-help"><option value="" ${selected ? '' : 'selected'}>Choose only when a person decides</option>${decision.strategies.map((strategy, index) => `<option value="${strategy.strategy_id}" ${strategy.strategy_id === selected?.strategy_id ? 'selected' : ''}>${escapeHtml(strategy.label || `Choice ${index + 1}`)}</option>`).join('')}</select><span id="human-strategy-help" class="help">Selecting is not recording. Record only after reviewing the human choice.</span></label>
      ${textarea('Reason', 'human-rationale', decision.human_decision.rationale, 'State the trade-off and important uncertainty.', REQUIREMENT_CLASS.RECORD)}
      ${textarea('Next action', 'human-next-action', decision.human_decision.next_action, 'Name one action, one owner, and when to check progress.', REQUIREMENT_CLASS.RECORD)}
      ${authorityPanel}
      ${evidenceGate}
      ${attestationPanel}
      ${semanticControls ? `<details class="decision-section soft-panel" data-surface="advanced-governance"><summary><strong>Review conditions, safeguards, monitoring, and reassessment</strong><span class="help">Optional decision-governance controls</span></summary><div class="decision-section-body">${semanticControls}</div></details>` : ''}
      <details class="decision-section soft-panel" open><summary><strong>What we know, what we estimated, and what to strengthen</strong></summary><div class="grid-2 decision-section-body">
        <div class="stack"><h3>What is known</h3><ul>${decision.evidence_summary.known.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="stack"><h3>What is assumed</h3><ul>${decision.evidence_summary.assumed.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="stack"><h3>What remains uncertain</h3><ul>${decision.evidence_summary.unknown.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="stack"><h3>${escapeHtml(reviewHeading)}</h3>${reviewStrategyId ? (reviewedVulnerabilities.length ? `<ul>${reviewedVulnerabilities.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${item.failures.map((failure) => escapeHtml(decision.objectives.find((objective) => objective.objective_id === failure.objective_id)?.label || failure.objective_id)).join(', ')}</li>`).join('')}</ul>` : `<p class="muted">No declared threshold failures for the ${reviewSubject} in the included futures.</p>`) : '<p class="muted">No unique comparison target is available yet. Review the comparison before selecting a path.</p>'}</div>
      </div></details>
      <details class="decision-section soft-panel" open><summary><strong>Plan for change <span class="method-word">(adaptive planning)</span></strong></summary><div class="grid-2 decision-section-body"><div class="stack"><h3>Act now</h3><ul>${decision.adaptive_pathway.act_now.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="stack"><h3>Monitor</h3><ul>${decision.adaptive_pathway.monitor.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="stack"><h3>Trigger</h3><ul>${decision.adaptive_pathway.triggers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="stack"><h3>Contingencies</h3><ul>${decision.adaptive_pathway.contingencies.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></div><p><strong>Reassessment:</strong> ${escapeHtml(decision.adaptive_pathway.reassessment)}</p></details>
    </section>
    <div class="self-service-panel decision-output" data-recorded="${lifecycle.key === 'recorded'}" data-surface="decision-output"><div class="record-state ${lifecycle.key}" aria-live="polite"><strong>${escapeHtml(lifecycle.label)}</strong>${lifecycle.key === 'changed' ? `<p>The working decision changed after ${escapeHtml(state.record.recorded_at)}. Recorded outputs still use the prior recorded version until you review and record again.</p>` : lifecycle.key === 'recorded' ? `<p>Recorded ${escapeHtml(state.record.recorded_at)}. Recording does not mean approval or authorization.</p>` : '<p>The comparison informs. A person decides.</p>'}</div><div class="record-prompt actions">${permissions.mayRecordDecision ? `<button id="record-decision" class="primary" type="button">${escapeHtml(lifecycle.key === 'changed' ? 'Review and Record Again' : 'Record human decision')} →</button>` : '<span class="help">Prepare this analysis for the accountable decision owner. Recording is unavailable in advisor mode.</span>'}</div>${recordedOutput}</div>
    <div id="decision-validation" class="status-line" role="alert" tabindex="-1" aria-live="assertive">${state.validationIssues.map((issue) => escapeHtml(issue.message)).join(' ')}</div>
    <details class="technical-inspect"><summary>Inspect technical validation</summary><div class="decision-section-body"><p>${validation.valid ? `Decision structure passes v${escapeHtml(decision.schema_version)} validation.` : escapeHtml(validation.errors.join(' '))}</p><p>Current decision SHA-256: ${escapeHtml(decisionContentSha256(decision))}</p><p class="help">Legacy change-detection fingerprint: ${escapeHtml(decisionFingerprint(decision))}</p></div></details>
  </div>`;
}

export const decisionStepRenderers = [frameStep, mapStep, strategiesStep, scenariosStep, resultsStep, decisionBriefStep];

function syncStep() {
  const decision = state.decision;
  if (state.step === 0) {
    const seerReminder = Boolean(document.querySelector('#enable-seer-reminder')?.checked);
    const nextMode = seerReminder ? SEER_PROFILE_ID : 'general';
    const enablePosture = Boolean(document.querySelector('#enable-decision-posture')?.checked);
    if (isSeerProfile(nextMode) || enablePosture || decision.schema_version === '0.3.0') {
      activateDecisionSemantics(decision, nextMode);
      decision.decision_semantics.posture_enabled = isSeerProfile(nextMode) || enablePosture;
      if (nextMode === 'general' && enablePosture && decision.decision_semantics.criteria.length === 0) {
        decision.decision_semantics.criteria.push({ criterion_id: 'CRT-001', dimension: 'general', label: '', requirement: '', must_be_true: false, evidence_state: 'unknown', outcome: 'not-assessable', source_refs: [], evidence_need: '', affected_party_ids: [], missing_perspectives: [], assumptions: [], limitations: [] });
      }
    }
    decision.title = readTrimmedText(document.querySelector('#decision-title'), decision.title);
    decision.question = readTrimmedText(document.querySelector('#decision-question'), decision.question);
    decision.decision_owner = readTrimmedText(document.querySelector('#decision-owner'), decision.decision_owner);
    state.authority = createAuthority({
      role: document.querySelector('#decision-authority-role')?.value || state.authority.role,
      owner: decision.decision_owner,
      basis: readTrimmedText(document.querySelector('#decision-authority-basis'), state.authority.basis),
    });
    decision.time_horizon = readTrimmedText(document.querySelector('#decision-horizon'), decision.time_horizon);
    decision.urgency = document.querySelector('#decision-urgency')?.value ?? decision.urgency;
    decision.reversibility = document.querySelector('#decision-reversibility')?.value ?? decision.reversibility;
  }
  if (state.step === 1) {
    decision.objectives.forEach((objective, index) => {
      objective.label = readTrimmedText(document.querySelector(`#objective-label-${index}`), objective.label);
      objective.description = readTrimmedText(document.querySelector(`#objective-description-${index}`), objective.description);
      objective.direction = document.querySelector(`[data-objective-direction="${index}"]`)?.value || objective.direction;
    });
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
    const humanStrategy = document.querySelector('#human-strategy');
    if (humanStrategy) decision.human_decision.selected_strategy_id = humanStrategy.value;
    decision.human_decision.rationale = document.querySelector('#human-rationale')?.value.trim() || '';
    decision.human_decision.next_action = document.querySelector('#human-next-action')?.value.trim() || '';
  }
  persistDecision();
}

export function buildDecisionHtml(record) {
  if (!validDecisionRecord(record)) throw new TypeError('A valid Decision Record is required to build a recorded Decision Brief.');
  const decision = record.snapshot;
  if (!validateCompletedDecisionCase(decision).valid) throw new TypeError('A completed recorded decision is required to build a Decision Brief.');
  const synthesis = deriveDecisionSynthesis(decision, record);
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
  const semanticSection = decision.schema_version === '0.3.0' && (isSeerProfile(semantics.mode) || semantics.posture_enabled) ? `<section><h2>Decision signature</h2><p><strong>Assurance posture:</strong> ${escapeHtml(synthesis.posture || 'Inactive')}</p><p><strong>Controlling issue:</strong> ${escapeHtml(synthesis.controlling_issue)}</p><p><strong>Leading tested choice:</strong> ${escapeHtml(synthesis.strongest_alternative?.label || 'No unique leader')}</p><p><strong>Recorded human decision:</strong> ${escapeHtml(synthesis.recorded_human_decision?.label || 'Not recorded')}</p>${synthesis.sustainability_profile.length ? `<div class="grid">${synthesis.sustainability_profile.map((item) => `<div><h3>${escapeHtml(item.dimension[0].toUpperCase() + item.dimension.slice(1))}</h3><p>${escapeHtml(item.state)}</p></div>`).join('')}</div>` : ''}${synthesis.changes.length ? `<h3>What would change this decision?</h3>${list(synthesis.changes)}` : ''}${synthesis.next_evidence ? `<p><strong>Most decision-relevant next evidence:</strong> ${escapeHtml(synthesis.next_evidence.evidence_need)}</p>` : ''}<p><em>The posture, leading tested choice, and recorded human decision are separate. Assurance posture is software decision support, not approval or authorization.</em></p></section>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(decision.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 20px;line-height:1.55;color:#172033}section{margin:28px 0;padding-top:12px;border-top:1px solid #d7dce5}table{width:100%;border-collapse:collapse}caption{text-align:left;font-weight:700;margin-bottom:8px}th,td{text-align:left;padding:8px;border-bottom:1px solid #d7dce5}.tag{display:inline-block;border:1px solid #aeb7c7;border-radius:999px;padding:3px 9px;margin:2px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}@media(max-width:650px){.grid{grid-template-columns:1fr}}@media print{body{max-width:none;margin:0;padding:0;color:#000}section{break-inside:avoid}.no-print{display:none}}</style></head><body><h1>${escapeHtml(decision.title)}</h1><p>${escapeHtml(decision.question)}</p><p><span class="tag">${escapeHtml(decision.profile)}</span><span class="tag">Human-governed</span><span class="tag">${decision.provenance.probability_model_used ? 'Probability model disclosed' : 'No probability model'}</span></p><section><h2>Decision and accountable authority</h2><p><strong>Decision owner:</strong> ${escapeHtml(record.format_version === '2' ? record.authority.owner : decision.decision_owner)}</p><p><strong>Authority:</strong> ${escapeHtml(record.format_version === '2' ? AUTHORITY_LABELS[record.authority.role] : 'Legacy recorded decision')}</p>${record.format_version === '2' && record.authority.basis ? `<p><strong>Authority basis:</strong> ${escapeHtml(record.authority.basis)}</p>` : ''}</section><section><h2>Recorded decision</h2><p><strong>Leading tested choice:</strong> ${escapeHtml(machineCandidateLabel)}${candidate?.critical_failure_scenario_count ? ` <em>(leading tested choice has critical gaps in ${candidate.critical_failure_scenario_count} included future${candidate.critical_failure_scenario_count === 1 ? '' : 's'})</em>` : ''}</p><p><strong>Recorded human decision:</strong> ${escapeHtml(selected?.label || 'Not recorded')}</p><p>${escapeHtml(decision.human_decision.rationale)}</p><p><strong>Next action:</strong> ${escapeHtml(decision.human_decision.next_action)}</p><p><em>Recording documents the human decision; it is not approval, authorization, certification, qualification, consent, or investment authority.</em></p></section>${semanticSection}<section><h2>Evidence gate</h2>${record.format_version === '2' ? `<p><strong>Disposition:</strong> ${escapeHtml(record.evidence_disposition.state)}</p>${record.evidence_disposition.unresolved_evidence.length ? `<p><strong>Unresolved evidence:</strong> ${escapeHtml(record.evidence_disposition.unresolved_evidence.join(', '))}</p><p>${escapeHtml(record.evidence_disposition.rationale)}</p>` : ''}` : '<p>Legacy record; receipt-level evidence disposition was not recorded.</p>'}</section><section><h2>What FDE did not establish</h2><ul><li>FDE does not independently verify source claims unless separately provided through governed evidence.</li><li>Normalized comparison inputs are not probabilities or native scientific or commercial measurements.</li><li>A recorded human decision is not organizational approval or execution authorization.</li><li>The receipt does not prove that the decision was correct.</li></ul></section><section><h2>Evidence boundary</h2><div class="grid"><div><h3>Known</h3>${list(decision.evidence_summary.known)}</div><div><h3>Assumed</h3>${list(decision.evidence_summary.assumed)}</div><div><h3>Unknown</h3>${list(decision.evidence_summary.unknown)}</div><div><h3>Recorded human choice vulnerabilities</h3>${vulnerabilities.length ? `<ul>${vulnerabilities.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${item.failures.map((failure) => escapeHtml(decision.objectives.find((objective) => objective.objective_id === failure.objective_id)?.label || failure.objective_id)).join(', ')}</li>`).join('')}</ul>` : '<p>No declared threshold failures for the recorded human choice in the included futures.</p>'}</div></div></section><section><h2>Choice comparison</h2><p>Normalized values use a 0–100 decision-model scale. They are not probabilities or native scientific or commercial measurements.</p><table><caption>Goal performance by choice</caption><thead><tr><th scope="col">Choice</th><th scope="col">Overall pass</th><th scope="col">Most demanding future</th><th scope="col">Critical-failure futures</th><th scope="col">Critical misses</th></tr></thead><tbody>${summaries.map((item) => `<tr><th scope="row">${escapeHtml(item.label)}</th><td>${formatPercent(item.overall_pass_rate)}</td><td>${formatPercent(item.worst_case_pass_rate)}</td><td>${item.critical_failure_scenario_count}</td><td>${item.critical_failure_count}</td></tr>`).join('')}</tbody></table></section>${decision.adaptive_pathway.act_now.length || decision.adaptive_pathway.monitor.length || decision.adaptive_pathway.triggers.length || decision.adaptive_pathway.contingencies.length || decision.adaptive_pathway.reassessment ? `<section><h2>Optional plan for change</h2><div class="grid"><div><h3>Act now</h3>${list(decision.adaptive_pathway.act_now)}</div><div><h3>Monitor</h3>${list(decision.adaptive_pathway.monitor)}</div><div><h3>Triggers</h3>${list(decision.adaptive_pathway.triggers)}</div><div><h3>Contingencies</h3>${list(decision.adaptive_pathway.contingencies)}</div></div><p><strong>Reassessment:</strong> ${escapeHtml(decision.adaptive_pathway.reassessment)}</p></section>` : ''}${record.format_version === '2' ? `<section><h2>Human attestation</h2><p>${escapeHtml(record.attestation.statement)}</p><p><strong>Attested by:</strong> ${escapeHtml(record.attestation.attested_by)} · ${escapeHtml(record.attestation.attested_role)}</p><p><strong>Attested at:</strong> ${escapeHtml(record.attestation.attested_at)}</p></section><section><h2>Integrity</h2><p><strong>FDE version:</strong> ${escapeHtml(record.producer.application_version)}</p><p><strong>Decision schema:</strong> ${escapeHtml(record.producer.decision_schema_version)}</p><p><strong>Semantic schema:</strong> ${escapeHtml(record.producer.semantic_schema_version)}</p><p><strong>Decision content SHA-256:</strong> <code>${escapeHtml(record.decision_content_sha256)}</code></p><p><strong>Receipt SHA-256:</strong> <code>${escapeHtml(record.receipt_sha256)}</code></p></section>` : '<section><h2>Integrity</h2><p><strong>Legacy integrity receipt:</strong> FNV-1a change detection only; not a cryptographic receipt.</p></section>'}<p>Generated by Frontier Decision Engine v${APPLICATION_VERSION}.</p></body></html>`;
}

function focusValidationFailure(root, issues) {
  root.querySelectorAll('[aria-invalid="true"]').forEach((element) => element.removeAttribute('aria-invalid'));
  const issue = issues[0];
  if (issue) {
    state.step = issue.stage;
    state.expandAll = false;
    root.querySelectorAll('[data-decision-stage]').forEach((stage) => {
      const active = Number(stage.dataset.decisionStage) === issue.stage;
      stage.open = active;
      stage.toggleAttribute('data-active', active);
    });
    const element = root.querySelector(`#${CSS.escape(issue.fieldId)}`);
    if (element) {
      let parent = element.parentElement;
      while (parent && parent !== root) {
        if (parent.tagName === 'DETAILS') parent.open = true;
        parent = parent.parentElement;
      }
      element.setAttribute('aria-invalid', 'true');
      element.focus();
      return;
    }
  }
  const message = root.querySelector('#decision-validation');
  if (message) {
    message.textContent = issues.map((item) => item.message).join(' ');
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
  const isCompletedRecord = parsed.kind === 'completed-record';
  const importedRecord = isCompletedRecord
    ? parsed.record
    : isDraftBackup
      ? (validDecisionRecord(parsed.record) ? parsed.record : null)
      : recordFromPortableDecision(parsed.decision);
  startDecision(
    parsed.decision,
    isDraftBackup ? 'imported-draft-backup' : isCompletedRecord ? 'imported-record' : 'imported-file',
    isDraftBackup ? 'Opened from an in-progress draft backup and saved in this browser.' : isCompletedRecord ? 'Opened from a verified Decision Receipt and saved in this browser.' : 'Opened from a completed decision file and saved in this browser.',
    importedRecord,
    parsed.authority || importedRecord?.authority || null,
  );
  persistDecision();
  renderInto(main, { focusStep: true });
}

function renderDraftReturn(main, { openFile = false, focusMethod = false } = {}) {
  const backupAvailable = canDownloadDraftBackup(state.pendingDraft, state.pendingRecord, state.pendingAuthority);
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
    startDecision(state.pendingDraft, 'restored-browser-draft', 'Restored from this browser.', state.pendingRecord, state.pendingAuthority);
    renderInto(main, { focusStep: true });
  });
  main.querySelector('#download-browser-draft')?.addEventListener('click', () => {
    if (!backupAvailable) return;
    const backup = createDraftBackup(state.pendingDraft, state.pendingRecord, state.pendingAuthority);
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
  const inputBoundary = index === 0 ? boundaryForInput(state.decision.question) : null;
  if (inputBoundary) {
    const issue = {
      stage: 0,
      fieldId: 'decision-question',
      category: REQUIREMENT_CLASS.CONTINUE,
      message: `${inputBoundary.title} ${inputBoundary.body}`,
    };
    state.validationIssues = [issue];
    const message = root.querySelector('[data-stage-validation="0"]');
    if (message) message.textContent = issue.message;
    focusValidationFailure(root, [issue]);
    return false;
  }
  if (index === 0) {
    const authorityResult = authorityValidation(state.authority);
    if (!authorityResult.valid) {
      const fieldId = state.authority.role === 'ownership_unknown' ? 'decision-authority-role' : state.authority.role === 'delegated_decider' && !state.authority.basis ? 'decision-authority-basis' : 'decision-owner';
      const issue = { stage: 0, fieldId, category: REQUIREMENT_CLASS.COMPARE, message: authorityResult.errors[0] };
      state.validationIssues = [issue];
      const message = root.querySelector('[data-stage-validation="0"]');
      if (message) message.textContent = issue.message;
      focusValidationFailure(root, [issue]);
      return false;
    }
  }
  const result = index === 4
    ? { valid: validateAnalysisReady(state.decision).valid, issues: requirementIssues(state.decision, 'compare') }
    : validateStageRequirements(state.decision, index);
  if (!result.valid) {
    const issues = result.issues?.length ? result.issues : [{ stage: index, fieldId: `decision-step-heading-${index}`, message: 'Complete the required comparison inputs before continuing.' }];
    state.validationIssues = issues;
    const message = root.querySelector(`[data-stage-validation="${index}"]`);
    if (message) message.textContent = issues.length > 1
      ? `${issues[0].message} ${issues.length - 1} more required ${issues.length - 1 === 1 ? 'input remains' : 'inputs remain'} in this stage.`
      : issues[0].message;
    focusValidationFailure(root, issues);
    return false;
  }
  if (index === 0 && !state.decision.title.trim()) {
    state.decision.title = state.decision.question.trim().replace(/[?.!]$/, '').slice(0, 80);
  }
  persistDecision();
  state.validationIssues = [];
  return true;
}

function bindEvents(root) {
  root.querySelector('#toggle-method-words')?.addEventListener('click', (event) => {
    const visible = document.documentElement.classList.toggle('show-method-words');
    event.currentTarget.setAttribute('aria-pressed', String(visible));
    event.currentTarget.textContent = visible ? 'Hide technical terms' : 'Show technical terms';
    const status = root.querySelector('#technical-terms-status');
    if (status) status.textContent = visible ? 'Technical terms are shown where relevant.' : 'Technical terms are hidden.';
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
    const validationIssue = state.validationIssues[0];
    const validationTarget = validationIssue?.stage === state.step
      ? root.querySelector(`#${CSS.escape(validationIssue.fieldId)}`)
      : null;
    requestAnimationFrame(() => {
      if (validationTarget?.isConnected) {
        validationTarget.focus({ preventScroll: true });
        validationTarget.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        return;
      }
      details.querySelector('h2')?.focus({ preventScroll: true });
    });
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
    const selected = state.decision.strategies.find((item) => item.strategy_id === event.target.value);
    const summary = root.querySelector('[data-human-selection-summary]');
    if (summary) summary.textContent = selected?.label || 'No human selection';
  });
  root.querySelectorAll('[data-scenario-no-change]').forEach((checkbox) => checkbox.addEventListener('change', () => {
    const scenarioIndex = Number(checkbox.dataset.scenarioNoChange);
    setScenarioNoModeledChange(state.decision, scenarioIndex, checkbox.checked);
    const scenario = state.decision.scenarios[scenarioIndex];
    state.decision.strategies.forEach((strategy) => state.decision.objectives.forEach((objective) => {
      const input = root.querySelector(`[data-scenario-strategy-modifier="${scenarioIndex}:${strategy.strategy_id}:${objective.objective_id}"]`);
      if (input) input.value = scenario.strategy_modifiers[strategy.strategy_id][objective.objective_id] ?? '';
    }));
    persistDecision();
  }));
  root.querySelector('#record-decision')?.addEventListener('click', () => {
    syncStep();
    const authorityResult = authorityValidation(state.authority, { forRecord: true });
    if (!authorityResult.valid) {
      state.validationIssues = [{ stage: 5, fieldId: 'decision-validation', message: authorityResult.errors[0] }];
      focusValidationFailure(root, state.validationIssues);
      return;
    }
    const result = validateCompletedDecisionCase(state.decision);
    if (!result.valid) {
      const issues = requirementIssues(state.decision, 'record');
      state.validationIssues = issues.length ? [issues[0]] : [{ stage: 5, fieldId: 'decision-validation', message: 'Review the conditional decision controls before recording.' }];
      const message = root.querySelector('#decision-validation');
      if (message) message.textContent = issues.length > 1
        ? `${issues[0].message} ${issues.length - 1} more required ${issues.length - 1 === 1 ? 'input remains' : 'inputs remain'} before recording.`
        : state.validationIssues[0].message;
      focusValidationFailure(root, state.validationIssues);
      return;
    }
    const readiness = decisionEvidenceReadiness(state.decision);
    const proceedResidual = Boolean(root.querySelector('#proceed-residual-uncertainty')?.checked);
    const residualRationale = root.querySelector('#residual-uncertainty-rationale')?.value.trim() || '';
    if (readiness.state === EVIDENCE_READINESS.PROOF_REQUIRED && !proceedResidual) {
      state.validationIssues = [{ stage: 5, fieldId: 'proceed-residual-uncertainty', message: 'Required evidence remains unresolved. Gather the evidence first or explicitly proceed under residual uncertainty.' }];
      focusValidationFailure(root, state.validationIssues);
      return;
    }
    if (proceedResidual && !residualRationale) {
      state.validationIssues = [{ stage: 5, fieldId: 'residual-uncertainty-rationale', message: 'Explain why the accountable decision-maker is proceeding despite unresolved evidence.' }];
      focusValidationFailure(root, state.validationIssues);
      return;
    }
    const confirmed = Boolean(root.querySelector('#attestation-confirmed')?.checked);
    const attestedBy = root.querySelector('#attestation-name')?.value.trim() || '';
    const attestedRole = root.querySelector('#attestation-role')?.value.trim() || '';
    if (!confirmed || !attestedBy || !attestedRole) {
      const fieldId = !attestedBy ? 'attestation-name' : !attestedRole ? 'attestation-role' : 'attestation-confirmed';
      state.validationIssues = [{ stage: 5, fieldId, message: 'Complete and confirm the human attestation before recording.' }];
      focusValidationFailure(root, state.validationIssues);
      return;
    }
    const disposition = evidenceDisposition({
      readiness,
      proceedUnderResidualUncertainty: proceedResidual,
      rationale: residualRationale,
    });
    state.record = createDecisionRecord(state.decision, {
      authority: state.authority,
      evidenceDisposition: disposition,
      attestation: { confirmed, attested_by: attestedBy, attested_role: attestedRole },
    });
    state.validationIssues = [];
    persistDecision();
    renderInto(root.closest('main') || root);
    requestAnimationFrame(() => document.querySelector('#decision-recorded-heading')?.focus());
  });
  root.querySelector('#copy-decision-brief')?.addEventListener('click', async () => {
    syncStep();
    const status = root.querySelector('#decision-brief-status');
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error('clipboard unavailable');
      await globalThis.navigator.clipboard.writeText(workingDecisionBriefText());
      if (status) status.textContent = 'Decision Brief copied.';
    } catch {
      if (status) status.textContent = 'Copy is unavailable here. Use Download Decision Brief.';
    }
  });
  root.querySelector('#download-decision-brief')?.addEventListener('click', () => {
    syncStep();
    downloadText(safeFilename(state.decision.title || 'decision', 'decision-brief.txt'), workingDecisionBriefText(), 'text/plain');
    const status = root.querySelector('#decision-brief-status');
    if (status) status.textContent = 'Decision Brief downloaded.';
  });
  root.querySelector('#export-decision-json')?.addEventListener('click', () => {
    if (!validDecisionRecord(state.record)) return;
    downloadText(safeFilename(state.record.snapshot.title, 'decision-receipt.json'), `${JSON.stringify(state.record, null, 2)}\n`, 'application/json');
  });
  root.querySelector('#export-decision-html')?.addEventListener('click', () => {
    if (!validDecisionRecord(state.record)) return;
    downloadText(safeFilename(state.record.snapshot.title, 'decision.html'), buildDecisionHtml(state.record), 'text/html');
  });
  root.querySelector('#open-decision-file')?.addEventListener('click', () => root.querySelector('#decision-file-input')?.click());
  root.querySelector('#decision-file-input')?.addEventListener('change', async (event) => {
    await openDecisionFile(event.target.files?.[0], root.closest('main') || root, event.target);
  });
  root.addEventListener('input', (event) => {
    if (event.target.matches('[data-scenario-strategy-modifier]') && event.target.value !== '0') {
      const [scenarioIndex] = event.target.dataset.scenarioStrategyModifier.split(':');
      const declaration = root.querySelector(`[data-scenario-no-change="${scenarioIndex}"]`);
      if (declaration) declaration.checked = false;
    }
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
  const lifecycle = recordingLifecycle();
  const technicalTermsVisible = document.documentElement.classList.contains('show-method-words');
  const stages = steps.map((label, index) => {
    const open = state.expandAll || index === state.step;
    const complete = stageComplete(index);
    const actions = index < steps.length - 1 ? `<div class="stage-actions"><button data-stage-back="${index}" type="button" ${index === 0 ? 'disabled' : ''}>Back</button><span class="status-line" data-stage-validation="${index}" role="alert"></span><button data-stage-next="${index}" class="primary" type="button">${stageActionLabels[index]}</button></div>` : `<div class="stage-actions"><button data-stage-back="${index}" type="button">Back</button></div>`;
    return `<details class="fde-stage" data-decision-stage="${index}" ${open ? 'open' : ''} ${index === state.step ? 'data-active' : ''}>
      <summary aria-controls="decision-stage-${index}"><span class="stage-number">${complete ? '✓' : String(index + 1).padStart(2, '0')}</span><span class="stage-name">${escapeHtml(label)}</span>${stageSummary(index) ? `<span class="stage-summary">${escapeHtml(stageSummary(index))}</span>` : ''}</summary>
      <div id="decision-stage-${index}" class="stage-body">${decisionStepRenderers[index]()}${actions}</div>
    </details>`;
  }).join('');
  main.innerHTML = `${onePageIntro()}
    <section id="decision-work" class="decision-work" data-surface="working-interface" aria-labelledby="decision-work-title">
      <div class="work-heading"><div><h2 id="decision-work-title">Make the decision.</h2><span class="record-lifecycle ${lifecycle.key}">${escapeHtml(lifecycle.label)}</span></div><div class="work-heading-actions"><a id="mobile-overview-action" class="mobile-overview-action quiet-link" href="#how-it-works">Overview</a><span id="decision-save-status" class="save-status" aria-live="polite">${escapeHtml(sourceLabel)}</span></div></div>
      <div class="entry-utilities" data-surface="decision-entry" aria-label="Decision entry options">
        <button id="use-ready-example" class="text-action" type="button">Try an example</button>
        <button id="open-decision-file" class="text-action" data-action="open-saved-decision" type="button">Open a saved decision</button>
        <input id="decision-file-input" type="file" accept="application/json,.json,.fde.json,.fde-draft.json" hidden aria-label="Open a saved decision or in-progress draft backup">
        <button id="toggle-method-words" class="text-action" type="button" aria-pressed="${technicalTermsVisible}">${technicalTermsVisible ? 'Hide technical terms' : 'Show technical terms'}</button>
        <span id="technical-terms-status" class="utility-status" aria-live="polite"></span>
      </div>
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
