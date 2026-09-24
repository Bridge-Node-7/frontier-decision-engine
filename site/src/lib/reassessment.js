const same = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

export function decisionDelta(previous, current) {
  if (!previous || !current) return [];
  const changes = [];
  const add = (kind, label, before, after) => changes.push({ kind, label, before, after });
  const framingBefore = { title: previous.title, question: previous.question, decision_owner: previous.decision_owner, time_horizon: previous.time_horizon, urgency: previous.urgency, reversibility: previous.reversibility };
  const framingAfter = { title: current.title, question: current.question, decision_owner: current.decision_owner, time_horizon: current.time_horizon, urgency: current.urgency, reversibility: current.reversibility };
  if (!same(framingBefore, framingAfter)) add('framing', 'Decision framing changed.', framingBefore, framingAfter);
  if (!same(previous.evidence_summary, current.evidence_summary)) add('evidence', 'Evidence summary changed.', previous.evidence_summary, current.evidence_summary);
  if (!same(previous.objectives, current.objectives)) add('criteria', 'Decision goals or thresholds changed.', previous.objectives, current.objectives);
  if (!same(previous.strategies, current.strategies)) add('choices', 'Choices or modeled choice inputs changed.', previous.strategies, current.strategies);
  if (!same({ uncertainties: previous.uncertainties, scenarios: previous.scenarios }, { uncertainties: current.uncertainties, scenarios: current.scenarios })) add('futures', 'Modeled futures or uncertainties changed.', { uncertainties: previous.uncertainties, scenarios: previous.scenarios }, { uncertainties: current.uncertainties, scenarios: current.scenarios });
  if (!same(previous.decision_semantics, current.decision_semantics)) add('assurance', 'Assurance conditions or evidence state changed.', previous.decision_semantics, current.decision_semantics);
  if (!same(previous.human_decision, current.human_decision)) add('human-decision', 'Human decision fields changed.', previous.human_decision, current.human_decision);
  if (!same(previous.adaptive_pathway, current.adaptive_pathway)) add('reassessment', 'Monitoring, triggers, contingencies, or reassessment conditions changed.', previous.adaptive_pathway, current.adaptive_pathway);
  return changes;
}
