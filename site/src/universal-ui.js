import { createGuidedDecisionCase, DRAFT_TOPOLOGY_BOUNDS } from './lib/decision.js';
import { RESCUE_MAX_INPUT_CHARS } from './lib/intake.js';
import { DECISION_STORAGE_KEY, getBrowserStorage, saveDecision } from './lib/persistence.js';

const MAX_SUGGESTIONS = Object.freeze({ choices: 3, goals: 4, futures: 4 });
const SESSION_KEY = 'fde.universal.session.v1';
const CONTEXT_KEY = 'fde.universal.context.v1';
const HANDOFF_KEY = 'fde.universal.handoff';
const SESSION_VERSION = 1;

const KEYWORDS = {
  goals: [
    ['time', 'Time'], ['deadline', 'Time'], ['cost', 'Cost'], ['money', 'Cost'], ['price', 'Cost'], ['budget', 'Cost'],
    ['safety', 'Safety'], ['quality', 'Quality'], ['reliable', 'Reliability'], ['reliability', 'Reliability'],
    ['people', 'People'], ['team', 'People'], ['customer', 'Customer'], ['customers', 'Customer'], ['revenue', 'Revenue'],
    ['flexibility', 'Flexibility'], ['compliance', 'Compliance'],
  ],
  futures: [
    ['late', 'Timing gets worse'], ['delay', 'Timing gets worse'], ['shortage', 'Availability worsens'],
    ['unavailable', 'A key dependency fails'], ['fails', 'A key dependency fails'], ['failure', 'A key dependency fails'],
    ['expensive', 'Cost increases'], ['cost increases', 'Cost increases'], ['demand changes', 'Demand changes'],
    ['requirement changes', 'Requirements change'], ['requirements change', 'Requirements change'], ['regulation changes', 'Requirements change'],
    ['improves', 'A key constraint improves'],
  ],
};

