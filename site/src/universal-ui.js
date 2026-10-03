import { createGuidedDecisionCase, DRAFT_TOPOLOGY_BOUNDS } from './lib/decision.js';
import { GUIDED_MAX_INPUT_CHARS } from './lib/intake.js';
import { DECISION_STORAGE_KEY, getBrowserStorage, saveDecision } from './lib/persistence.js';
import { boundaryForInput } from './lib/input-boundaries.js';
import { deriveDecisionHinge } from './lib/decision-hinge.js';

const FORMAL_LIMITS = Object.freeze({
  choices: DRAFT_TOPOLOGY_BOUNDS.strategies,
  goals: DRAFT_TOPOLOGY_BOUNDS.objectives,
  futures: DRAFT_TOPOLOGY_BOUNDS.scenarios,
});
const SESSION_KEY = 'fde.universal.session.v2';
const CONTEXT_KEY = 'fde.universal.context.v1';
const HANDOFF_KEY = 'fde.universal.handoff';
const SESSION_VERSION = 2;

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
const uncertainPattern = /\b(?:incomplete|unknown|uncertain|not sure|don't know|do not know|contested|conflicting|unverified|stale)\b/i;

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

function unique(values, max = Number.POSITIVE_INFINITY) {
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

function extractDecisionCandidates(text) {
  const sentences = normalize(text).split(/(?<=[.!?])\s+|\n+/).map((value) => value.trim()).filter(Boolean);
  return unique(sentences.filter((value) => decisionPattern.test(value)).map((value) => value.replace(/[.!?]+$/, '').trim()));
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
    if (parts.length >= 3) return unique(parts);
  }
  return [];
}

function extractChoices(text) {
  const choices = [];
  const clauses = normalize(text).split(/[.!?\n]+/).map((value) => value.trim()).filter(Boolean);
  for (const clause of clauses) {
    const decisionLike = decisionPattern.test(clause) || /^(?:should\b|choose|pick|select|decide)\b/i.test(clause);
    if (!decisionLike) continue;
    for (const match of clause.matchAll(/(?:either\s+)?([^\n,.!?]{2,100})\s+(?:or|versus|vs\.?|instead of)\s+([^\n,.!?]{2,100})/gi)) {
      choices.push(cleanChoice(match[1]), cleanChoice(match[2]));
    }
  }
  const numbered = [...normalize(text).matchAll(/(?:^|\n)\s*(?:\d+[.)]?|[-*•])\s+([^\n]{2,120})/g)]
    .map((match) => cleanChoice(match[1]));
  return unique([...choices, ...numbered]);
}

function phraseMatches(text, needle) {
  const escaped = needle.trim().split(/\s+/).join('\\s+');
  const pattern = new RegExp('(^|[^\\p{L}\\p{N}_])(' + escaped + ')(?=$|[^\\p{L}\\p{N}_])', 'giu');
  return [...String(text).matchAll(pattern)].map((match) => {
    const start = match.index + match[1].length;
    return { start, end: start + match[2].length };
  });
}

function extractKeywordLabels(text, entries, max = Number.POSITIVE_INFINITY) {
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
  return extractKeywordLabels(text, KEYWORDS.goals);
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
    const body = clause
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
  return unique(criteria);
}

function extractFutures(text) {
  return extractKeywordLabels(text, KEYWORDS.futures);
}

function splitUserItems(text) {
  const clean = normalize(text);
  if (!clean) return [];
  return unique(clean
    .split(/\n|;|,/)
    .map((item) => item.replace(/^\s*(?:\d+[.)]?|[-*•])\s*/, '').trim())
    .filter(Boolean));
}

export function draftFromInput(text) {
  const clean = normalize(text);
  const intent = getIntent(clean);
  const listedChoices = extractListedChoices(clean);
  const choices = unique([...extractChoices(clean), ...listedChoices]);
  const explicitCriteria = extractExplicitCriteria(clean);
  const goals = unique([...extractGoals(clean), ...explicitCriteria]);
  const futures = extractFutures(clean);
  const decisionCandidates = extractDecisionCandidates(clean);
  const possibleDecision = intent !== 'multi' && decisionCandidates.length
    ? decisionCandidates[0]
    : intent !== 'multi' && choices.length >= 2 && clean.includes('?')
      ? titleFrom(clean)
      : '';
  return {
    startingPoint: clean,
    intent,
    possibleDecision,
    decisionCandidates,
    optionListAmbiguous: choices.length > FORMAL_LIMITS.choices.max,
    detectedChoiceCount: choices.length,
    criteriaListAmbiguous: goals.length > FORMAL_LIMITS.goals.max,
    detectedCriterionCount: goals.length,
    hingeCandidate: deriveDecisionHinge(clean),
    choices,
    goals,
    futures,
  };
}

