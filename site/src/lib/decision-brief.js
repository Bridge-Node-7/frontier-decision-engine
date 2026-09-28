const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

export const NO_REQUIRED_PROOF_MESSAGE = 'No required proof currently blocks the formal evidence gate.';
export const UNNAMED_REQUIRED_PROOF_MESSAGE = 'Required proof remains unresolved. Name the evidence needed for each required criterion.';


export function preparedBottomLine({
  assurancePosture = '',
  leadingChoice = '',
  evidenceReadiness = 'ready',
} = {}) {
  const posture = clean(assurancePosture).toUpperCase();
  const choice = clean(leadingChoice);
  if (evidenceReadiness === 'proof-required') {
    return 'HOLD — required evidence remains unresolved.';
  }
  if (posture === 'STOP') return 'DO NOT PROCEED — a required criterion failed.';
  if (posture === 'REWORK') return 'REWORK BEFORE COMMITMENT — required remediation remains open.';
  if (posture === 'HOLD') return 'HOLD — the declared assurance posture does not support commitment yet.';
  if (posture === 'ADVANCE WITH CONDITIONS') return 'PROCEED WITH CONDITIONS — the declared assurance posture supports bounded advancement.';
  if (posture === 'ADVANCE') return 'PROCEED — the declared assurance posture supports advancement.';
  if (choice && !/^(?:Tie:|No acceptable choice|More complete information needed|No unique leader)/i.test(choice)) {
    return `COMPARISON ONLY — ${choice} currently holds up in the declared model.`;
  }
  return 'HOLD — the formal comparison does not yet support one clear next path.';
}

export function nextProofPresentation({ readinessState = 'ready', nextProof = [] } = {}) {
  const items = Array.isArray(nextProof) ? nextProof.map(clean).filter(Boolean) : [];
  const proofRequired = readinessState === 'proof-required';
  return {
    items,
    emptyMessage: proofRequired ? UNNAMED_REQUIRED_PROOF_MESSAGE : NO_REQUIRED_PROOF_MESSAGE,
    nextAction: proofRequired
      ? 'Resolve the required proof before adding confidence to the decision basis.'
      : 'Continue to Choose next step. The comparison informs; a person decides.',
  };
}

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
  evidenceReadiness = 'ready',
  scoreProvenance = [],
  nextAction = '',
} = {}) {
  const proof = nextProofPresentation({ readinessState: evidenceReadiness, nextProof });
  const bottomLine = preparedBottomLine({ assurancePosture, leadingChoice, evidenceReadiness });
  return [
    'Frontier Decision Engine — Decision Brief',
    'Working brief — not a Decision Receipt',
    '',
    `Prepared bottom line: ${bottomLine}`,
    `Why: ${clean(controllingIssue) || 'The comparison reflects the declared goals, thresholds, evidence state, and modeled futures.'}`,
    '',
    `Decision: ${clean(decision) || 'Not framed'}`,
    `Decision owner: ${clean(owner) || 'Not established'}`,
    `Authority: ${clean(authority) || 'Not established'}`,
    '',
    `What held up: ${clean(leadingChoice) || 'No unique leader'}`,
    `Selected choice: ${clean(selectedChoice) || 'No human selection'}`,
    `Assurance posture: ${clean(assurancePosture) || 'Inactive'}`,
    '',
    'What could change it:',
    ...linesFor(changes, 'No explicit change condition is currently surfaced by the formal model.'),
    '',
    'Next Proof:',
    ...linesFor(proof.items, proof.emptyMessage),
    '',
    'Score provenance:',
    ...linesFor(scoreProvenance, 'No per-score provenance is documented in this working brief.'),
    '- Normalized values are not probabilities or native measurements; use only the precision the evidence supports.',
    '',
    `Next action: ${clean(nextAction) || 'No human next action recorded yet.'}`,
    '',
    'The comparison informs. A person decides.',
    '',
  ].join('\n');
}
