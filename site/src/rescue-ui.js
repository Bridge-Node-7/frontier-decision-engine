import { createGuidedDecisionCase, DRAFT_TOPOLOGY_BOUNDS } from './lib/decision.js';
import { downloadText, safeFilename } from './lib/case.js';
import { DECISION_STORAGE_KEY, getBrowserStorage, saveDecision } from './lib/persistence.js';
import {
  RESCUE_CHOICES,
  RESCUE_FUTURES,
  RESCUE_GOALS,
  RESCUE_INTENTS,
  RESCUE_MAX_INPUT_CHARS,
  buildDecisionFrame,
  decisionFrameReady,
  frameAsText,
  validateIntakeText,
} from './lib/intake.js';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const rescue = {
  stage: 0,
  startingPoint: '',
  intent: '',
  decision: '',
  goals: [],
  choices: [],
  futures: [],
  urgency: '',
  reversibility: '',
  error: '',
  pendingReplace: false,
};

const intentCopy = {
  'find-decision': 'We will turn the situation into one decision at a time.',
  untangle: 'We will separate what is happening from what actually needs a choice.',
  compare: 'We will capture the choices you already see, then test them only if useful.',
  missing: 'We will make the unknowns visible before forcing a comparison.',
  urgent: 'We will focus on the smallest useful frame for a near-term decision.',
  unsure: 'That is enough to start. We will keep the next step small.',
};

const selectionLimits = Object.freeze({
  goal: DRAFT_TOPOLOGY_BOUNDS.objectives.max,
  choice: DRAFT_TOPOLOGY_BOUNDS.strategies.max,
  future: DRAFT_TOPOLOGY_BOUNDS.scenarios.max,
});

const RESCUE_SESSION_KEY = 'fde.rescue.session.v1';
const RESCUE_CONTEXT_KEY = 'fde.rescue.context.v1';
const RESCUE_SESSION_VERSION = 1;

function getSessionStorage() {
  try { return globalThis.sessionStorage || null; } catch { return null; }
}

function rescueSnapshot() {
  const current = buildDecisionFrame(rescue);
  return {
    version: RESCUE_SESSION_VERSION,
    stage: rescue.stage,
    startingPoint: current.startingPoint,
    intent: current.intent,
    decision: current.decision,
    goals: current.goals,
    choices: current.choices,
    futures: current.futures,
    urgency: current.urgency,
    reversibility: current.reversibility,
  };
}

