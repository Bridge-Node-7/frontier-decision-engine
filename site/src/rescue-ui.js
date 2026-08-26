import { createGuidedDecisionCase, DRAFT_TOPOLOGY_BOUNDS } from './lib/decision.js';
import { downloadText, safeFilename } from './lib/case.js';
import { getBrowserStorage, saveDecision } from './lib/persistence.js';
import {
  RESCUE_CHOICES,
  RESCUE_FUTURES,
  RESCUE_GOALS,
  RESCUE_INTENTS,
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

function framePanel() {
  if (rescue.stage < 1) return '';
  const current = frame();
  const list = (items, empty) => items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : `<p class="rescue-empty">${escapeHtml(empty)}</p>`;
  return `<aside class="rescue-frame" aria-labelledby="decision-frame-title">
    <div class="rescue-frame-head">
      <span class="eyebrow">Your working frame</span>
      <h2 id="decision-frame-title">Decision Frame</h2>
    </div>
    <section><h3>Starting point</h3><p class="rescue-starting-point">${escapeHtml(current.startingPoint)}</p></section>
    <section><h3>Decision</h3>${current.decision ? `<p>${escapeHtml(current.decision)}</p>` : '<p class="rescue-empty">Not clear yet.</p>'}</section>
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
  const atLimit = selected.length >= limit;
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
      <textarea id="rescue-intake" rows="8" maxlength="12000" placeholder="Put everything that’s on your mind here…">${escapeHtml(rescue.startingPoint)}</textarea>
      <p id="rescue-intake-help" class="help">One brain dump is enough. FDE will not execute pasted code or silently turn your words into model facts.</p>
      <button id="rescue-start" class="primary rescue-primary" type="button">Help me make sense of this →</button>
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
        <button class="primary" data-rescue-next type="button" ${rescue.intent ? '' : 'disabled'}>Continue →</button>
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
        <p>Which feels closest? Something needs to change · someone needs a yes/no · there are several paths · something may need to stop or wait.</p>
      </details>
      <button class="text-action rescue-skip" type="button" data-rescue-skip>Keep going without a clear decision yet</button>
      ${quickMeta()}
      <div class="rescue-nav">
        <button class="quiet" data-rescue-back type="button">← Back</button>
        <button class="primary" data-rescue-next type="button" ${rescue.decision.trim() ? '' : 'disabled'}>Continue →</button>
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
      <button class="text-action rescue-skip" type="button" data-rescue-skip>I’m not sure yet — keep going</button>
      <div class="rescue-nav">
        <button class="quiet" data-rescue-back type="button">← Back</button>
        <button class="primary" data-rescue-next type="button" ${rescue.goals.length >= 2 ? '' : 'disabled'}>Continue →</button>
      </div>
    </section>`;
  }

  if (rescue.stage === 4) {
    return `<section class="rescue-focus" aria-labelledby="rescue-question">
      <span class="eyebrow">Most useful thing now</span>
      <h2 id="rescue-question" tabindex="-1">What could you realistically do?</h2>
      <p>Choose 2–${selectionLimits.choice}. Rename or add something specific when the generic path is not enough. <strong>${rescue.choices.length}/${selectionLimits.choice}</strong> selected.</p>
      <div class="rescue-chips">${optionChips(RESCUE_CHOICES, rescue.choices, 'choice')}</div>
      <label class="rescue-inline-label" for="rescue-custom-choice">Something else</label>
      <div class="rescue-inline-add"><input id="rescue-custom-choice" type="text" maxlength="100" placeholder="Add a real choice" ${rescue.choices.length >= selectionLimits.choice ? 'disabled' : ''}><button type="button" data-rescue-add="choice" ${rescue.choices.length >= selectionLimits.choice ? 'disabled' : ''}>Add</button></div>
      <button class="text-action rescue-skip" type="button" data-rescue-skip>I’m not sure yet — keep going</button>
      <div class="rescue-nav">
        <button class="quiet" data-rescue-back type="button">← Back</button>
        <button class="primary" data-rescue-next type="button" ${rescue.choices.length >= 2 ? '' : 'disabled'}>Continue →</button>
      </div>
    </section>`;
  }

  if (rescue.stage === 5) {
    return `<section class="rescue-focus" aria-labelledby="rescue-question">
      <span class="eyebrow">Most useful thing now</span>
      <h2 id="rescue-question" tabindex="-1">What could happen that might change the answer?</h2>
      <p>Choose 2–${selectionLimits.future} plausible futures. Nothing here is treated as a prediction. <strong>${rescue.futures.length}/${selectionLimits.future}</strong> selected.</p>
      <div class="rescue-chips">${optionChips(RESCUE_FUTURES, rescue.futures, 'future')}</div>
      <label class="rescue-inline-label" for="rescue-custom-future">Something else</label>
      <div class="rescue-inline-add"><input id="rescue-custom-future" type="text" maxlength="100" placeholder="Add a plausible future" ${rescue.futures.length >= selectionLimits.future ? 'disabled' : ''}><button type="button" data-rescue-add="future" ${rescue.futures.length >= selectionLimits.future ? 'disabled' : ''}>Add</button></div>
      <button class="text-action rescue-skip" type="button" data-rescue-skip>I’m not sure yet — build what we have</button>
      <div class="rescue-nav">
        <button class="quiet" data-rescue-back type="button">← Back</button>
        <button class="primary" data-rescue-next type="button" ${rescue.futures.length >= 2 ? '' : 'disabled'}>Build my Decision Frame →</button>
      </div>
    </section>`;
  }

  const ready = decisionFrameReady(frame());
  return `<section class="rescue-focus rescue-complete" aria-labelledby="rescue-question">
    <span class="eyebrow">Decision Rescue</span>
    <h2 id="rescue-question" tabindex="-1">${ready ? 'Your Decision Frame is ready.' : 'Your Decision Frame is taking shape.'}</h2>
    <p>${ready
      ? 'You have enough structure to see the decision more clearly. You can stop here or continue into the full deterministic comparison.'
      : 'This is still useful framing. No recommendation has been made.'}</p>
    <div class="rescue-callout">
      <strong>What FDE has done</strong>
      <p>Externalized the situation and organized only what you confirmed. FDE has not inferred evidence, assigned probabilities, or made the decision.</p>
    </div>
    <div class="rescue-finish-actions">
      <button id="rescue-download-frame" class="primary" type="button">Download Decision Frame</button>
      <button id="rescue-open-lab" type="button" ${ready ? '' : 'disabled'}>Continue to full comparison</button>
      <button class="quiet" data-rescue-back type="button">← Refine the frame</button>
    </div>
    <p class="method-truth">The comparison informs. A person decides.</p>
  </section>`;
}

