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
const dangerousRestrictionPattern = new RegExp(
  String.raw`\b(?:stop\s+eating|starv(?:e|ing)(?:\s+myself)?|skip\s+(?:all\s+)?meals?|not\s+eat(?:ing)?|` +
  String.raw`fast(?:ing)?\s+(?:for\s+)?(?:(?:[2-9]|[1-9]\d+)\s+days?|(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+days?|(?:a|one|two|three|four)\s+weeks?))\b`,
  'i',
);

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
    <p class="universal-subtitle">Share a situation, decision, question, or context in your own words.</p>`;
}