function persistRescueSession() {
  const storage = getSessionStorage();
  if (!storage) return false;
  try {
    const snapshot = rescueSnapshot();
    if (!snapshot.startingPoint && snapshot.stage === 0) {
      storage.removeItem(RESCUE_SESSION_KEY);
      return true;
    }
    storage.setItem(RESCUE_SESSION_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

function restoreRescueSession() {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(RESCUE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const stage = Number(parsed?.stage);
    const current = buildDecisionFrame(parsed || {});
    const valid = parsed?.version === RESCUE_SESSION_VERSION
      && Number.isInteger(stage) && stage >= 0 && stage <= 6
      && current.startingPoint.length <= RESCUE_MAX_INPUT_CHARS
      && current.decision.length <= 500
      && current.goals.length <= selectionLimits.goal
      && current.choices.length <= selectionLimits.choice
      && current.futures.length <= selectionLimits.future;
    if (!valid) throw new Error('invalid rescue session');
    return { ...current, stage, error: '', pendingReplace: false };
  } catch {
    try { storage.removeItem(RESCUE_SESSION_KEY); } catch { /* no-op */ }
    return null;
  }
}

function clearRescueSession() {
  try { getSessionStorage()?.removeItem(RESCUE_SESSION_KEY); } catch { /* no-op */ }
}

function writeRescueContext(current) {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(RESCUE_CONTEXT_KEY, JSON.stringify({
      version: 1,
      startingPoint: String(current.startingPoint || '').slice(0, RESCUE_MAX_INPUT_CHARS),
    }));
  } catch { /* context is optional */ }
}

function existingLabDraft(storage) {
  if (!storage) return false;
  try { return Boolean(storage.getItem(DECISION_STORAGE_KEY)); } catch { return false; }
}

Object.assign(rescue, restoreRescueSession() || {});

const decisionPromptByIntent = Object.freeze({
  'find-decision': {
    question: 'What choice actually needs to be made?',
    help: 'Name one decision first. It can be rough.',
  },
  untangle: {
    question: 'Which part needs a decision first?',
    help: 'Pick the first choice that would make the rest easier to work through.',
  },
  compare: {
    question: 'What choice are you trying to compare?',
    help: 'Name the decision that contains the alternatives you already see.',
  },
  missing: {
    question: 'What decision is blocked by missing information?',
    help: 'Name the choice that cannot move forward until something is learned.',
  },
  urgent: {
    question: 'What decision needs action soon?',
    help: 'Name the choice that matters most right now.',
  },
  unsure: {
    question: 'If one choice had to be made first, what would it be?',
    help: 'A rough question is enough. You can refine it later.',
  },
});

function toggleSelection(list, value, limit = Number.POSITIVE_INFINITY) {
  const index = list.indexOf(value);
  if (index >= 0) {
    list.splice(index, 1);
    return { changed: true, reason: '' };
  }
  if (list.length >= limit) {
    return { changed: false, reason: `This comparison supports up to ${limit} ${limit === 1 ? 'item' : 'items'} here.` };
  }
  list.push(value);
  return { changed: true, reason: '' };
}

function chip(label, selected, kind, value = label, disabled = false) {
  return `<button class="rescue-chip ${selected ? 'is-selected' : ''}" type="button"
    data-rescue-kind="${escapeHtml(kind)}" data-rescue-value="${escapeHtml(value)}"
    aria-pressed="${selected ? 'true' : 'false'}" ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>`;
}

function frame() {
  return buildDecisionFrame(rescue);
}

function urgencyDisplay(value) {
  return { today: 'Today', soon: 'Soon', time: 'I have time', unsure: 'Not sure' }[value] || '';
}

function reversibilityDisplay(value) {
  return { easy: 'Easy to undo', partly: 'Partly reversible', hard: 'Hard to undo', unsure: 'Not sure' }[value] || '';
}

function framePanel() {
  if (rescue.stage < 1) return '';
  const current = frame();
  const list = (items, empty) => items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : `<p class="rescue-empty">${escapeHtml(empty)}</p>`;
  return `<aside class="rescue-frame" aria-labelledby="decision-frame-title">
    <div class="rescue-frame-head">
      <div><span class="eyebrow">Your working frame</span>
      <h2 id="decision-frame-title">Decision Frame</h2></div>
      <button class="text-action rescue-reset" type="button" data-rescue-reset>Start over</button>
    </div>
    <section><h3>Starting point</h3><p class="rescue-starting-point">${escapeHtml(current.startingPoint)}</p></section>
    <section><h3>Decision</h3>${current.decision ? `<p>${escapeHtml(current.decision)}</p>` : '<p class="rescue-empty">Not clear yet.</p>'}</section>
    ${current.urgency ? `<section><h3>Timing</h3><p>${escapeHtml(urgencyDisplay(current.urgency))}</p></section>` : ''}
    ${current.reversibility ? `<section><h3>Reversibility</h3><p>${escapeHtml(reversibilityDisplay(current.reversibility))}</p></section>` : ''}
    <section><h3>What matters</h3>${list(current.goals, 'Not identified yet.')}</section>
    <section><h3>Choices</h3>${list(current.choices, 'Not identified yet.')}</section>
    <section><h3>What may change</h3>${list(current.futures, 'Not identified yet.')}</section>
    <section><h3>Comparison</h3><p>${decisionFrameReady(current)
      ? 'Ready to continue into a structured comparison if useful.'
      : 'Not ready yet. No recommendation has been made.'}</p></section>
  </aside>`;
}

function optionChips(options, selected, kind) {
  const extras = selected.filter((item) => !options.includes(item));
  const limit = selectionLimits[kind];
  const at1imit = selected.length >= limit;
  return [...options, ...extras]
    .map((item) => chip(item, selected.includes(item), kind, item, atLimit && !selected.includes(item)))
    .join('');
}

function quickMeta() {
  return `<div class="rescue-meta-grid">
    <fieldset class="rescue-fieldset">
      <legend>How soon do you need to act?</legend>
      <div class="rescue-chips compact">
        ${chip('Today', rescue.urgency === 'today', 'urgency', 'today')}
        ${chip('Soon', rescue.urgency === 'soon', 'urgency', 'soon')}
        ${chip('I have time', rescue.urgency === 'time', 'urgency', 'time')}
        ${chip("I'm not sure", rescue.urgency === 'unsure', 'urgency', 'unsure')}
      </div>
    </fieldset>
    <fieldset class="rescue-fieldset">
      <legend>How hard would this be to undo?</legend>
      <div class="rescue-chips compact">
        ${chip('Easy', rescue.reversibility === 'easy', 'reversibility', 'easy')}
        ${chip('Partly', rescue.reversibility === 'partly', 'reversibility', 'partly')}
        ${chip('Hard', rescue.reversibility === 'hard', 'reversibility', 'hard')}
        ${chip("I'm not sure", rescue.reversibility === 'unsure', 'reversibility', 'unsure')}
      </div>
    </fieldset>
  </div>`;
}

function currentPrompt() {
  if (rescue.stage === 0) {
    return `<section class="rescue-focus" aria-labelledby="rescue-question">
      <span class="eyebrow">Start where you are</span>
      <h2 id="rescue-question" tabindex="-1">What’s going on?</h2>
      <p>Tell FDE what you’re dealing with in your own words. It can be messy, incomplete, repetitive, or uncertain. You do not need to organize it first.</p>
      <label class="rescue-textarea-label" for="rescue-intake">What’s on your mind?</label>
      <textarea id="rescue-intake" rows="8" maxlength="12000" aria-describedby="rescue-intake-help" placeholder="Put everything that’s on your mind here…">${escapeHtml(rescue.startingPoint)}</textarea>
      <p id="rescue-intake-help" class="help">One brain dump is enough. FDE will not execute pasted code or silently turn your words into model facts.</p>
      <button id="rescue-start" class="primary rescue-primary" type="button">Help me make sense of this –></button>
      <div class="rescue-secondary-actions">
        <a href="#/decision">I already know exactly what I’m deciding</a>
        <a href="#/decision/example">Try the ready example</a>
        <a href="#/decision/open">Open a saved decision</a>
      </div>
    </section>`;
  }

  if (rescue.stage === 1) {
    return `<section class="rescue-focus" aria-labelledby="rescue-question">
      <span class="eyebrow">One useful action</span>
      <h2 id="rescue-question" tabindex="-1">What would help most?</h2>
      <p>You do not need to solve everything at once.</p>
      <div class="rescue-intent-grid">
        ${RESCUE_INTENTS.map((item) => chip(item.label, rescue.intent === item.id, 'intent', item.id)).join('')}
      </div>
      ${rescue.intent ? `<p class="rescue-guidance">${escapeHtml(intentCopy[rescue.intent])}</p>` : ''}
      <div class="rescue-nav">
        <button class="quiet" data-rescue-back type="button">← Back</button>
        <button class="primary" data-rescue-next type="button" aria-describedby="rescue-next-hint" ${rescue.intent ? '' : 'disabled'}>Continue →</button>
        <span id="rescue-next-hint" class="rescue-nav-hint">Choose one option to continue.</span>
      </div>
    </section>`;
  }

  if (rescue.stage === 2) {
    const prompt = decisionPromptByIntent[rescue.intent] || decisionPromptByIntent.unsure;
    return `<section class="rescue-focus" aria-labelledby="rescue-question">
      <span class="eyebrow">Most useful thing now</span>
      <h2 id="rescue-question" tabindex="-1">${escapeHtml(prompt.question)}</h2>
      <p>${escapeHtml(prompt.help)}</p>
      <label class="rescue-textarea-label" for="rescue-decision">Decision</label>
      <input id="rescue-decision" type="text" maxlength="500" value="${escapeHtml(rescue.decision)}" placeholder="Example: Should we move now or test first?">
      <details class="rescue-help">
        <summary>I’m not sure yet</summary>
        <p>Which feels closest? Something needs to change · someone neds a yes/no · there are several paths · something may need to stop or wait.</p>
      </details>
      <button class="text-action rescue-skip" type="button" data-rescue-skip>Keep going without a clear decision yet</button>
      ${quickMeta()}
      <div class="rescue-nav">
        <button class="quiet" data-rescue-back type="button">← Back</button>
        <button class="primary" data-rescue-next type="button" aria-describedby="rescue-next-hint" ${rescue.decision.trim() ? '' : 'disabled'}>Continue →</button>
        <span id="rescue-next-hint" class="rescue-nav-hint">Write the decision in one line to continue.</span>
      </div>
    </section>`;
  }

  if (rescue.stage === 3) {
    return `<section class="rescue-focus" aria-labelledby="rescue-question">
      <span class="eyebrow">Most useful thing now</span>
      <h2 id="rescue-question" tabindex="-1">What needs to go well?</h2>
      <p>Choose 2–${selectionLimits.goal}. These are starting points, not assumptions about your situation. <strong>${rescue.goals.length}/${selectionLimits.goal}</strong> selected.</p>
      <div class="rescue-chips">${optionChips(RESCUE_GOALS, rescue.goals, 'goal')}</div>
      <label class="rescue-inline-label" for="rescue-custom-goal">Something else</label>
      <div class="rescue-inline-add"><input id="rescue-custom-goal" type="text" maxlength="80" placeholder="Add your own" ${rescue.goals.length >= selectionLimits.goal ? 'disabled' : ''}><button type="button" data-rescue-add="goal" ${rescue.goals.length >= selectionLimits.goal ? 'disabled' : ''}>Add</button></div>
      <button class="text-action rescue-skip" type="button" data-rescue-skip>I’m not sure yet —"��ƭy