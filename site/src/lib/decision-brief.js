const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const linesFor = (items, fallback) => {
  const values = Array.isArray(items) ? items.map(clean).filter(Boolean) : [];
  return values.length ? values.map((item) => `- ${item}`) : [`- ${fallback}`];
};

export function buildDecisionBriefText({
  decision = '',
  owner = '',
  authority = '',
  leadingChoice = 'No unique leader',
  selectedChoice = 'No human selection',
  assurancePosture = 'Inactive',
  controllingIssue = '',
  changes = [],
  nextProof = [],
  nextAction = '',
} = {}) {
  return [
    'Frontier Decision Engine — Decision Brief',
    'Working brief — not a Decision Receipt',
    '',
    `Decision: ${clean(decision) || 'Not framed'}`,
    `Decision owner: ${clean(owner) || 'Not established'}`,
    `Authority: ${clean(authority) || 'Not established'}`,
    '',
    `What held up: ${clean(leadingChoice) || 'No unique leader'}`,
    `Selected choice: ${clean(selectedChoice) || 'No human selection'}`,
    `Assurance posture: ${clean(assurancePosture) || 'Inactive'}`,
    `Why: ${clean(controllingIssue) || 'The comparison reflects the declared goals, thresholds, and modeled futures.'}`,
    '',
    'What could change it:',
    ...linesFor(changes, 'No explicit change condition is currently surfaced by the formal model.'),
    '',
    'Next Proof:',
    ...linesFor(nextProof, 'No required proof currently blocks the formal evidence gate.'),
    '',
    `Next action: ${clean(nextAction) || 'No human next action recorded yet.'}`,
    '',
    'The comparison informs. A person decides.',
    '',
  ].join('\n');
}
