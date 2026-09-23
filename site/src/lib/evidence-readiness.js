const INSUFFICIENT_EVIDENCE = new Set(['partial', 'unknown', 'contested', 'stale', 'invalid']);

export const EVIDENCE_READINESS = Object.freeze({
  READY: 'ready',
  PROOF_REQUIRED: 'proof-required',
  RESIDUAL_UNCERTAINTY: 'residual-uncertainty',
});

export function decisionEvidenceReadiness(decision) {
  const criteria = Array.isArray(decision?.decision_semantics?.criteria) ? decision.decision_semantics.criteria : [];
  const blocking = criteria.filter((criterion) => criterion?.must_be_true && (
    INSUFFICIENT_EVIDENCE.has(criterion.evidence_state)
    || criterion.outcome === 'not-assessable'
  ));
  const proofRequests = blocking
    .filter((criterion) => String(criterion.evidence_need || '').trim())
    .map((criterion) => ({
      criterion_id: criterion.criterion_id,
      label: criterion.label || criterion.requirement || criterion.criterion_id,
      evidence_need: String(criterion.evidence_need).trim(),
      evidence_state: criterion.evidence_state,
    }));
  return {
    state: blocking.length ? EVIDENCE_READINESS.PROOF_REQUIRED : EVIDENCE_READINESS.READY,
    blocking,
    proof_requests: proofRequests,
  };
}

export function evidenceDisposition({ readiness, proceedUnderResidualUncertainty = false, rationale = '' } = {}) {
  if (readiness?.state !== EVIDENCE_READINESS.PROOF_REQUIRED) {
    return { state: EVIDENCE_READINESS.READY, unresolved_evidence: [], rationale: '' };
  }
  if (!proceedUnderResidualUncertainty) {
    return {
      state: EVIDENCE_READINESS.PROOF_REQUIRED,
      unresolved_evidence: readiness.blocking.map((item) => item.criterion_id),
      rationale: '',
    };
  }
  return {
    state: EVIDENCE_READINESS.RESIDUAL_UNCERTAINTY,
    unresolved_evidence: readiness.blocking.map((item) => item.criterion_id),
    rationale: String(rationale || '').trim(),
  };
}
