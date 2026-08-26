import { downloadText, safeFilename } from './lib/case.js';
import { createGuidedDecisionCase, DRAFT_TOPOLOGY_BOUNDS } from './lib/decision.js';
import { RESCUE_MAX_INPUT_CHARS, buildDecisionFrame, frameAsText, validateIntakeText } from './lib/intake.js';
import { DECISION_STORAGE_KEY, getBrowserStorage, saveDecision } from './lib/persistence.js';

const MAX_SUGGESTIONS = Object.freeze({ decision: 1, choices: 3, goals: 4, futures: 4 });
const SESSION_KEY = 'fde.universal.session.v1';
const CONTEXT_KEY = 'fde.universal.context.v1';
const SESSION_VERSION = 1;

const KEYWORDS = {
  goals: [
    ['time', 'Time'], ['deadline', 'Time'], ['cost', 'Cost'], ['money', 'Cost'],
    ['price', 'Cost'], ['budget', 'Cost'], ['safety', 'Safety'], ['risk', 'Safety'],
    ['quality', 'Quality'], ['reliable', 'Reliability'], ['reliability', 'Reliability'],
    ['people', 'People'], ['team', 'People'], ['customer', 'Customer'], ['customers', 'Customer'],
    ['revenue', 'Revenue'], ['flexibility', 'Flexibility'], ['compliance', 'Compliance'],
  ],
  futures: [
    ['late', 'Timing gets worse'], ['delay', 'Timing gets worse'], ['shortage', 'Availability worsens'],
    ['unavailable', 'A key dependency fails'], ['fails', 'A key dependency fails'], ['failure', 'A key dependency fails'],
    ['expensive', 'Cost increases'], ['cost increases', 'Cost increases'], ['demand changes', 'Demand changes'],
    ['requirement changes', 'Requirements change'], ['requirements change', 'Requirements change'],
    ['regulation changes', 'Requirements change'], ['improves', 'A key constraint improves'],
  ],
};

const genericChoices = ['Keep things as they are', 'Make a change', 'Wait or delay'];
const genericFutures = ['Things stay roughly the same', 'Timing gets worse'];
const intentByText = [
  [/should i|should we|do we|whether|which should|choose/i, 'decision'],
  [/i don.?t know|not sure|confused|overwhelmed|mess|all over the place/i, 'foggy'],
  [/compare|versus|vs\.?|option|options|alternative/i, 'compare'],
  [/missing|unknown|unclear|not enough information|don.?t know if/i, 'unknown'],
  [/urgent|today|asap|deadline|right now|immediately/i, 'urgent'],
];

function normalize(value) { return String(value ?? '').replace(/\r\n?/g, '\n').trim(); }
function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function titleFrom(text) {
  const clean = normalize(text).replace(/\s+/g, ' ');
  if (!clean) return 'Your situation';
  const sentence = clean.split(/[.!?\n]/)[0].trim();
  return sentence.length > 100 ? `${sentence.slice(0, 97)}…` : sentence;
}
function unique(values, max) { return [...new Set(values)].filter(Boolean).slice(0, max); }
function getIntent(text) { return intentByText.find(([pattern]) => pattern.test(text))?.[1] || 'open'; }
function extractChoices(text) {
  const choices = [];
  for (const match of text.matchAll(/(?:either\s+)?([^\n,.!?]{2,60})\s+(?:or|versus|vs\.?|instead of)\s+([^\n,.!?]{2,60})/gi)) {
    choices.push(match[1].trim(), match[2].trim());
  }
  const numbered = [...text.matchAll(/(?:^|\n)\s*(?:\d+|[-*•])\s+([^\n]{2,80})/g)].map((m) => m[1].trim());
  return unique([...choices, ...numbered], MAX_SUGGESTIONS.choices);
}
function extractGoals(text) {
  const hits = [];
  for (const [needle, label] of KEYWORDS.goals) if (text.toLowerCase().includes(needle)) hits.push(label);
  return unique(hits, MAX_SUGGESTIONS.goals);
}
function extractFutures(text) {
  const lower = text.toLowerCase();
  const hits = [];
  for (const [needle, label] of KEYWORDS.futures) if (lower.includes(needle)) hits.push(label);
  return unique(hits, MAX_SUGGESTIONS.futures);
}

function draftFromInput(text) {
  const intent = getIntent(text);
  const explicitChoices = extractChoices(text);
  const goals = extractGoals(text);
  const futures = extractFutures(text);
  const possibleDecision = /should i|should we|do we|whether|which should/i.test(text) ? titleFrom(text) : '';
  return {
    startingPoint: text,
    intent,
    possibleDecision,
    choices: explicitChoices,
    goals,
    futures,
    confidence: explicitChoices.length || goals.length || futures.length || possibleDecision ? 'Some structure is visible in your words.' : 'Not enough structure to safely infer a specific decision yet.',
  };
}