const decisionPattern = /should i|should we|do i|do we|whether|which should|choose|decid(?:e|ing)\s+(?:between|whether)/i;
const informationPattern = /^(how much|what is|what's|when is|where is|who is|can you explain|what does|how does|tell me about)\b/i;
const treatmentActionPattern = /\b(?:stop|start|skip|miss|discontinue|quit|change|adjust|increase|decrease|reduce|raise|lower|halve|double|ration|taper|pause|delay)\b/i;
const treatmentSubjectPattern = /\b(?:medication|medicine|prescription|dose|treatment|therapy|insulin|chemotherapy|antidepressants?|antibiotics?|inhaler|steroids?|hormones?)\b/i;
const dangerousRestrictionPattern = /\b(?:stop\s+eating|starv(?:e|ing)(?:\s+myself)?|skip\s+(?:all\s+)?meals?|not\s+eat(?:ing)?|fast(?:ing)?\s+(?:for\s+)?(?:(?:[2-9]|[1-9]\d+)\s+days?|(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+days?|(?:a|one|two|three|four)\s+weeks?))\b/i;

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
  const sentence = clean.split(/[.!?\n]/)[0].trim();
  return sentence.length > 120 ? `${sentence.slice(0, 117)}…` : sentence;
}

function unique(values, max) {
  return [...new Set(values.map((value) => normalize(value)).filter(Boolean))].slice(0, max);
}

function cleanChoice(value) {
  return normalize(value)
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

function hasUnresolvedOptionList(text) {
  const listish = /([^\n.!?;:]{2,200}?,[^\n.!?;:]{2,200}?)\s*,?\s*\b(?:or|and)\s+([^\n.!?;:]{2,80})/i;
  const match = listish.exec(text);
  if (!match) return false;
  return match[1].split(',').filter((value) => value.trim().length >= 2).length >= 2;
}

function hasTreatmentChangeRequest(text) {
  const clean = normalize(text);
  return treatmentActionPattern.test(clean) && treatmentSubjectPattern.test(clean);
}

function hasDangerousRestrictionRequest(text) {
  return dangerousRestrictionPattern.test(normalize(text));
}

function extractChoices(text) {
  const choices = [];
  for (const match of text.matchAll(/(?:either\s+)?([^\n,.!?]{2,80})\s+(?:or|versus|vs\.?|instead of)\s+([^\n,.!?]{2,80})/gi)) {
    choices.push(cleanChoice(match[1]), cleanChoice(match[2]));
  }
  const numbered = [...text.matchAll(/(?:^|\n)\s*(?:\d+[.)]?|[-*•])\s+([^\n]{2,100})/g)]
    .map((match) => cleanChoice(match[1]));
  return unique([...choices, ...numbered], MAX_SUGGESTIONS.choices);
}

function extractGoals(text) {
  const lower = text.toLowerCase();
  return unique(KEYWORDS.goals.filter(([needle]) => lower.includes(needle)).map(([, label]) => label), MAX_SUGGESTIONS.goals);
}

function extractFutures(text) {
  const lower = text.toLowerCase();
  return unique(KEYWORDS.futures.filter(([needle]) => lower.includes(needle)).map(([, label]) => label), MAX_SUGGESTIONS.futures);
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
  const optionListAmbiguous = hasUnresolvedOptionList(clean);
  const choices = optionListAmbiguous ? [] : extractChoices(clean);
  const goals = extractGoals(clean);
  const futures = extractFutures(clean);
  const possibleDecision = intent !== 'multi' && (decisionPattern.test(clean) || (choices.length >= 2 && clean.includes('?'))) ? titleFrom(clean) : '';
  return {
    startingPoint: clean,
    intent,
    possibleDecision,
    optionListAmbiguous,
    choices,
    goals,
    futures,
  };
}

export function responseFor(state) {
  const clean = normalize(state?.startingPoint);
  if (hasTreatmentChangeRequest(clean)) {
    return {
      kind: 'boundary',
      title: 'Treatment changes need qualified clinical guidance.',
      body: 'FDE should not recommend starting, stopping, skipping, rationing, or changing prescribed treatment. A qualified clinician should guide treatment changes. FDE can still help structure cost, access, logistics, and questions to discuss with that clinician.',
    };
  }
  if (hasDangerousRestrictionRequest(clean)) {
    return {
      kind: 'boundary',
      title: 'Dangerous food restriction is outside FDE’s decision-comparison scope.',
      body: 'FDE should not compare or optimize starvation, severe food restriction, or multi-day fasting as a decision. If this is about health, weight, or food restriction, qualified health guidance is the appropriate next step. FDE can still help structure safer questions about access, scheduling, or support.',
    };
  }
  if (state?.optionListAmbiguous) {
    return { kind: 'question', question: 'What options should we compare?' };
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

function missingRequirement(state) {
  if (state.choices.length < DRAFT_TOPOLOGY_BOUNDS.strategies.min) return 'choices';
  if (state.goals.length < DRAFT_TOPOLOGY_BOUNDS.objectives.min) return 'goals';
  if (state.futures.length < DRAFT_TOPOLOGY_BOUNDS.scenarios.min) return 'futures';
  return '';
}

function nextQuestion(state, kind) {
  if (kind === 'choices') return state.choices.length === 1 ? 'What is one other option to compare?' : 'What options should we compare?';
  if (kind === 'goals') return state.goals.length === 1 ? 'What else matters when comparing these options?' : 'What matters most when comparing these options?';
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

function entryMarkup(state, hasSavedDecision) {
  return `<section class="universal-hero universal-front-door" data-surface="fde-hero" aria-labelledby="universal-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <h1 id="universal-title">What are you considering?</h1>
    <p class="universal-subtitle">Share a situation, decision, question, or context in your own words.</p>
    <div class="universal-entry">
      <label class="sr-only" for="universal-input">What are you considering?</label>
      <textarea id="universal-input" maxlength="${RESCUE_MAX_INPUT_CHARS}" rows="7" aria-describedby="universal-help" placeholder="Decision, question, options, constraints, notes, or other context…">${escapeHtml(state.startingPoint)}</textarea>
      <p id="universal-help" class="help">Use your own words. Press Ctrl or Command + Enter to continue. Natural-language intake currently supports English.</p>
      <div class="universal-actions"><button id="universal-analyze" class="primary" type="button">Continue</button></div>
      <p class="universal-lab-link"><a href="#/decision">Already know the decision and options? Open Decision Lab →</a></p>
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
      ${supportableSection('Decision', 'decision', state.possibleDecision)}
      ${supportableSection('What matters', 'what_matters', state.goals)}
      ${supportableSection('Options', 'options', state.choices)}
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
      <textarea id="universal-input" maxlength="${RESCUE_MAX_INPUT_CHARS}" rows="5" aria-describedby="universal-help" placeholder="Add only what is needed here…">${escapeHtml(state.answerDraft || '')}</textarea>
      <p id="universal-help" class="help">One useful answer is enough to continue.</p>
      <div class="universal-actions"><button id="universal-analyze" class="primary" type="button">Continue</button><button id="universal-adjust" class="quiet" type="button">Adjust original input</button></div>
      <p class="universal-trust">Private by design. Your working decision stays in this browser unless you choose to export it.</p>
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
    saveSession(state);
    paint('#universal-input');
  }

  function handoffWhenReady() {
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

  function analyzeEntry() {
    const raw = String(root.querySelector('#universal-input')?.value || '');
    state.startingPoint = normalize(raw);
    if (state.startingPoint.length > RESCUE_MAX_INPUT_CHARS) {
      setBoundary(
        'This input is longer than this browser-local working note supports.',
        `Shorten it to the decision-relevant context and keep it under ${RESCUE_MAX_INPUT_CHARS.toLocaleString()} characters.`,
      );
      return;
    }
    const draft = draftFromInput(state.startingPoint);
    Object.assign(state, draft);
    const response = responseFor(state);
    if (response.kind === 'question') {
      setQuestion('decision', response.question);
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

  function applyQuestionAnswer() {
    const answer = normalize(root.querySelector('#universal-input')?.value);
    state.answerDraft = answer;
    if (!answer) {
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
    if (state.questionKind === 'goals') state.goals = unique([...state.goals, ...splitUserItems(answer, MAX_SUGGESTIONS.goals)], MAX_SUGGESTIONS.goals);
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
    else if (state.view === 'question') root.innerHTML = questionMarkup(state, state.question || nextQuestion(state, state.questionKind));
    else if (state.view === 'boundary') root.innerHTML = boundaryMarkup(state, state.boundaryTitle, state.boundaryBody, state.savedBoundary);
    else root.innerHTML = entryMarkup(state, hasSavedDecision());

    root.querySelector('#universal-input')?.addEventListener('input', (event) => {
      const value = String(event.currentTarget.value || '').slice(0, RESCUE_MAX_INPUT_CHARS + 1);
      if (state.view === 'entry') state.startingPoint = value;
      else state.answerDraft = value;
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

    if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
  }

  paint(state.view === 'entry' ? '#universal-title' : '#universal-response-title');
}