function handoffToDecisionLab() {
  const current = frame();
  if (!decisionFrameReady(current)) {
    rescue.error = 'Confirm a decision, at least two things that matter, two choices, and two futures before the full comparison.';
    renderActive();
    return;
  }
  const overCapacity = [
    ['things that matter', current.goals.length, selectionLimits.goal],
    ['choices', current.choices.length, selectionLimits.choice],
    ['futures', current.futures.length, selectionLimits.future],
  ].find(([, count, limit]) => count > limit);
  if (overCapacity) {
    rescue.error = `The current Decision Lab can carry up to ${overCapacity[2]} ${overCapacity[0]}. Refine the frame before continuing so nothing is lost.`;
    renderActive();
    return;
  }

  const decision = createGuidedDecisionCase({
    objectiveCount: current.goals.length,
    strategyCount: current.choices.length,
    scenarioCount: current.futures.length,
  });
  decision.question = current.decision || current.startingPoint;
  decision.title = (current.decision || current.startingPoint).slice(0, 120);
  decision.urgency = current.urgency === 'today' ? 'immediate'
    : current.urgency === 'soon' ? 'near-term'
      : current.urgency === 'time' ? 'planned' : '';
  decision.reversibility = current.reversibility === 'easy' ? 'reversible'
    : current.reversibility === 'partly' ? 'partially-reversible'
      : current.reversibility === 'hard' ? 'irreversible' : '';

  current.goals.forEach((label, index) => {
    decision.objectives[index].label = label;
  });
  current.choices.forEach((label, index) => {
    decision.strategies[index].label = label;
  });
  current.futures.forEach((label, index) => {
    decision.scenarios[index].label = label;
  });

  const result = saveDecision(getBrowserStorage(globalThis), decision, null);
  if (!result.ok) {
    rescue.error = result.status;
    renderActive();
    return;
  }
  rescue.error = '';
  try { globalThis.sessionStorage?.setItem('fde.rescue.handoff', '1'); } catch { /* handoff still works through saved draft */ }
  history.replaceState(null, '', `${location.pathname}${location.search}#/decision`);
  location.reload();
}

let activeRoot = null;

