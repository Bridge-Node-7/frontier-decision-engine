import { createGuidedDecisionCase, DRAFT_TOPOLOGY_BOUNDS } from './lib/decision.js';
import { GUIDED_MAX_INPUT_CHARS } from './lib/intake.js';
import { DECISION_STORAGE_KEY, getBrowserStorage, saveDecision } from './lib/persistence.js';
import { boundaryForInput } from './lib/input-boundaries.js';
import { deriveDecisionHinge } from './lib/decision-hinge.js';

const MAX_SUGGESTIONS = Object.freeze({ choices: 3, goals: 4, futures: 4 });
const SESSION_KEY = 'fde.universal.session.v1';
const CONTEXT_KEY = 'fde.universal.context.v1';
const HANDOFF_KEY = 'fde.universal.handoff';
const SESSION_VERSION = 1;

const KEYWORDS = {
  goals: [
    ['national security', 'National security'],
    ['mission assurance', 'Mission assurance'],
    ['alliance alignment', 'Alliance alignment'], ['allied alignment', 'Alliance alignment'], ['alliance', 'Alliance alignment'],
    ['legal', 'Legal / regulatory'], ['regulatory', 'Legal / regulatory'],
    ['qualification', 'Qualification'], ['readiness', 'Readiness'], ['interoperability', 'Interoperability'],
    ['sovereignty', 'Sovereignty'], ['resilience', 'Resilience'], ['security', 'Security'],
    ['schedule risk', 'Schedule risk'], ['schedule', 'Schedule risk'],
    ['compliance', 'Compliance'], ['reliable', 'Reliability'], ['reliability', 'Reliability'],
    ['mission performance', 'Mission performance'], ['technical performance', 'Technical performance'],
    ['supply continuity', 'Supply continuity'], ['evidence confidence', 'Evidence confidence'],
    ['time', 'Time'], ['deadline', 'Time'], ['cost', 'Cost'], ['money', 'Cost'], ['price', 'Cost'], ['budget', 'Cost'],
    ['safety', 'Safety'], ['quality', 'Quality'], ['flexibility', 'Flexibility'],
  ],
  futures: [
    ['requirements change', 'Requirements change'], ['requirement changes', 'Requirements change'], ['regulation changes', 'Requirements change'],
    ['cost increases', 'Cost increases'], ['demand changes', 'Demand changes'],
    ['late', 'Timing gets worse'], ['delay', 'Timing gets worse'], ['shortage', 'Availability worsens'],
    ['unavailable', 'A key dependency fails'], ['fails', 'A key dependency fails'], ['failure', 'A key dependency fails'],
    ['expensive', 'Cost increases'], ['improves', 'A key constraint improves'],
  ],
};

