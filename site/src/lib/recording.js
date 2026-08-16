function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function substantiveDecision(decision) {
  const value = structuredClone(decision);
  if (!value.urgency) delete value.urgency;
  if (!value.reversibility) delete value.reversibility;
  if (value.provenance) delete value.provenance.generated_at;
  if (value.human_decision) {
    delete value.human_decision.recorded_at;
    delete value.human_decision.recorded_fingerprint;
    delete value.human_decision.approved_by;
    delete value.human_decision.approved_at;
  }
  return value;
}

export function decisionFingerprint(decision) {
  const text = JSON.stringify(stableValue(substantiveDecision(decision)));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createDecisionRecord(decision, recordedAt = new Date().toISOString()) {
  const snapshot = structuredClone(decision);
  if (!snapshot.urgency) delete snapshot.urgency;
  if (!snapshot.reversibility) delete snapshot.reversibility;
  snapshot.provenance.generated_at = recordedAt;
  const fingerprint = decisionFingerprint(decision);
  snapshot.human_decision.recorded_at = recordedAt;
  snapshot.human_decision.recorded_fingerprint = fingerprint;
  return {
    format_version: '1',
    decision_id: decision.decision_id,
    recorded_at: recordedAt,
    fingerprint,
    snapshot,
  };
}

export function validDecisionRecord(record) {
  try {
    if (!record || record.format_version !== '1') return false;
    if (!/^FDE-[A-Z0-9-]+$/.test(record.decision_id || '')) return false;
    if (typeof record.recorded_at !== 'string' || Number.isNaN(Date.parse(record.recorded_at))) return false;
    if (!/^fnv1a32-[0-9a-f]{8}$/.test(record.fingerprint || '')) return false;
    if (!record.snapshot || typeof record.snapshot !== 'object' || Array.isArray(record.snapshot)) return false;
    if (record.snapshot.decision_id !== record.decision_id) return false;
    const snapshotRecordedAt = record.snapshot.human_decision?.recorded_at;
    const snapshotFingerprint = record.snapshot.human_decision?.recorded_fingerprint;
    if (snapshotRecordedAt !== undefined || snapshotFingerprint !== undefined) {
      if (snapshotRecordedAt !== record.recorded_at || snapshotFingerprint !== record.fingerprint) return false;
    }
    return decisionFingerprint(record.snapshot) === record.fingerprint;
  } catch {
    return false;
  }
}

export function recordFromPortableDecision(decision) {
  const recordedAt = decision?.human_decision?.recorded_at;
  const fingerprint = decision?.human_decision?.recorded_fingerprint;
  if (typeof recordedAt !== 'string' || typeof fingerprint !== 'string') return null;
  const record = {
    format_version: '1',
    decision_id: decision.decision_id,
    recorded_at: recordedAt,
    fingerprint,
    snapshot: structuredClone(decision),
  };
  return validDecisionRecord(record) ? record : null;
}

export function recordMatchesDecision(decision, record) {
  return validDecisionRecord(record)
    && record.decision_id === decision?.decision_id
    && record.fingerprint === decisionFingerprint(decision);
}