function bind(root) {
  root.querySelector('#rescue-start')?.addEventListener('click', () => {
    const input = root.querySelector('#rescue-intake');
    const result = validateIntakeText(input?.value);
    rescue.startingPoint = result.text;
    rescue.error = result.error;
    if (result.ok) {
      rescue.stage = 1;
      rescue.error = '';
    }
    renderActive();
  });

  root.querySelector('#rescue-decision')?.addEventListener('input', (event) => {
    rescue.decision = event.currentTarget.value;
    const next = root.querySelector('[data-rescue-next]');
    if (next) next.disabled = !rescue.decision.trim();
  });

  root.querySelectorAll('[data-rescue-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.dataset.rescueKind;
      const value = button.dataset.rescueValue;
      rescue.error = '';
      if (kind === 'intent') rescue.intent = value;
      if (kind === 'goal') rescue.error = toggleSelection(rescue.goals, value, selectionLimits.goal).reason;
      if (kind === 'choice') rescue.error = toggleSelection(rescue.choices, value, selectionLimits.choice).reason;
      if (kind === 'future') rescue.error = toggleSelection(rescue.futures, value, selectionLimits.future).reason;
      if (kind === 'urgency') rescue.urgency = rescue.urgency === value ? '' : value;
      if (kind === 'reversibility') rescue.reversibility = rescue.reversibility === value ? '' : value;
      renderActive({ focusKind: kind, focusValue: value });
    });
  });

  root.querySelectorAll('[data-rescue-add]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.dataset.rescueAdd;
      const input = root.querySelector(`#rescue-custom-${kind}`);
      const value = String(input?.value || '').trim();
      if (!value) return;
      const target = kind === 'goal' ? rescue.goals : kind === 'choice' ? rescue.choices : rescue.futures;
      const result = target.includes(value)
        ? { changed: false, reason: '' }
        : toggleSelection(target, value, selectionLimits[kind]);
      rescue.error = result.reason;
      renderActive({ focusKind: kind, focusValue: value });
    });
  });

  root.querySelector('[data-rescue-skip]')?.addEventListener('click', () => {
    rescue.error = '';
    rescue.stage = Math.min(6, rescue.stage + 1);
    renderActive();
  });

  root.querySelector('[data-rescue-next]')?.addEventListener('click', () => {
    if (rescue.stage === 1 && !rescue.intent) return;
    if (rescue.stage === 2 && !rescue.decision.trim()) return;
    if (rescue.stage === 3 && rescue.goals.length < 2) return;
    if (rescue.stage === 4 && rescue.choices.length < 2) return;
    if (rescue.stage === 5 && rescue.futures.length < 2) return;
    rescue.error = '';
    rescue.stage = Math.min(6, rescue.stage + 1);
    renderActive();
  });

  root.querySelector('[data-rescue-back]')?.addEventListener('click', () => {
    rescue.error = '';
    rescue.stage = Math.max(0, rescue.stage - 1);
    renderActive();
  });

  root.querySelector('#rescue-download-frame')?.addEventListener('click', () => {
    const current = frame();
    const stem = current.decision || 'decision-frame';
    downloadText(safeFilename(stem, 'txt'), frameAsText(current));
  });

  root.querySelector('#rescue-open-lab')?.addEventListener('click', handoffToDecisionLab);
}

function renderActive({ focusKind = '', focusValue = '', focusId = '', focusHeading = true } = {}) {
  if (!activeRoot) return;
  activeRoot.innerHTML = `<section class="rescue-hero fde-hero" data-surface="fde-hero" aria-labelledby="fde-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <h1 id="fde-title" tabindex="-1">Frontier Decision Engine</h1>
    <p class="hero-line">Bring whatever is on your mind.</p>
    <p class="lede">FDE helps you find the decision, make uncertainty visible, and move forward without pretending to know what you have not established.</p><p class="rescue-privacy">No account. No default upload. This public browser tool is not presented as a confidential-data environment.</p>
  </section>
  <div class="rescue-layout">
    <div>
      ${currentPrompt()}
      ${rescue.error ? `<p id="rescue-status" class="rescue-error" role="alert" aria-live="assertive">${escapeHtml(rescue.error)}</p>` : ''}
    </div>
    ${framePanel()}
  </div>
  <section id="how-it-works" class="rescue-method" data-surface="integrated-method" tabindex="-1" aria-labelledby="rescue-method-title">
    <h2 id="rescue-method-title">How it works</h2>
    <div><strong>Bring the mess</strong><span>Start in your own words.</span></div>
    <div><strong>Find the decision</strong><span>Confirm only what matters.</span></div>
    <div><strong>Test when useful</strong><span>Use the full comparison only when the decision needs it.</span></div>
  </section>`;
  bind(activeRoot);

  if (focusKind) {
    const target = [...activeRoot.querySelectorAll('[data-rescue-kind]')]
      .find((element) => element.dataset.rescueKind === focusKind && element.dataset.rescueValue === focusValue);
    target?.focus({ preventScroll: true });
    return;
  }
  if (focusId) {
    activeRoot.querySelector(`#${focusId}`)?.focus({ preventScroll: true });
    return;
  }
  if (focusHeading) activeRoot.querySelector('#rescue-question, #fde-title')?.focus({ preventScroll: true });
}

export function renderDecisionRescue(root) {
  activeRoot = root;
  renderActive();
}
