export const GUIDED_MAX_INPUT_CHARS = 12000;

export const GUIDED_INTENTS = Object.freeze([
  { id: 'find-decision', label: 'Frame the consequential decision' },
  { id: 'untangle', label: 'Clarify mission criteria and constraints' },
  { id: 'compare', label: 'Compare candidate pathways' },
  { id: 'missing', label: 'Identify missing evidence' },
  { id: 'urgent', label: 'Prepare for a near-term decision gate' },
  { id: 'unsure', label: 'I need help framing it' },
]);

export const GUIDED_GOALS = Object.freeze([
  'Readiness', 'Mission performance', 'Supply continuity', 'Schedule',
  'Cost exposure', 'Compliance', 'Resilience', 'Interoperability',
  'Evidence confidence', 'Reversibility',
]);

export const GUIDED_CHOICES = Object.freeze([
  'Maintain the current path',
  'Qualify an alternate source',
  'Redesign around the dependency',
  'Run a bounded pilot first',
  'Gather decision-relevant evidence',
  'Hold pending a defined threshold',
]);

export const GUIDED_FUTURES = Object.freeze([
  'Current conditions persist',
  'Schedule slips',
  'Cost exposure rises',
  'Demand changes',
  'A critical dependency fails',
  'Requirements or regulations change',
  'New evidence resolves a key uncertainty',
]);

export function normalizeIntakeText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

export function validateIntakeText(value) {
  const text = normalizeIntakeText(value);
  if (!text) return { ok: false, text: '', error: 'Start anywhere — even a few words are enough.' };
  if (text.length > GUIDED_MAX_INPUT_CHARS) {
    return {
      ok: false,
      text,
      error: `Keep the starting note under ${GUIDED_MAX_INPUT_CHARS.toLocaleString()} characters.`,
    };
  }
  return { ok: true, text, error: '' };
}

export function uniqueSelections(values, allowed = null) {
  const seen = new Set();
  const output = [];
  for (const raw of values || []) {
    const value = String(raw ?? '').trim();
    if (!value || seen.has(value)) continue;
    if (allowed && !allowed.includes(value)) continue;
    seen.add(value);
    output.push(value);
  }
  return output;
}

export function decisionFrameReady(frame) {
  return Boolean(String(frame?.decision ?? '').trim())
    && (frame?.goals?.length || 0) >= 2
    && (frame?.choices?.length || 0) >= 2
    && (frame?.futures?.length || 0) >= 2;
}

export function buildDecisionFrame({ startingPoint = '', intent = '', decision = '', goals = [], choices = [], futures = [], urgency = '', reversibility = '' } = {}) {
  return {
    startingPoint: normalizeIntakeText(startingPoint),
    intent: GUIDED_INTENTS.some((item) => item.id === intent) ? intent : '',
    decision: String(decision ?? '').trim(),
    goals: uniqueSelections(goals),
    choices: uniqueSelections(choices),
    futures: uniqueSelections(futures),
    urgency: ['today', 'soon', 'time', 'unsure'].includes(urgency) ? urgency : '',
    reversibility: ['easy', 'partly', 'hard', 'unsure'].includes(reversibility) ? reversibility : '',
  };
}

const urgencyLabel = (value) => ({
  today: 'Today',
  soon: 'Soon',
  time: 'I have time',
  unsure: 'Not sure',
}[value] || 'Not specified.');

const reversibilityLabel = (value) => ({
  easy: 'Easy to undo',
  partly: 'Partly reversible',
  hard: 'Hard to undo',
  unsure: 'Not sure',
}[value] || 'Not specified.');

export function frameAsText(frame) {
  const safe = buildDecisionFrame(frame);
  const lines = [
    'FRONTIER DECISION ENGINE — DECISION FRAME',
    '',
    'STARTING POINT',
    safe.startingPoint || 'Not captured yet.',
    '',
    'DECISION',
    safe.decision || 'Not clear yet.',
    '',
    'WHAT MATTERS',
    safe.goals.length ? safe.goals.map((item) => `- ${item}`).join('\n') : 'Not identified yet.',
    '',
    'CHOICES',
    safe.choices.length ? safe.choices.map((item) => `- ${item}`).join('\n') : 'Not identified yet.',
    '',
    'WHAT MAY CHANGE',
    safe.futures.length ? safe.futures.map((item) => `- ${item}`).join('\n') : 'Not identified yet.',
    '',
    'URGENCY',
    urgencyLabel(safe.urgency),
    '',
    'REVERSIBILITY',
    reversibilityLabel(safe.reversibility),
    '',
    'STATUS',
    decisionFrameReady(safe)
      ? 'Ready to continue into a structured comparison if useful.'
      : 'Useful framing in progress. No recommendation has been made.',
    '',
    'The comparison informs. A person decides.',
  ];
  return lines.join('\n');
}
