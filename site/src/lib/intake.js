export const RESCUE_MAX_INPUT_CHARS = 12000;

export const RESCUE_INTENTS = Object.freeze([
  { id: 'find-decision', label: 'Figure out what I need to decide' },
  { id: 'untangle', label: 'Untangle the problem' },
  { id: 'compare', label: 'Compare choices I already have' },
  { id: 'missing', label: "Figure out what I'm missing" },
  { id: 'urgent', label: 'I need to act soon' },
  { id: 'unsure', label: "I'm not sure" },
]);

export const RESCUE_GOALS = Object.freeze([
  'Time', 'Cost', 'Safety', 'Quality', 'Reliability',
  'People', 'Revenue', 'Flexibility', 'Compliance', 'Learning',
]);

export const RESCUE_CHOICES = Object.freeze([
  'Keep things as they are',
  'Make a change',
  'Wait or delay',
  'Test or pilot first',
  'Gather information first',
  'Stage the decision',
]);

export const RESCUE_FUTURES = Object.freeze([
  'Things stay roughly the same',
  'Timing gets worse',
  'Cost increases',
  'Demand changes',
  'A key dependency fails',
  'Requirements change',
]);

export function normalizeIntakeText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

export function validateIntakeText(value) {
  const text = normalizeIntakeText(value);
  if (!text) return { ok: false, text: '', error: 'Start anywhere — even a few words are enough.' };
  if (text.length > RESCUE_MAX_INPUT_CHARS) {
    return {
      ok: false,
      text,
      error: `Keep the starting note under ${RESCUE_MAX_INPUT_CHARS.toLocaleString()} characters.`,
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
    intent: RESCUE_INTENTS.some((item) => item.id === intent) ? intent : '',
    decision: String(decision ?? '').trim(),
    goals: uniqueSelections(goals),
    choices: uniqueSelections(choices),
    futures: uniqueSelections(futures),
    urgency: ['today', 'soon', 'time', 'unsure'].includes(urgency) ? urgency : '',
    reversibility: ['easy', 'partly', 'hard', 'unsure'].includes(reversibility) ? reversibility : '',
  };
}

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
    safe.urgency || 'Not specified.',
    '',
    'REVERSIBILITY',
    safe.reversibility || 'Not specified.',
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
