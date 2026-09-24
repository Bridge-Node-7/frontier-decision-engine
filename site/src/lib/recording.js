import { APPLICATION_VERSION } from '../version.js';
import { SEMANTIC_SCHEMA_VERSION } from './semantics.js';
import { authorityPermissions, authorityValidation, createAuthority } from './authority.js';
import { canonicalJson, isSha256Hex, sha256Hex } from './integrity.js';
import { decisionRecordability } from './recordability.js';

export const HUMAN_ATTESTATION_STATEMENT = 'I confirm that this records my decision, rationale, and next action. FDE informed the process but did not authorize this decision.';

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
    delete value.human_decision.recorded_sha256;
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

export function decisionContentSha256(decision) {
  return sha256Hex(canonicalJson(substantiveDecision(decision)));
}

export function receiptSha256(record) {
  const copy = structuredClone(record);
  delete copy.receipt_sha256;
  return sha256Hex(canonicalJson(copy));
}

function validTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validLegacyRecord(record) {
  if (!record || record.format_version !== '1') return false;
  if (!/^FDE-[A-Z0-9-]+$/.test(record.decision_id || '')) return false;
  if (!validTimestamp(record.recorded_at)) return false;
  if (!/^fnv1a32-[0-9a-f]{8}$/.test(record.fingerprint || '')) return false;
  if (!record.snapshot || typeof record.snapshot !== 'object' || Array.isArray(record.snapshot)) return false;
  if (record.snapshot.decision_id !== record.decision_id) return false;
  const snapshotRecordedAt = record.snapshot.human_decision?.recorded_at;
  const snapshotFingerprint = record.snapshot.human_decision?.recorded_fingerprint;
  if (snapshotRecordedAt !== undefined || snapshotFingerprint !== undefined) {
    if (snapshotRecordedAt !== record.recorded_at || snapshotFingerprint !== record.fingerprint) return false;
  }
  return decisionFingerprint(record.snapshot) === record.fingerprint;
}

function validV2Record(record) {
  if (!record || record.format_version !== '2') return false;
  if (!/^FDE-[A-Z0-9-]+$/.test(record.decision_id || '')) return false;
  if (!validTimestamp(record.recorded_at)) return false;
  if (!record.snapshot || typeof record.snapshot !== 'object' || Array.isArray(record.snapshot)) return false;
  if (record.snapshot.decision_id !== record.decision_id) return false;
  if (!isSha256Hex(record.decision_content_sha256) || !isSha256Hex(record.receipt_sha256)) return false;
  if (decisionContentSha256(record.snapshot) !== record.decision_content_sha256) return false;

  const producer = record.producer || {};
  if (producer.application !== 'Frontier Decision Engine') return false;
  if (typeof producer.application_version !== 'string' || !producer.application_version) return false;
  if (producer.decision_schema_version !== record.snapshot.schema_version) return false;
  if (typeof producer.semantic_schema_version !== 'string' || !producer.semantic_schema_version) return false;

  const authorityResult = authorityValidation(record.authority, { forRecord: true });
  if (!authorityResult.valid || !authorityPermissions(record.authority).mayRecordDecision) return false;

  const disposition = record.evidence_disposition || {};
  if (!['ready', 'residual-uncertainty'].includes(disposition.state)) return false;
  if (!Array.isArray(disposition.unresolved_evidence) || typeof disposition.rationale !== 'string') return false;
  if (disposition.state === 'residual-uncertainty' && (!disposition.unresolved_evidence.length || !disposition.rationale.trim())) return false;

  const attestation = record.attestation || {};
  if (attestation.type !== 'human-decision-attestation' || attestation.statement_version !== '1') return false;
  if (attestation.statement !== HUMAN_ATTESTATION_STATEMENT) return false;
  if (!String(attestation.attested_by || '').trim() || !String(attestation.attested_role || '').trim()) return false;
  if (!validTimestamp(attestation.attested_at) || attestation.attested_at !== record.recorded_at) return false;
  if (attestation.decision_content_sha256 !== record.decision_content_sha256) return false;

  return receiptSha256(record) === record.receipt_sha256;
}

export function createDecisionRecord(decision, {
  authority,
  attestation,
  evidenceDisposition = { state: 'ready', unresolved_evidence: [], rationale: '' },
  recordedAt = new Date().toISOString(),
} = {}) {
  const substantive = substantiveDecision(decision);
  const recordability = decisionRecordability(substantive);
  if (!recordability.recordable) throw new TypeError('Decision is outside FDE recording scope.');
  const authorityResult = authorityValidation(authority, { forRecord: true });
  if (!authorityResult.valid) throw new TypeError(authorityResult.errors.join(' '));
  if (!attestation?.confirmed) throw new TypeError('Human attestation is required before recording an accountable Decision Receipt.');
  const attestedBy = String(attestation.attested_by || '').trim();
  const attestedRole = String(attestation.attested_role || '').trim();
  if (!attestedBy || !attestedRole) throw new TypeError('Name and role are required for human attestation.');

  const disposition = {
    state: evidenceDisposition?.state || 'ready',
    unresolved_evidence: Array.isArray(evidenceDisposition?.unresolved_evidence) ? [...evidenceDisposition.unresolved_evidence] : [],
    rationale: String(evidenceDisposition?.rationale || '').trim(),
  };
  if (!['ready', 'residual-uncertainty'].includes(disposition.state)) throw new TypeError('Evidence disposition must be ready or residual-uncertainty.');
  if (disposition.state === 'residual-uncertainty' && (!disposition.unresolved_evidence.length || !disposition.rationale)) {
    throw new TypeError('Proceeding under residual uncertainty requires unresolved evidence and a rationale.');
  }

  const snapshot = structuredClone(decision);
  if (!snapshot.urgency) delete snapshot.urgency;
  if (!snapshot.reversibility) delete snapshot.reversibility;
  snapshot.provenance.generated_at = recordedAt;
  const decisionSha = sha256Hex(canonicalJson(substantive));
  const receipt = {
    format_version: '2',
    decision_id: decision.decision_id,
    recorded_at: recordedAt,
    producer: {
      application: 'Frontier Decision Engine',
      application_version: APPLICATION_VERSION,
      decision_schema_version: decision.schema_version,
      semantic_schema_version: SEMANTIC_SCHEMA_VERSION,
    },
    authority: createAuthority(authorityResult.authority),
    decision_content_sha256: decisionSha,
    evidence_disposition: disposition,
    attestation: {
      type: 'human-decision-attestation',
      statement_version: '1',
      statement: HUMAN_ATTESTATION_STATEMENT,
      attested_by: attestedBy,
      attested_role: attestedRole,
      attested_at: recordedAt,
      decision_content_sha256: decisionSha,
    },
    snapshot,
    receipt_sha256: '',
  };
  receipt.receipt_sha256 = receiptSha256(receipt);
  if (!validV2Record(receipt)) throw new TypeError('Decision Receipt v2 integrity verification failed.');
  return receipt;
}

export function validDecisionRecord(record) {
  try {
    return record?.format_version === '2' ? validV2Record(record) : validLegacyRecord(record);
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
  return validLegacyRecord(record) ? record : null;
}

export function recordMatchesDecision(decision, record) {
  if (!validDecisionRecord(record) || record.decision_id !== decision?.decision_id) return false;
  if (record.format_version === '2') return record.decision_content_sha256 === decisionContentSha256(decision);
  return record.fingerprint === decisionFingerprint(decision);
}