function storage() { try { return globalThis.sessionStorage || null; } catch { return null; } }
function saveSession(state) {
  try {
    storage()?.setItem(SESSION_KEY, JSON.stringify({ version: SESSION_VERSION, ...state }));
    return true;
  } catch { return false; }
}
function loadSession() {
  try {
    const raw = storage()?.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== SESSION_VERSION) return null;
    return parsed;
  } catch { return null; }
}
function clearSession() { try { storage()?.removeItem(SESSION_KEY); } catch { /* no-op */ } }

function surfaceCard({ label, values, state = 'possible', empty = '' }) {
  const body = values.length
    ? `<ul class="universal-list">${values.map((value) => `<li><span class="surface-value">${escapeHtml(value)}</span><span class="surface-state">${escapeHtml(state)}</span></li>`).join('')}</ul>`
    : `<p class="universal-empty">${escapeHtml(empty)}</p>`;
  return `<section class="universal-card"><div class="universal-card-label">${escapeHtml(label)}</div>${body}</section>`;
}

function responseFor(state) {
  const { intent, possibleDecision, choices, goals, futures } = state;
  if (intent === 'urgent') return { title: 'Let’s make the immediate decision smaller.', body: 'You do not need to solve everything right now. I’ll help isolate the choice that matters first.' };
  if (intent === 'foggy') return { title: 'You do not have to organize this first.', body: 'I’ll pull out what I can, show it back to you, and let you correct anything that is wrong.' };
  if (intent === 'compare') return { title: 'I can help compare the paths you’re considering.', body: 'I’ll keep your wording visible and only treat confirmed items as part of the formal decision model.' };
  if (intent === 'unknown') return { title: 'The missing information may be part of the decision.', body: 'I’ll show what appears unclear and help identify the smallest thing worth checking next.' };
  if (possibleDecision) return { title: 'I can see a decision forming here.', body: 'I found a possible decision in your words. Nothing becomes a fact until you confirm it.' };
  if (choices.length || goals.length || futures.length) return { title: 'Here’s what I can already see.', body: 'I found a few useful signals in what you wrote. Treat them as a draft, not as facts.' };
  return { title: 'We can start from here.', body: 'I don’t need you to have a perfectly formed question. I’ll help turn this into a useful next step.' };
}