export function responseFor(state) {
  const clean = normalize(state?.startingPoint);
  const boundary = boundaryForInput(clean);
  if (boundary) return { kind: 'boundary', title: boundary.title, body: boundary.body };
  if (!clean) return { kind: 'empty' };
  if (state?.intent === 'information') {
    return {
      kind: 'boundary',
      title: 'FDE compares decisions; it does not retrieve outside facts.',
      body: 'Gather the fact first, or state the decision that fact will inform.',
    };
  }
  return { kind: 'brief' };
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

function supportableSection(label, semantic, value, fallback = '') {
  if (Array.isArray(value)) {
    const values = value.map(normalize).filter(Boolean);
    if (!values.length && !fallback) return '';
    const body = values.length
      ? `<ul>${values.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : `<p class="universal-empty">${escapeHtml(fallback)}</p>`;
    return `<section class="universal-field" data-fde-field="${semantic}"><h3>${escapeHtml(label)}</h3>${body}</section>`;
  }
  const text = normalize(value);
  if (!text && !fallback) return '';
  return `<section class="universal-field" data-fde-field="${semantic}"><h3>${escapeHtml(label)}</h3><p>${escapeHtml(text || fallback)}</p></section>`;
}

function briefDecisionMarkup(state) {
  if (state.decisionCandidates.length > 1) {
    return supportableSection('Decisions identified', 'decision', state.decisionCandidates);
  }
  return supportableSection('Decision', 'decision', state.possibleDecision, 'The decision is not explicit yet.');
}

function briefUnknowns(state) {
  const unknowns = [];
  if (!state.possibleDecision && state.decisionCandidates.length === 0) unknowns.push('The decision itself is not explicit yet.');
  if (state.choices.length < FORMAL_LIMITS.choices.min) unknowns.push('The alternatives are not fully established.');
  if (state.goals.length < FORMAL_LIMITS.goals.min) unknowns.push('What matters most is not fully established.');
  if (uncertainPattern.test(state.startingPoint)) unknowns.push('Some supporting evidence remains uncertain.');
  return unique(unknowns);
}

function nextUsefulMove(state) {
  if (!state.possibleDecision && state.decisionCandidates.length === 0) {
    return 'Refine only if you want FDE to isolate a formal decision.';
  }
  if (state.decisionCandidates.length > 1) {
    return 'Refine or open Compare options when you want to focus one formal decision.';
  }
  if (state.choices.length < FORMAL_LIMITS.choices.min) {
    return 'Refine only if you want to name alternatives for formal comparison.';
  }
  if (state.goals.length < FORMAL_LIMITS.goals.min) {
    return 'Refine only if you want to make the comparison criteria explicit.';
  }
  return 'Open Compare options when you want a formal deterministic comparison.';
}

function hingeMarkup(state) {
  const hinge = state.hingeCandidate;
  if (!hinge) return '';
  return `<section class="universal-hinge" data-fde-field="decision_hinge">
    <div class="universal-hinge-meta"><span>Potential hinge</span><span>From your words</span></div>
    <h3>This decision may turn on</h3>
    <p>${escapeHtml(hinge.text)}</p>
  </section>`;
}

function preservedMarkup(state) {
  const messages = [];
  if (state.decisionCandidates.length > 1) messages.push(`${state.decisionCandidates.length} decision questions preserved.`);
  if (state.choices.length > FORMAL_LIMITS.choices.max) messages.push(`${state.choices.length} possible choices preserved.`);
  if (state.goals.length > FORMAL_LIMITS.goals.max) messages.push(`${state.goals.length} criteria preserved.`);
  if (!messages.length) return '';
  return `<aside class="universal-preserved" aria-label="Preserved context"><strong>Preserved context</strong><p>${escapeHtml(messages.join(' '))} Formal comparison uses a human-selected bounded set without discarding the source context.</p></aside>`;
}

function entryMarkup(state, hasSavedDecision) {
  return `<section class="universal-hero universal-front-door" data-surface="fde-hero" aria-labelledby="universal-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <h1 id="universal-title">What are you considering?</h1>
    <div class="universal-entry">
      <label class="sr-only" for="universal-input">What are you considering?</label>
      <textarea id="universal-input" rows="7" aria-describedby="universal-limit universal-handling" placeholder="Type or paste anything relevant…">${escapeHtml(state.startingPoint)}</textarea>
      <p id="universal-limit" class="universal-limit" role="status" hidden></p>
      <div class="universal-actions"><button id="universal-analyze" class="primary" type="button">Continue</button></div>
      ${hasSavedDecision ? '<p class="universal-return"><a href="#/decision">Continue saved work →</a></p>' : ''}
      <p id="universal-handling" class="universal-trust">Browser-local. Public or sanitized material only.</p>
      <p id="universal-status" class="sr-only" role="status" aria-live="polite"></p>
    </div>
  </section>`;
}

function briefMarkup(state, hasSavedDecision) {
  const canCompare = Boolean(state.possibleDecision) || state.decisionCandidates.length > 0;
  return `<section class="universal-hero universal-post-input" data-surface="fde-hero" aria-labelledby="universal-response-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <div class="universal-structure universal-brief" data-fde-status="brief">
      <div class="universal-structure-head"><h1 id="universal-response-title">Decision brief</h1></div>
      ${briefDecisionMarkup(state)}
      ${supportableSection('What matters', 'what_matters', state.goals, 'Not established yet.')}
      ${supportableSection("What's still unclear", 'uncertainty', briefUnknowns(state), 'Nothing obvious from the supplied context.')}
      ${supportableSection('Next useful move', 'next_useful_move', nextUsefulMove(state))}
      ${hingeMarkup(state)}
      ${preservedMarkup(state)}
      <div class="universal-actions universal-brief-actions">
        <button id="universal-refine" class="quiet" type="button">Refine</button>
        ${canCompare ? '<button id="universal-compare" class="quiet" type="button">Compare options</button>' : ''}
        ${hasSavedDecision ? '<a class="button quiet" href="#/decision">Continue saved work</a>' : ''}
        <button id="universal-start-over" class="quiet" type="button">Start another</button>
      </div>
      <details class="universal-trace"><summary>See how FDE got here</summary><p>FDE organized only what appeared in the supplied context. The original text remains the source context and is not treated as evidence by itself.</p><pre>${escapeHtml(state.startingPoint)}</pre></details>
      <p class="universal-trust">Browser-local. Public or sanitized material only. The brief is working context, not a Decision Receipt.</p>
      <p id="universal-status" class="sr-only" role="status" aria-live="polite"></p>
    </div>
  </section>`;
}

function checkboxList(name, values, selected, max) {
  if (!values.length) return '<p class="universal-empty">None detected yet. Add items below if you want to compare.</p>';
  return `<div class="universal-check-list" data-limit="${max}">${values.map((value, index) => {
    const checked = selected.includes(value) ? ' checked' : '';
    return `<label><input type="checkbox" name="${name}" value="${escapeHtml(value)}"${checked}> <span>${escapeHtml(value)}</span></label>`;
  }).join('')}</div>`;
}

function decisionChoiceMarkup(state) {
  const decisions = state.decisionCandidates.length ? state.decisionCandidates : state.possibleDecision ? [state.possibleDecision] : [];
  if (decisions.length <= 1) {
    return `<label class="universal-compare-field"><span>Decision</span><input id="universal-decision-text" type="text" value="${escapeHtml(decisions[0] || '')}" placeholder="State the decision to compare"></label>`;
  }
  return `<fieldset class="universal-compare-field"><legend>Decision</legend><div class="universal-radio-list">${decisions.map((decision, index) => `<label><input type="radio" name="formal-decision" value="${escapeHtml(decision)}"${index === 0 ? ' checked' : ''}> <span>${escapeHtml(decision)}</span></label>`).join('')}</div></fieldset>`;
}

function compareMarkup(state) {
  const selectedChoices = state.selectedChoices.length ? state.selectedChoices : state.choices.slice(0, FORMAL_LIMITS.choices.max);
  const selectedGoals = state.selectedGoals.length ? state.selectedGoals : state.goals.slice(0, FORMAL_LIMITS.goals.max);
  const selectedFutures = state.selectedFutures.length ? state.selectedFutures : state.futures.slice(0, FORMAL_LIMITS.futures.max);
  const hinge = state.hingeCandidate;
  return `<section class="universal-hero universal-post-input" data-surface="fde-hero" aria-labelledby="universal-response-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <div class="universal-structure universal-compare" data-fde-status="compare-setup">
      <div class="universal-structure-head"><div><h1 id="universal-response-title">Compare options</h1><p>Optional. Set the bounded formal comparison here, then open Decision Lab.</p></div></div>
      <div class="universal-compare-grid">
        ${decisionChoiceMarkup(state)}
        <fieldset class="universal-compare-field"><legend>Options <small>Select 2–${FORMAL_LIMITS.choices.max}</small></legend>${checkboxList('formal-choice', state.choices, selectedChoices, FORMAL_LIMITS.choices.max)}<label class="universal-add"><span>Add options, one per line</span><textarea id="universal-add-choices" rows="3" placeholder="Optional"></textarea></label></fieldset>
        <fieldset class="universal-compare-field"><legend>What matters <small>Select 2–${FORMAL_LIMITS.goals.max}</small></legend>${checkboxList('formal-goal', state.goals, selectedGoals, FORMAL_LIMITS.goals.max)}<label class="universal-add"><span>Add criteria, one per line</span><textarea id="universal-add-goals" rows="3" placeholder="Optional"></textarea></label></fieldset>
        <fieldset class="universal-compare-field"><legend>What may change <small>Select 2–${FORMAL_LIMITS.futures.max}</small></legend>${checkboxList('formal-future', state.futures, selectedFutures, FORMAL_LIMITS.futures.max)}<label class="universal-add"><span>Add conditions or uncertainties, one per line</span><textarea id="universal-add-futures" rows="3" placeholder="Optional"></textarea></label></fieldset>
        ${hinge ? `<fieldset class="universal-compare-field"><legend>Potential hinge</legend><p class="universal-hinge-quote">${escapeHtml(hinge.text)}</p><div class="universal-radio-list"><label><input type="radio" name="hinge-status" value="yes"> <span>Keep as important</span></label><label><input type="radio" name="hinge-status" value="not_sure" checked> <span>Leave uncertain</span></label><label><input type="radio" name="hinge-status" value="no"> <span>Remove</span></label></div></fieldset>` : ''}
      </div>
      <p id="universal-compare-validation" class="universal-limit" role="status" hidden></p>
      <div class="universal-actions"><button id="universal-open-lab" class="primary" type="button">Open Decision Lab</button><button id="universal-back-brief" class="quiet" type="button">Back to brief</button></div>
      <p class="universal-trust">Formal comparison remains deterministic and human-governed. The comparison informs; a person decides.</p>
    </div>
  </section>`;
}

function boundaryMarkup(title, body, saved = false) {
  return `<section class="universal-hero universal-post-input" data-surface="fde-hero" aria-labelledby="universal-response-title">
    <span class="eyebrow">Frontier Decision Engine</span>
    <section class="universal-boundary" data-fde-status="boundary">
      <h1 id="universal-response-title">${escapeHtml(title)}</h1>
      <p>${escapeHtml(body)}</p>
      <div class="universal-actions">${saved ? '<a class="button primary" href="#/decision">Open Decision Lab</a>' : '<button id="universal-adjust" class="primary" type="button">Adjust</button>'}</div>
      <p class="universal-trust">Browser-local. Public or sanitized material only.</p>
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
    decisionCandidates: Array.isArray(restored.decisionCandidates) ? restored.decisionCandidates : [],
    optionListAmbiguous: Boolean(restored.optionListAmbiguous),
    detectedChoiceCount: Number(restored.detectedChoiceCount) || 0,
    criteriaListAmbiguous: Boolean(restored.criteriaListAmbiguous),
    detectedCriterionCount: Number(restored.detectedCriterionCount) || 0,
    hingeCandidate: restored.hingeCandidate || null,
    choices: Array.isArray(restored.choices) ? restored.choices : [],
    goals: Array.isArray(restored.goals) ? restored.goals : [],
    futures: Array.isArray(restored.futures) ? restored.futures : [],
    selectedChoices: Array.isArray(restored.selectedChoices) ? restored.selectedChoices : [],
    selectedGoals: Array.isArray(restored.selectedGoals) ? restored.selectedGoals : [],
    selectedFutures: Array.isArray(restored.selectedFutures) ? restored.selectedFutures : [],
    view: ['entry', 'brief', 'compare', 'boundary'].includes(restored.view) ? restored.view : 'entry',
    boundaryTitle: restored.boundaryTitle || '',
    boundaryBody: restored.boundaryBody || '',
    savedBoundary: Boolean(restored.savedBoundary),
  };

  const hasSavedDecision = () => Boolean(getBrowserStorage(globalThis)?.getItem?.(DECISION_STORAGE_KEY));

  function setBoundary(title, body, saved = false) {
    state.view = 'boundary';
    state.boundaryTitle = title;
    state.boundaryBody = body;
    state.savedBoundary = saved;
    saveSession(state);
    paint('#universal-response-title');
  }

  function returnToEntry() {
    state.view = 'entry';
    state.boundaryTitle = '';
    state.boundaryBody = '';
    state.savedBoundary = false;
    saveSession(state);
    paint('#universal-input');
  }

  function startAnother() {
    clearSession();
    Object.assign(state, {
      startingPoint: '', intent: '', possibleDecision: '', decisionCandidates: [],
      optionListAmbiguous: false, detectedChoiceCount: 0, criteriaListAmbiguous: false,
      detectedCriterionCount: 0, hingeCandidate: null, choices: [], goals: [], futures: [],
      selectedChoices: [], selectedGoals: [], selectedFutures: [], view: 'entry',
      boundaryTitle: '', boundaryBody: '', savedBoundary: false,
    });
    paint('#universal-input');
  }

  function showInputLimit(message = '') {
    const element = root.querySelector('#universal-limit') || root.querySelector('#universal-compare-validation');
    if (element) {
      element.hidden = false;
      element.textContent = message || `This is longer than FDE can safely structure at once. Keep the working context under ${GUIDED_MAX_INPUT_CHARS.toLocaleString()} characters.`;
    }
  }

  function analyzeEntry() {
    const raw = String(root.querySelector('#universal-input')?.value || '');
    if (raw.length > GUIDED_MAX_INPUT_CHARS) {
      showInputLimit(`This is longer than FDE can safely structure at once. Keep the working context under ${GUIDED_MAX_INPUT_CHARS.toLocaleString()} characters.`);
      root.querySelector('#universal-input')?.focus({ preventScroll: true });
      return;
    }
    state.startingPoint = normalize(raw);
    const draft = draftFromInput(state.startingPoint);
    Object.assign(state, draft, { selectedChoices: [], selectedGoals: [], selectedFutures: [] });
    const response = responseFor(state);
    if (response.kind === 'empty') {
      showInputLimit('Enter a decision, question, or context to continue.');
      root.querySelector('#universal-input')?.focus({ preventScroll: true });
      return;
    }
    if (response.kind === 'boundary') {
      setBoundary(response.title, response.body);
      return;
    }
    state.view = 'brief';
    saveSession(state);
    paint('#universal-response-title');
  }

  function checkedValues(name) {
    return [...root.querySelectorAll(`input[name="${name}"]:checked`)].map((element) => normalize(element.value)).filter(Boolean);
  }

  function enforceCheckboxLimit(name, max) {
    root.querySelectorAll(`input[name="${name}"]`).forEach((checkbox) => checkbox.addEventListener('change', () => {
      const checked = checkedValues(name);
      if (checked.length > max) {
        checkbox.checked = false;
        const label = name === 'formal-choice' ? 'options' : name === 'formal-goal' ? 'criteria' : 'conditions';
        showInputLimit(`Select no more than ${max} ${label} for one formal comparison.`);
      } else {
        const message = root.querySelector('#universal-compare-validation');
        if (message) message.hidden = true;
      }
    }));
  }

  function formalDecision() {
    return normalize(root.querySelector('input[name="formal-decision"]:checked')?.value || root.querySelector('#universal-decision-text')?.value || state.possibleDecision);
  }

  function formalSelections(name, additionsId) {
    return unique([...checkedValues(name), ...splitUserItems(root.querySelector(additionsId)?.value || '')]);
  }

  function openDecisionLab() {
    if (hasSavedDecision()) {
      setBoundary('A saved FDE decision already exists.', 'Open Decision Lab to review it before replacing anything.', true);
      return;
    }
    const decisionText = formalDecision();
    const selectedChoices = formalSelections('formal-choice', '#universal-add-choices');
    const selectedGoals = formalSelections('formal-goal', '#universal-add-goals');
    const selectedFutures = formalSelections('formal-future', '#universal-add-futures');
    const hingeStatus = root.querySelector('input[name="hinge-status"]:checked')?.value || '';
    const hinge = state.hingeCandidate;

    if (hinge && ['yes', 'not_sure'].includes(hingeStatus)) {
      if (hingeStatus === 'yes' && ['hard_requirement', 'deadline'].includes(hinge.basis_type)) {
        if (!selectedGoals.includes(hinge.text) && selectedGoals.length < FORMAL_LIMITS.goals.max) selectedGoals.push(hinge.text);
      } else if (!selectedFutures.includes(hinge.text) && selectedFutures.length < FORMAL_LIMITS.futures.max) {
        selectedFutures.push(hinge.text);
      }
    }

    state.selectedChoices = selectedChoices;
    state.selectedGoals = selectedGoals;
    state.selectedFutures = selectedFutures;
    saveSession(state);

    const errors = [];
    if (!decisionText) errors.push('State one decision to compare.');
    if (selectedChoices.length < FORMAL_LIMITS.choices.min) errors.push(`Select at least ${FORMAL_LIMITS.choices.min} options.`);
    if (selectedChoices.length > FORMAL_LIMITS.choices.max) errors.push(`Select no more than ${FORMAL_LIMITS.choices.max} options.`);
    if (selectedGoals.length < FORMAL_LIMITS.goals.min) errors.push(`Select at least ${FORMAL_LIMITS.goals.min} criteria.`);
    if (selectedGoals.length > FORMAL_LIMITS.goals.max) errors.push(`Select no more than ${FORMAL_LIMITS.goals.max} criteria.`);
    if (selectedFutures.length < FORMAL_LIMITS.futures.min) errors.push(`Select at least ${FORMAL_LIMITS.futures.min} conditions or uncertainties.`);
    if (selectedFutures.length > FORMAL_LIMITS.futures.max) errors.push(`Select no more than ${FORMAL_LIMITS.futures.max} conditions or uncertainties.`);
    if (errors.length) {
      showInputLimit(errors.join(' '));
      root.querySelector('#universal-compare-validation')?.focus?.({ preventScroll: true });
      return;
    }

    const decision = createGuidedDecisionCase({
      objectiveCount: selectedGoals.length,
      strategyCount: selectedChoices.length,
      scenarioCount: selectedFutures.length,
    });
    decision.question = decisionText;
    decision.title = decisionText.slice(0, 120);
    selectedGoals.forEach((label, index) => { decision.objectives[index].label = label; });
    selectedChoices.forEach((label, index) => { decision.strategies[index].label = label; });
    selectedFutures.forEach((label, index) => { decision.scenarios[index].label = label; });

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

  function paint(focusSelector = '') {
    if (state.view === 'brief') root.innerHTML = briefMarkup(state, hasSavedDecision());
    else if (state.view === 'compare') root.innerHTML = compareMarkup(state);
    else if (state.view === 'boundary') root.innerHTML = boundaryMarkup(state.boundaryTitle, state.boundaryBody, state.savedBoundary);
    else root.innerHTML = entryMarkup(state, hasSavedDecision());

    root.querySelector('#universal-input')?.addEventListener('input', (event) => {
      const rawValue = String(event.currentTarget.value || '');
      state.startingPoint = rawValue.slice(0, GUIDED_MAX_INPUT_CHARS + 1);
      const limit = root.querySelector('#universal-limit');
      if (limit && rawValue.length <= GUIDED_MAX_INPUT_CHARS) limit.hidden = true;
      saveSession(state);
    });
    root.querySelector('#universal-input')?.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        analyzeEntry();
      }
    });
    root.querySelector('#universal-analyze')?.addEventListener('click', analyzeEntry);
    root.querySelector('#universal-adjust')?.addEventListener('click', returnToEntry);
    root.querySelector('#universal-refine')?.addEventListener('click', returnToEntry);
    root.querySelector('#universal-start-over')?.addEventListener('click', startAnother);
    root.querySelector('#universal-compare')?.addEventListener('click', () => {
      state.view = 'compare';
      saveSession(state);
      paint('#universal-response-title');
    });
    root.querySelector('#universal-back-brief')?.addEventListener('click', () => {
      state.view = 'brief';
      saveSession(state);
      paint('#universal-response-title');
    });
    root.querySelector('#universal-open-lab')?.addEventListener('click', openDecisionLab);
    enforceCheckboxLimit('formal-choice', FORMAL_LIMITS.choices.max);
    enforceCheckboxLimit('formal-goal', FORMAL_LIMITS.goals.max);
    enforceCheckboxLimit('formal-future', FORMAL_LIMITS.futures.max);

    if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
  }

  paint(state.view === 'entry' ? '#universal-title' : '#universal-response-title');
}