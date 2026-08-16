import { CANDIDATE_STATE, robustCandidateDecision } from './decision.js';
import { decisionPosture, semanticView, summarizeFourP } from './semantics.js';

const list = (value) => Array.isArray(value) ? value : [];

function reasonCategory(decision, posture) {
  const semantics = semanticView(decision);
  if (posture.posture && posture.posture !== posture.derived) return 'human-cautious-override';
  if (semantics.posture_enabled && semantics.proceed_conditions_state === 'unreviewed') return 'proceed-conditions-unreviewed';
  if (posture.posture === 'STOP') return 'required-criterion-failed';
  if (posture.posture === 'HOLD') return 'required-evidence-unresolved';
  if (posture.posture === 'REWORK') return 'remediation-open';
  if (posture.posture === 'ADVANCE WITH CONDITIONS') return 'required-condition-open';
  if (posture.posture === 'ADVANCE') return 'proceed-conditions-satisfied';
  return 'posture-inactive';
}

export function deriveDecisionSynthesis(decision, record = null) {
  const candidateResult = robustCandidateDecision(decision);
  const strongest = candidateResult.status === CANDIDATE_STATE.UNIQUE_LEADER ? candidateResult.candidates[0] : null;
  const posture = decisionPosture(decision);
  const semantics = semanticView(decision);
  const selected = (decision?.strategies || []).find((item) => item.strategy_id === decision?.human_decision?.selected_strategy_id);
  const openConditions = [...list(semantics.conditions), ...list(semantics.safeguards)].filter((item) => item.required && item.state === 'open');
  return {
    posture: posture.posture,
    derived_posture: posture.derived,
    reason_category: reasonCategory(decision, posture),
    controlling_issue: posture.why,
    strongest_alternative: strongest ? { strategy_id: strongest.strategy_id, label: strongest.label } : null,
    candidate_state: candidateResult.status,
    four_p: semantics.mode === 'sustainability-seer' ? summarizeFourP(decision) : [],
    changes: posture.changes,
    next_evidence: posture.next_evidence,
    unresolved_conditions: openConditions,
    uncertainty_summary: list(decision?.evidence_summary?.unknown),
    selected_human_choice: selected ? { strategy_id: selected.strategy_id, label: selected.label } : null,
    recorded_human_decision: record?.snapshot ? {
      strategy_id: record.snapshot.human_decision.selected_strategy_id,
      label: record.snapshot.strategies.find((item) => item.strategy_id === record.snapshot.human_decision.selected_strategy_id)?.label || '',
    } : null,
    recorded_rationale: record?.snapshot?.human_decision?.rationale || '',
    recorded_next_action: record?.snapshot?.human_decision?.next_action || '',
  };
}