function render(root, state, focusSelector = '#universal-input') {
  const response = responseFor(state);
  const enough = Boolean(state.possibleDecision && state.choices.length >= 2 && state.goals.length >= 2 && state.futures.length >= 2);
  const safeCount = DRAFT_TOPOLOGY_BOUNDS.strategies.max;
  root.innerHTML = `
    <section class="universal-hero" aria-labelledby="universal-title">
      <span class="eyebrow">Frontier Decision Engine</span>
      <h1 id="universal-title">Bring the whole mess.</h1>
      <p class="universal-subtitle">You don’t need to know how to use FDE. Tell it what’s happening, and FDE will give you something useful back.</p>
    </section>
    <div class="universal-layout">
      <section class="universal-entry" aria-labelledby="universal-question">
        <div class="universal-response" role="status" aria-live="polite">
          <span class="universal-response-kicker">FDE</span>
          <h2 id="universal-question" tabindex="-1">${escapeHtml(response.title)}</h2>
          <p>${escapeHtml(response.body)}</p>
        </div>
        <label for="universal-input">What’s on your mind?</label>
        <textarea id="universal-input" maxlength="${RESCUE_MAX_INPUT_CHARS}" rows="10" aria-describedby="universal-help" placeholder="Type anything… a problem, question, worry, idea, decision, or a complete mess.">${escapeHtml(state.startingPoint || '')}</textarea>
        <p id="universal-help" class="help">Anything is okay. Your text stays in this browser and is treated as input—not as verified evidence.</p>
        <div class="universal-actions">
          <button id="universal-refresh" class="primary" type="button">Show me what FDE sees →</button>
          <button id="universal-clear" class="quiet" type="button">Start over</button>
        </div>
        <div class="universal-status" id="universal-status" role="status" aria-live="polite"></div>
      </section>
      <aside class="universal-surface" aria-labelledby="surface-title">
        <div class="universal-surface-head"><div><span class="eyebrow">Live decision surface</span><h2 id="surface-title">What FDE sees so far</h2></div><span class="universal-badge">Draft</span></div>
        ${surfaceCard({ label: 'Possible decision', values: state.possibleDecision ? [state.possibleDecision] : [], empty: 'Not clear yet.' })}
        ${surfaceCard({ label: 'Choices mentioned', values: state.choices, empty: 'No explicit choices yet.' })}
        ${surfaceCard({ label: 'What may matter', values: state.goals, empty: 'Nothing safely identified yet.' })}
        ${surfaceCard({ label: 'What could change the answer', values: state.futures, empty: 'Nothing safely identified yet.' })}
        <section class="universal-next" aria-labelledby="universal-next-title">
          <div class="universal-card-label" id="universal-next-title">Most useful next step</div>
          <p>${escapeHtml(state.next || (enough ? 'Enough structure is visible to build the formal FDE comparison.' : 'Confirm or correct anything that looks useful.'))}</p>
          <div class="universal-confirm-row">
            <button id="universal-confirm" type="button" ${enough ? '' : 'disabled'}>Build my FDE decision →</button>
            <button id="universal-download" class="quiet" type="button">Download this surface</button>
          </div>
        </section>
        <p class="universal-truth"><strong>Possible is not confirmed.</strong> FDE does not turn your words into facts, probabilities, scores, or recommendations without explicit inputs. The comparison informs; a person decides.</p>
      </aside>
    </div>`;
  root.querySelector('#universal-input')?.addEventListener('input', (event) => {
    state.startingPoint = String(event.currentTarget.value || '').slice(0, RESCUE_MAX_INPUT_CHARS);
    saveSession(state);
  });
  root.querySelector('#universal-refresh')?.addEventListener('click', () => {
    const result = validateIntakeText(root.querySelector('#universal-input')?.value);
    if (!result.ok) {
      state.startingPoint = result.text;
      state.next = result.error;
      saveSession(state);
      render(root, state, '#universal-input');
      root.querySelector('#universal-status').textContent = result.error;
      return;
    }
    Object.assign(state, draftFromInput(result.text));
    state.next = state.choices.length || state.goals.length || state.futures.length
      ? 'Review the draft surface. Confirm only what is actually true for your decision.'
      : 'Tell FDE one more thing only if you want a more specific surface. You can also stop here.';
    saveSession(state);
    render(root, state, '#surface-title');
  });
  root.querySelector('#universal-clear')?.addEventListener('click', () => {
    clearSession();
    Object.assign(state, { startingPoint: '', intent: '', possibleDecision: '', choices: [], goals: [], futures: [], confidence: '', next: '' });
    render(root, state);
  });
  root.querySelector('#universal-download')?.addEventListener('click', () => {
    downloadText(safeFilename(state.possibleDecision || 'decision-surface', 'txt'), frameAsText(buildDecisionFrame({ startingPoint: state.startingPoint, decision: state.possibleDecision, goals: state.goals, choices: state.choices, futures: state.futures })));
  });
  root.querySelector('#universal-confirm')?.addEventListener('click', () => {
    const decisionText = state.possibleDecision || state.startingPoint;
    const decision = createGuidedDecisionCase({ objectiveCount: Math.min(4, Math.max(2, state.goals.length)), strategyCount: Math.min(3, Math.max(2, state.choices.length)), scenarioCount: Math.min(4, Math.max(2, state.futures.length)) });
    decision.question = decisionText;
    decision.title = decisionText.slice(0, 120);
    state.goals.forEach((label, index) => { decision.objectives[index].label = label; });
    state.choices.forEach((label, index) => { decision.strategies[index].label = label; });
    state.futures.forEach((label, index) => { decision.scenarios[index].label = label; });
    const saved = getBrowserStorage(globalThis);
    if (saved?.getItem?.(DECISION_STORAGE_KEY)) {
      state.next = 'A saved FDE decision exists in this browser. Open it from the Decision Lab before replacing it.';
      render(root, state, '#universal-surface');
      return;
    }
    const result = saveDecision(saved, decision, null);
    if (!result.ok) {
      root.querySelector('#universal-status').textContent = result.status;
      return;
    }
    clearSession();
    try { storage()?.setItem(CONTEXT_KEY, JSON.stringify({ version: 1, startingPoint: state.startingPoint })); } catch { /* optional */ }
    try { storage()?.setItem('fde.universal.handoff', '1'); } catch { /* optional */ }
    location.hash = '#/decision';
  });
  const focusTarget = root.querySelector(focusSelector);
  if (focusSelector === '#surface-title') focusTarget?.focus({ preventScroll: true });
}

export function renderUniversalDecisionExperience(root) {
  const restored = loadSession() || {};
  const state = {
    startingPoint: normalize(restored.startingPoint || ''), intent: restored.intent || '',
    possibleDecision: restored.possibleDecision || '', choices: Array.isArray(restored.choices) ? restored.choices.slice(0, MAX_SUGGESTIONS.choices) : [],
    goals: Array.isArray(restored.goals) ? restored.goals.slice(0, MAX_SUGGESTIONS.goals) : [],
    futures: Array.isArray(restored.futures) ? restored.futures.slice(0, MAX_SUGGESTIONS.futures) : [],
    confidence: restored.confidence || '', next: restored.next || '',
  };
  render(root, state, '#universal-title');
}