const decisionPattern = /should i|should we|do i|do we|whether|which should|choose|decid(?:e|ing)\s+(?:between|whether)/i;
const informationPattern = /^(how much|what is|what's|when is|where is|who is|can you explain|explain|compare|what does|how does|tell me about)\b/i;
function normalize(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function titleFrom(text) {
  const clean = normalize(text).replace(/\s+/g, ' ');
  if (!clean) return '';
  const sentences = clean.split(/(?<=[.!?])\s+|\n+/).map((value) => value.trim()).filter(Boolean);
  const sentence = (sentences.find((value) => decisionPattern.test(value)) || sentences[0] || '')
    .replace(/[.!?]+$/, '')
    .trim();
  return sentence.length > 120 ? `${sentence.slice(0, 117)}…` : sentence;
}

function unique(values, max) {
  return [...new Set(values.map((value) => normalize(value)).filter(Boolean))].slice(0, max);
}

function cleanChoice(value) {
  const clean = normalize(value);
  const institutional = clean.match(/^should\s+the\s+(.{1,40}?)\s+((?:expand|fund|qualify|adopt|select|choose|approve|defer|delay|cancel|continue|stop|start|build|buy|sell|replace|retain|redesign|invest|deploy|launch|contract|renegotiate|renew|terminate)\b.*)$/i);
  if (institutional) {
    const subject = institutional[1].trim();
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} — ${institutional[2].trim()}`;
  }
  return clean
    .replace(/^(?:should\s+(?:i|we)|do\s+(?:i|we))\s+/i, '')
    .replace(/^(?:i(?:'m| am)\s+)?decid(?:e|ing)\s+(?:between|whether)\s+/i, '')
    .replace(/^whether\s+(?:to\s+)?/i, '')
    .trim();
}

function countDecisionCues(text) {
  return (normalize(text).match(/(?:should i|should we|do i|do we|whether)\b/gi) || []).length;
}

function getIntent(text) {
  const clean = normalize(text);
  if (clean && informationPattern.test(clean) && !decisionPattern.test(clean)) return 'information';
  if (countDecisionCues(clean) >= 2) return 'multi';
  return decisionPattern.test(clean) ? 'decision' : 'open';
}

const criteriaClausePattern = /\b(?:care about|what matters|criteria|goals?|priorities|requirements?|matters?|important|must\s+(?:balance|protect|preserve|meet)|need(?:s)?\s+to\s+(?:balance|protect|preserve|meet))\b/i;

function extractListedChoices(text) {
  for (const clause of normalize(text).split(/[.!?\n]+/).map((value) => value.trim()).filter(Boolean)) {
    if (!clause.includes(',') || criteriaClausePattern.test(clause) || !/\b(?:or|and)\b/i.test(clause)) continue;
    const body = clause
      .replace(/^(?:should\s+(?:i|we)\s+(?:choose|pick|select|use|pursue|qualify)\s+|choose\s+(?:between\s+)?|decid(?:e|ing)\s+between\s+|we\s+can\s+)/i, '')
      .trim();
    const parts = body
      .split(/\s*,\s*(?:\b(?:or|and)\b\s*)?|\s+\b(?:or|and)\b\s+/i)
      .map((value) => cleanChoice(value).replace(/\bwhich\s+should\s+(?:i|we)\s+choose\b.*$/i, '').trim())
      .filter((value) => value.length >= 2);
    if (parts.length >= 3) return [...new Set(parts)];
  }
  return [];
}

function hasUnresolvedOptionList(text) {
  return extractListedChoices(text).length > MAX_SUGGESTIONS.choices;
}

function extractChoices(text) {
  const choices = [];
  const clauses = normalize(text).split(/[.!?\n]+/).map((value) => value.trim()).filter(Boolean);
  for (const clause of clauses) {
    const decisionLike = decisionPattern.test(clause) || /^(?:should\b|choose|pick|select|decide)\b/i.test(clause);
    if (!decisionLike) continue;
    for (const match of clause.matchAll(/(?:either\s+)?([^\n,.!?]{2,80})\s+(?:or|versus|vs\.?|instead of)\s+([^\n,.!?]{2,80})/gi)) {
      choices.push(cleanChoice(match[1]), cleanChoice(match[2]));
    }
  }
  const numbered = [...text.matchAll(/(?:^|\n)\s*(?:\d+[.)]?|[-*•])\s+([^\n]{2,100})/g)]
    .map((match) => cleanChoice(match[1]));
  return unique([...choices, ...numbered], MAX_SUGGESTIONS.choices);
}

function phraseMatches(text, needle) {
  const escaped = needle.trim().split(/\s+/).join('\\s+');
  const pattern = new RegExp('(^|[^\\p{L}\\p{N}_])(' + escaped + ')(?=$|[^\\p{L}\\p{N}_])', 'giu');
  return [...String(text).matchAll(pattern)].map((match) => {
    const start = match.index + match[1].length;
    return { start, end: start + match[2].length };
  });
}

function extractKeywordLabels(text, entries, max) {
  const matches = [];
  for (const [needle, label] of entries) {
    for (const span of phraseMatches(text, needle)) matches.push({ ...span, needle, label });
  }
  matches.sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start));
  const selected = [];
  const occupied = [];
  for (const match of matches) {
    if (occupied.some((span) => match.start < span.end && match.end > span.start)) continue;
    if (!selected.includes(match.label)) selected.push(match.label);
    occupied.push({ start: match.start, end: match.end });
    if (selected.length >= max) break;
  }
  return selected;
}

function extractGoals(text) {
  return extractKeywordLabels(text, KEYWORDS.goals, MAX_SUGGESTIONS.goals);
}

function criterionLabel(value) {
  const clean = normalize(value)
    .replace(/^(?:and|or)\s+/i, '')
    .replace(/[;:]+$/g, '')
    .trim();
  if (!clean) return '';
  const recognized = extractKeywordLabels(clean, KEYWORDS.goals, 1);
  if (recognized.length) return recognized[0];
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function extractExplicitCriteria(text) {
  const criteria = [];
  const clauses = normalize(text).split(/[.!?\n]+/).map((value) => value.trim()).filter(Boolean);
  const prefixCue = /\b(?:care about|what matters(?: most)?(?: is| are)?|(?:criteria|goals?|priorities|requirements?)\s+(?:are|include)|(?:must|need(?:s)?\s+to)\s+(?:balance|protect|preserve|meet))\b/i;
  const suffixCue = /\b(?:matter|matters|are important|is important)\s*$/i;

  for (const clause of clauses) {
    if (!prefixCue.test(clause) && !suffixCue.test(clause)) continue;
    let body = clause
      .replace(/^.*?\bcare about\b\s*/i, '')
      .replace(/^.*?\bwhat matters(?: most)?(?: is| are)?\b\s*/i, '')
      .replace(/^.*?\b(?:criteria|goals?|priorities|requirements?)\s+(?:are|include)\b\s*/i, '')
      .replace(/^.*?\b(?:must|need(?:s)?\s+to)\s+(?:balance|protect|preserve|meet)\b\s*/i, '')
      .replace(/\s+\b(?:matter|matters|are important|is important)\b\s*$/i, '')
      .trim();
    if (!body) continue;
    const items = body
      .split(/\s*,\s*(?:\b(?:and|or)\b\s*)?|\s+\b(?:and|or)\b\s+/i)
      .map((value) => criterionLabel(value))
      .filter((value) => value.length >= 2);
    criteria.push(...items);
  }
  return [...new Set(criteria)];
}

function extractFutures(text) {
  return extractKeywordLabels(text, KEYWORDS.futures, MAX_SUGGESTIONS.futures);
}

function splitUserItems(text, max) {
  const clean = normalize(text);
  if (!clean) return [];
  return unique(
    clean
      .split(/\n|;|,|\s+\bor\b\s+/i)
      .map((item) => item.replace(/^\s*(?:\d+[.)]?|[-*•])\s*/, '').trim()),
    max,
  );
}

export function draftFromInput(text) {
  const clean = normalize(text);
  const intent = getIntent(clean);
  const listedChoices = extractListedChoices(clean);
  const detectedChoiceCount = listedChoices.length;
  const optionListAmbiguous = detectedChoiceCount > MAX_SUGGESTIONS.choices;
  const choices = optionListAmbiguous ? [] : unique([...extractChoices(clean), ...listedChoices], MAX_SUGGESTIONS.choices);
  const explicitCriteria = extractExplicitCriteria(clean);
  const detectedCriterionCount = explicitCriteria.length;
  const criteriaListAmbiguous = detectedCriterionCount > MAX_SUGGESTIONS.goals;
  const goals = criteriaListAmbiguous
    ? []
    : unique([...extractGoals(clean), ...explicitCriteria], MAX_SUGGESTIONS.goals);
  const futures = extractFutures(clean);
  const possibleDecision = intent !== 'multi' && (decisionPattern.test(clean) || (choices.length >= 2 && clean.includes('?'))) ? titleFrom(clean) : '';
  return {
    startingPoint: clean,
    intent,
    possibleDecision,
    optionListAmbiguous,
    detectedChoiceCount,
    criteriaListAmbiguous,
    detectedCriterionCount,
    hingeCandidate: deriveDecisionHinge(clean),
    choices,
    goals,
    futures,
  };
}

export function responseFor(state) {
  const clean = normalize(state?.startingPoint);
  const boundary = boundaryForInput(clean);
  if (boundary) {
    return { kind: 'boundary', title: boundary.title, body: boundary.body };
  }
  if (state?.optionListAmbiguous) {
    const count = Number(state.detectedChoiceCount) || 4;
    return { kind: 'question', question: `I found ${count} possible choices. Choose up to ${MAX_SUGGESTIONS.choices} to compare.` };
  }
  if (state?.criteriaListAmbiguous) {
    const count = Number(state.detectedCriterionCount) || (MAX_SUGGESTIONS.goals + 1);
    return { kind: 'question', question: `I found ${count} possible criteria. Choose up to ${MAX_SUGGESTIONS.goals} to keep.` };
  }
  if (!clean || (!state?.possibleDecision && state?.intent !== 'information' && state?.intent !== 'multi')) {
    return { kind: 'question', question: 'Which decision or question should we focus on?' };
  }
  if (state.intent === 'information') {
    return {
      kind: 'boundary',
      title: 'FDE compares decisions; it does not retrieve outside facts.',
      body: 'Gather the fact first, or state the decision that fact will inform.',
    };
  }
  if (state.intent === 'multi') {
    return { kind: 'question', question: 'Which decision or question should we focus on first?' };
  }
  return { kind: 'structure' };
}

function storage() {
  try { return globalThis.sessionStorage || null; } catch { return null; }
}

function saveSession(state) {
  try {
    storage()?.setItem(SESSION_KEY, JSON.stringify({ version: SESSION_VERSION, ...state }));
    return true;
  } catch {
    return false;
  }
}

function loadSession() {
  try {
    const raw = storage()?.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.version === SESSION_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function clearSession() {
  try { storage()?.removeItem(SESSION_KEY); } catch { /* no-op */ }
}

function hingeTarget(state) {
  const hinge = state.hingeCandidate;
  if (!hinge || state.hingeStatus) return '';
  if (['hard_requirement', 'deadline'].includes(hinge.basis_type)) {
    if (state.goals.includes(hinge.text)) return '';
    return state.goals.length < MAX_SUGGESTIONS.goals ? 'goals' : '';
  }
  if (state.futures.includes(hinge.text)) return '';
  return state.futures.length < MAX_SUGGESTIONS.futures ? 'futures' : '';
}

function hingeQuestion(state) {
  if (['hard_requirement', 'deadline'].includes(state.hingeCandidate?.basis_type)) {
    return 'Does this condition need to be true for the decision?';
  }
  return 'Could this condition change which choice holds up?';
}

function missingRequirement(state) {
  if (state.choices.length < DRAFT_TOPOLOGY_BOUNDS.strategies.min) return 'choices';
  if (state.goals.length < DRAFT_TOPOLOGY_BOUNDS.objectives.min) return 'goals';
  if (state.futures.length < DRAFT_TOPOLOGY_BOUNDS.scenarios.min) return 'futures';
  return '';
}

function nextQuestion(state, kind) {
  if (kind === 'choices') return state.choices.length === 1 ? 'What is one other choice to compare?' : 'What choices should we compare?';
  if (kind === 'goals') return state.goals.length === 1 ? 'What else matters when comparing these choices?' : 'What matters most when comparing these choices?';
  if (kind === 'futures') return state.futures.length === 1 ? 'What else could change the choice?' : 'What conditions or uncertainties could change the choice?';
  return 'Which decision or question should we focus on?';
}

function supportableSection(label, semantic, value) {
  if (Array.isArray(value)) {
    if (!value.length) return '';
    return `<section class="universal-field" data-fde-field="${semantic}"><h3>${escapeHtml(label)}</h3><ul>${value.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`;
  }
  if (!normalize(value)) return '';
  return `<section class="universal-field" data-fde-field="${semantic}"><h3>${escapeHtml(label)}</h3><p>${escapeHtml(value)}</p></section>`;
}

function hingeMarkup(state) {
  const hinge = state.hingeCandidate;
  if (!hinge) return '';
  const status = state.hingeStatus === 'yes'
    ? 'You confirmed'
    : state.hingeStatus === 'no'
      ? 'You did not keep this as a controlling condition'
      : state.hingeStatus === 'not_sure'
        ? 'You marked this as uncertain'
        : 'FDE suggests';
  return `<section class="universal-hinge" data-fde-field="decision_hinge">
    <div class="universal-hinge-meta"><span>${escapeHtml(status)}</span><span>From your words</span></div>
    <h3>This decision may turn on</h3>
    <p>${escapeHtml(hinge.text)}</p>
  </section>`;
}

function entryMarkup(state, hasSavedDecision) {
  return `<section class="universal-hero universal-front-door" data-surface="fde-hero" aria-labelledby="universal-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <h1 id="universal-title">What are you considering?</h1>
    <p class="universal-subtitle">Share the situation, decision, question, or context in your own words.</p>
    <div class="universal-entry">
      <label class="sr-only" for="universal-input">What are you considering?</label>
      <textarea id="universal-input" rows="7" aria-describedby="universal-help universal-limit" placeholder="Decision, choices, criteria, uncertainties, notes, or context…">${escapeHtml(state.startingPoint)}</textarea>
      <p id="universal-help" class="help">Use your own words. Press Ctrl or Command + Enter to continue. Natural-language intake currently supports English.</p>
      <p id="universal-limit" class="universal-limit" role="status" hidden></p>
      <div class="universal-actions"><button id="universal-analyze" class="primary" type="button">Continue</button></div>
      <details class="universal-advanced"><summary>Advanced paths</summary><p><a href="#/decision">Already know the decision and choices? Open Decision Lab →</a></p><p><a href="#/framing">Need more help framing the decision? Use guided framing →</a></p></details>
      ${hasSavedDecision ? '<p class="universal-return"><a href="#/decision">Continue saved work →</a></p>' : ''}
      <p class="universal-trust">Private by design. Your working decision stays in this browser unless you choose to export it.</p>
      <p id="universal-status" class="sr-only" role="status" aria-live="polite"></p>
    </div>
  </section>`;
}

function structureMarkup(state) {
  return `<section class="universal-hero universal-post-input" data-surface="fde-hero" aria-labelledby="universal-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <h1 id="universal-title">What are you considering?</h1>
    <div class="universal-structure" data-fde-status="needs-confirmation" aria-labelledby="universal-response-title">
      <div class="universal-structure-head"><h2 id="universal-response-title">Decision structure</h2><span class="universal-badge">Needs confirmation</span></div>
      ${hingeMarkup(state)}
      ${supportableSection('Decision', 'decision', state.possibleDecision)}
      ${supportableSection('What matters', 'what_matters', state.goals)}
      ${supportableSection('Choices', 'options', state.choices)}
      ${supportableSection('What may change', 'what_may_change', state.futures)}
      <div class="universal-confirmation" data-fde-field="next_required_input">
        <h3>Is this the decision you want to evaluate?</h3>
        <div class="universal-confirm-row"><button id="universal-confirm" class="primary" type="button">Yes</button><button id="universal-adjust" class="quiet" type="button">Adjust</button></div>
      </div>
      <p class="universal-trust">Private by design. Your working decision stays in this browser unless you choose to export it.</p>
      <p id="universal-status" class="sr-only" role="status" aria-live="polite"></p>
    </div>
  </section>`;
}

function questionMarkup(state, question) {
  return `<section class="universal-hero universal-post-input" data-surface="fde-hero" aria-labelledby="universal-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <h1 id="universal-title">What are you considering?</h1>
    <section class="universal-question" data-fde-field="next_required_input" aria-labelledby="universal-response-title">
      <h2 id="universal-response-title">${escapeHtml(question)}</h2>
      <label class="sr-only" for="universal-input">${escapeHtml(question)}</label>
      <textarea id="universal-input" rows="5" aria-describedby="universal-help universal-limit" placeholder="Add only what is needed here…">${escapeHtml(state.answerDraft || '')}</textarea>
      <p id="universal-help" class="help">One useful answer is enough to continue.</p>
      <p id="universal-limit" class="universal-limit" role="status" hidden></p>
      <div class="universal-actions"><button id="universal-analyze" class="primary" type="button">Continue</button><button id="universal-adjust" class="quiet" type="button">Adjust original input</button></div>
      <p class="universal-trust">Private by design. Your working decision stays in this browser unless you choose to export it.</p>
      <p id="universal-status" class="sr-only" role="status" aria-live="polite"></p>
    </section>
  </section>`;
}

function hingeQuestionMarkup(state) {
  const hinge = state.hingeCandidate;
  return `<section class="universal-hero universal-post-input" data-surface="fde-hero" aria-labelledby="universal-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <h1 id="universal-title">What are you considering?</h1>
    <section class="universal-question universal-hinge-question" data-fde-field="next_required_input" aria-labelledby="universal-response-title">
      <div class="universal-hinge-meta"><span>FDE suggests</span><span>From your words</span></div>
      <h2 id="universal-response-title">${escapeHtml(hingeQuestion(state))}</h2>
      <p class="universal-hinge-quote">${escapeHtml(hinge?.text || '')}</p>
      <div class="universal-confirm-row">
        <button data-hinge-answer="yes" class="primary" type="button">Yes</button>
        <button data-hinge-answer="no" class="quiet" type="button">No</button>
        <button data-hinge-answer="not_sure" class="quiet" type="button">Not sure</button>
      </div>
      <div class="universal-actions"><button id="universal-adjust" class="quiet" type="button">Adjust original input</button></div>
      <p class="universal-trust">FDE is organizing your input. You remain the decision-maker.</p>
      <p id="universal-status" class="sr-only" role="status" aria-live="polite"></p>
    </section>
  </section>`;
}

function boundaryMarkup(state, title, body, saved = false) {
  return `<section class="universal-hero universal-post-input" data-surface="fde-hero" aria-labelledby="universal-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <h1 id="universal-title">What are you considering?</h1>
    <section class="universal-boundary" data-fde-status="boundary" aria-labelledby="universal-response-title">
      <h2 id="universal-response-title">${escapeHtml(title)}</h2>
      <p>${escapeHtml(body)}</p>
      <div class="universal-actions">${saved ? '<a class="button" href="#/decision">Open Decision Lab →</a>' : '<button id="universal-adjust" class="primary" type="button">Adjust</button>'}</div>
      <p class="universal-trust">Private by design. Your working decision stays in this browser unless you choose to export it.</p>
      <p id="universal-status" class="sr-only" role="status" aria-live="polite"></p>
    </section>
  </section>`;
}

export function renderUniversalDecisionExperience(root) {
  const restored = loadSession() || {};
  const state = {
    startingPoint: normalize(restored.startingPoint || ''),
    intent: restored.intent || '',
    possibleDecision: restored.possibleDecision || '',
    optionListAmbiguous: Boolean(restored.optionListAmbiguous),
    detectedChoiceCount: Number(restored.detectedChoiceCount) || 0,
    criteriaListAmbiguous: Boolean(restored.criteriaListAmbiguous),
    detectedCriterionCount: Number(restored.detectedCriterionCount) || 0,
    hingeCandidate: restored.hingeCandidate || null,
    hingeStatus: restored.hingeStatus || '',
    hingeApplied: Boolean(restored.hingeApplied),
    choices: Array.isArray(restored.choices) ? restored.choices.slice(0, MAX_SUGGESTIONS.choices) : [],
    goals: Array.isArray(restored.goals) ? restored.goals.slice(0, MAX_SUGGESTIONS.goals) : [],
    futures: Array.isArray(restored.futures) ? restored.futures.slice(0, MAX_SUGGESTIONS.futures) : [],
    view: ['entry', 'structure', 'question', 'boundary'].includes(restored.view) ? restored.view : 'entry',
    questionKind: restored.questionKind || '',
    question: restored.question || '',
    boundaryTitle: restored.boundaryTitle || '',
    boundaryBody: restored.boundaryBody || '',
    savedBoundary: Boolean(restored.savedBoundary),
    answerDraft: normalize(restored.answerDraft || ''),
  };

  const hasSavedDecision = () => Boolean(getBrowserStorage(globalThis)?.getItem?.(DECISION_STORAGE_KEY));

  function setBoundary(title, body, saved = false) {
    state.view = 'boundary';
    state.boundaryTitle = title;
    state.boundaryBody = body;
    state.savedBoundary = saved;
    state.questionKind = '';
    state.question = '';
    state.answerDraft = '';
    saveSession(state);
    paint('#universal-response-title');
  }

  function setQuestion(kind, question = '') {
    state.view = 'question';
    state.questionKind = kind;
    state.question = question || nextQuestion(state, kind);
    state.answerDraft = '';
    saveSession(state);
    paint('#universal-response-title');
  }

  function returnToEntry() {
    state.view = 'entry';
    state.questionKind = '';
    state.question = '';
    state.boundaryTitle = '';
    state.boundaryBody = '';
    state.savedBoundary = false;
    state.answerDraft = '';
    state.hingeCandidate = null;
    state.hingeStatus = '';
    state.hingeApplied = false;
    saveSession(state);
    paint('#universal-input');
  }

  function handoffWhenReady() {
    const hingeNext = hingeTarget(state);
    if (hingeNext) {
      setQuestion('hinge', hingeQuestion(state));
      return;
    }
    const missing = missingRequirement(state);
    if (missing) {
      setQuestion(missing);
      return;
    }
    if (hasSavedDecision()) {
      setBoundary('A saved FDE decision already exists.', 'Open Decision Lab to review it before replacing anything.', true);
      return;
    }
    const counts = { objectives: state.goals.length, strategies: state.choices.length, scenarios: state.futures.length };
    const withinBounds = counts.objectives >= DRAFT_TOPOLOGY_BOUNDS.objectives.min
      && counts.objectives <= DRAFT_TOPOLOGY_BOUNDS.objectives.max
      && counts.strategies >= DRAFT_TOPOLOGY_BOUNDS.strategies.min
      && counts.strategies <= DRAFT_TOPOLOGY_BOUNDS.strategies.max
      && counts.scenarios >= DRAFT_TOPOLOGY_BOUNDS.scenarios.min
      && counts.scenarios <= DRAFT_TOPOLOGY_BOUNDS.scenarios.max;
    if (!withinBounds || !state.possibleDecision) {
      setQuestion(missing || 'decision');
      return;
    }
    const decision = createGuidedDecisionCase({
      objectiveCount: counts.objectives,
      strategyCount: counts.strategies,
      scenarioCount: counts.scenarios,
    });
    decision.question = state.possibleDecision;
    decision.title = state.possibleDecision.slice(0, 120);
    state.goals.forEach((label, index) => { decision.objectives[index].label = label; });
    state.choices.forEach((label, index) => { decision.strategies[index].label = label; });
    state.futures.forEach((label, index) => { decision.scenarios[index].label = label; });
    const result = saveDecision(getBrowserStorage(globalThis), decision, null);
    if (!result.ok) {
      setBoundary('FDE could not save this browser-local draft.', 'Keep this page open, review browser storage settings, then try again.');
      return;
    }
    clearSession();
    try {
      storage()?.setItem(CONTEXT_KEY, JSON.stringify({ version: 1, startingPoint: state.startingPoint }));
      storage()?.setItem(HANDOFF_KEY, '1');
    } catch { /* optional */ }
    location.hash = '#/decision';
  }

  function showInputLimit() {
    const message = root.querySelector('#universal-limit');
    if (message) {
      message.hidden = false;
      message.textContent = `This is longer than FDE can safely structure at once. Choose or paste the section containing the decision, question, or conditions you want to evaluate, and keep it under ${GUIDED_MAX_INPUT_CHARS.toLocaleString()} characters.`;
    }
    root.querySelector('#universal-input')?.focus({ preventScroll: true });
  }

  function analyzeEntry() {
    const raw = String(root.querySelector('#universal-input')?.value || '');
    if (raw.length > GUIDED_MAX_INPUT_CHARS) {
      state.startingPoint = normalize(raw.slice(0, GUIDED_MAX_INPUT_CHARS + 1));
      saveSession(state);
      showInputLimit();
      return;
    }
    state.startingPoint = normalize(raw);
    const draft = draftFromInput(state.startingPoint);
    Object.assign(state, draft, { hingeStatus: '', hingeApplied: false });
    const response = responseFor(state);
    if (response.kind === 'question') {
      setQuestion(state.optionListAmbiguous ? 'choices' : state.criteriaListAmbiguous ? 'goals' : 'decision', response.question);
      return;
    }
    if (response.kind === 'boundary') {
      setBoundary(response.title, response.body);
      return;
    }
    state.view = 'structure';
    state.questionKind = '';
    state.question = '';
    state.answerDraft = '';
    saveSession(state);
    paint('#universal-response-title');
  }

  function applyHingeAnswer(answer) {
    const hinge = state.hingeCandidate;
    if (!hinge || !['yes', 'no', 'not_sure'].includes(answer)) return;
    state.hingeStatus = answer;
    state.hingeApplied = false;
    if (answer === 'yes' && ['hard_requirement', 'deadline'].includes(hinge.basis_type) && state.goals.length < MAX_SUGGESTIONS.goals) {
      const before = state.goals.length;
      state.goals = unique([...state.goals, hinge.text], MAX_SUGGESTIONS.goals);
      state.hingeApplied = state.goals.length > before;
    } else if (answer === 'yes' && state.futures.length < MAX_SUGGESTIONS.futures) {
      const before = state.futures.length;
      state.futures = unique([...state.futures, hinge.text], MAX_SUGGESTIONS.futures);
      state.hingeApplied = state.futures.length > before;
    } else if (answer === 'not_sure' && state.futures.length < MAX_SUGGESTIONS.futures) {
      const before = state.futures.length;
      state.futures = unique([...state.futures, hinge.text], MAX_SUGGESTIONS.futures);
      state.hingeApplied = state.futures.length > before;
    }
    state.questionKind = '';
    state.question = '';
    state.answerDraft = '';
    saveSession(state);
    handoffWhenReady();
  }

  function applyQuestionAnswer() {
    const raw = String(root.querySelector('#universal-input')?.value || '');
    if (raw.length > GUIDED_MAX_INPUT_CHARS) {
      showInputLimit();
      return;
    }
    const answer = normalize(raw);
    state.answerDraft = answer;
    if (!answer) {
      saveSession(state);
      paint('#universal-response-title');
      return;
    }

    // A complete new decision entered during a follow-up replaces the prior
    // intake context instead of inheriting choices, goals, or uncertainties.
    const replacementDraft = draftFromInput(answer);
    const answerDefinesNewFocus = Boolean(replacementDraft.possibleDecision)
      || replacementDraft.intent === 'multi'
      || replacementDraft.intent === 'information';
    if (answerDefinesNewFocus) {
      Object.assign(state, replacementDraft, { hingeStatus: '', hingeApplied: false });
      const replacementResponse = responseFor(state);
      if (replacementResponse.kind === 'question') {
        setQuestion(state.optionListAmbiguous ? 'choices' : state.criteriaListAmbiguous ? 'goals' : 'decision', replacementResponse.question);
        return;
      }
      if (replacementResponse.kind === 'boundary') {
        setBoundary(replacementResponse.title, replacementResponse.body);
        return;
      }
      state.view = 'structure';
      state.questionKind = '';
      state.question = '';
      state.answerDraft = '';
      saveSession(state);
      paint('#universal-response-title');
      return;
    }

    if (state.questionKind === 'decision') {
      const draft = draftFromInput(answer);
      state.startingPoint = state.startingPoint ? `${state.startingPoint}\n${answer}` : answer;
      Object.assign(state, {
        intent: draft.intent,
        possibleDecision: draft.possibleDecision,
        choices: unique([...state.choices, ...draft.choices], MAX_SUGGESTIONS.choices),
        goals: unique([...state.goals, ...draft.goals], MAX_SUGGESTIONS.goals),
        futures: unique([...state.futures, ...draft.futures], MAX_SUGGESTIONS.futures),
      });
      if (!state.possibleDecision) {
        state.question = 'Which decision should FDE evaluate?';
        state.answerDraft = '';
        saveSession(state);
        paint('#universal-response-title');
        return;
      }
      state.view = 'structure';
      state.questionKind = '';
      state.question = '';
      state.answerDraft = '';
      saveSession(state);
      paint('#universal-response-title');
      return;
    }
    if (state.questionKind === 'choices') state.choices = unique([...state.choices, ...splitUserItems(answer, MAX_SUGGESTIONS.choices)], MAX_SUGGESTIONS.choices);
    if (state.questionKind === 'goals') {
      state.goals = unique([...state.goals, ...splitUserItems(answer, MAX_SUGGESTIONS.goals)], MAX_SUGGESTIONS.goals);
      state.criteriaListAmbiguous = false;
      state.detectedCriterionCount = state.goals.length;
    }
    if (state.questionKind === 'futures') state.futures = unique([...state.futures, ...splitUserItems(answer, MAX_SUGGESTIONS.futures)], MAX_SUGGESTIONS.futures);
    state.answerDraft = '';
    const missing = missingRequirement(state);
    if (missing) {
      setQuestion(missing);
      return;
    }
    handoffWhenReady();
  }

  function paint(focusSelector = '') {
    if (state.view === 'structure') root.innerHTML = structureMarkup(state);
    else if (state.view === 'question' && state.questionKind === 'hinge') root.innerHTML = hingeQuestionMarkup(state);
    else if (state.view === 'question') root.innerHTML = questionMarkup(state, state.question || nextQuestion(state, state.questionKind));
    else if (state.view === 'boundary') root.innerHTML = boundaryMarkup(state, state.boundaryTitle, state.boundaryBody, state.savedBoundary);
    else root.innerHTML = entryMarkup(state, hasSavedDecision());

    root.querySelector('#universal-input')?.addEventListener('input', (event) => {
      const rawValue = String(event.currentTarget.value || '');
      const value = rawValue.slice(0, GUIDED_MAX_INPUT_CHARS + 1);
      if (state.view === 'entry') state.startingPoint = value;
      else state.answerDraft = value;
      const limit = root.querySelector('#universal-limit');
      if (limit && rawValue.length <= GUIDED_MAX_INPUT_CHARS) limit.hidden = true;
      saveSession(state);
    });
    root.querySelector('#universal-input')?.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (state.view === 'entry') analyzeEntry();
        else if (state.view === 'question') applyQuestionAnswer();
      }
    });
    root.querySelector('#universal-analyze')?.addEventListener('click', () => {
      if (state.view === 'entry') analyzeEntry();
      else if (state.view === 'question') applyQuestionAnswer();
    });
    root.querySelector('#universal-adjust')?.addEventListener('click', returnToEntry);
    root.querySelector('#universal-confirm')?.addEventListener('click', handoffWhenReady);
    root.querySelectorAll('[data-hinge-answer]').forEach((button) => button.addEventListener('click', () => applyHingeAnswer(button.dataset.hingeAnswer)));

    if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
  }

  paint(state.view === 'entry' ? '#universal-title' : '#universal-response-title');
}
