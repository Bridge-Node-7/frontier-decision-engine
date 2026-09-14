const REQUIRED_V02 = [
  'attention_queue', 'candidate_pathways', 'classification', 'compatibility',
  'conditions_to_watch', 'content_sha256', 'critical_unknowns', 'decision_owner',
  'evidence_summary', 'false_redundancy_pairs', 'handling', 'packet_id',
  'proof_requests', 'provenance', 'question', 'schema_version',
  'shared_failure_domains', 'source_graph_id',
];
const REQUIRED_V03 = [
  'attention_queue', 'candidate_pathways', 'classification', 'compatibility',
  'conditions_to_watch', 'critical_unknowns', 'decision_owner', 'evidence_assurance',
  'evidence_summary', 'false_redundancy_pairs', 'freshness', 'handling', 'integrity',
  'origin', 'packet_id', 'proof_requests', 'provenance', 'question', 'schema_version',
  'shared_failure_domains', 'source_graph_id',
];
const SUMMARY_KEYS = ['assumed', 'contradicted', 'expired', 'known', 'unknown'];
const SUPPORTED_CLASSIFICATIONS = new Set(['PRIVATE', 'PROTECTED']);
const SHA256_RE = /^[a-f0-9]{64}$/;
const PACKET_ID_RE = /^DCP-[A-Z0-9-]+$/;
const LEGACY_DIGEST_SCOPE = 'packet excluding provenance.generated_at and content_sha256';
const PAYLOAD_SCOPE = 'decision-relevant packet content excluding integrity, origin, freshness, and provenance';
const ENVELOPE_SCOPE = 'packet excluding integrity.envelope_sha256 and origin.attestation_ref';
const FRESHNESS_STATES = new Set(['CURRENT', 'REVIEW_REQUIRED', 'EXPIRED', 'NOT_ESTABLISHED']);
const EVIDENCE_STATES = new Set(['BOUNDED', 'REVIEW_REQUIRED', 'NOT_ASSESSED']);
const CLOCK_SKEW_MS = 5 * 60 * 1000;
let inMemoryHandoff = null;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, required) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...required].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function stringsOnly(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function objectsOnly(value) {
  return Array.isArray(value) && value.every(isPlainObject);
}

function parseTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

async function sha256Hex(text) {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.subtle) throw new Error('Web Crypto SHA-256 is unavailable in this browser.');
  const bytes = new TextEncoder().encode(text);
  const digest = await cryptoObject.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function legacyDecisionContextDigest(packet) {
  const copy = JSON.parse(JSON.stringify(packet));
  delete copy.content_sha256;
  if (isPlainObject(copy.provenance)) delete copy.provenance.generated_at;
  return sha256Hex(canonicalJson(copy));
}

export async function decisionContextPayloadDigest(packet) {
  const copy = JSON.parse(JSON.stringify(packet));
  delete copy.integrity;
  delete copy.origin;
  delete copy.freshness;
  delete copy.provenance;
  return sha256Hex(canonicalJson(copy));
}

export async function decisionContextEnvelopeDigest(packet) {
  const copy = JSON.parse(JSON.stringify(packet));
  if (isPlainObject(copy.integrity)) delete copy.integrity.envelope_sha256;
  if (isPlainObject(copy.origin)) delete copy.origin.attestation_ref;
  return sha256Hex(canonicalJson(copy));
}

export async function decisionContextDigest(packet) {
  if (!isPlainObject(packet)) throw new Error('Decision Context Packet must be an object.');
  return packet.schema_version === '0.3.0'
    ? decisionContextEnvelopeDigest(packet)
    : legacyDecisionContextDigest(packet);
}

function validateSharedFields(packet, errors) {
  if (!PACKET_ID_RE.test(packet.packet_id || '')) errors.push('Packet identifier is invalid.');
  if (packet.compatibility !== 'FDE_PREPARATION_ONLY') errors.push('Packet is not authorized for FDE preparation use.');
  if (!SUPPORTED_CLASSIFICATIONS.has(packet.classification)) errors.push('Unsupported packet classification.');
  for (const field of ['source_graph_id', 'question', 'decision_owner']) {
    if (typeof packet[field] !== 'string' || !packet[field].trim()) errors.push(`${field} is required.`);
  }
  if (!exactKeys(packet.evidence_summary, SUMMARY_KEYS)) {
    errors.push('Evidence summary fields are invalid.');
  } else {
    for (const key of SUMMARY_KEYS) if (!stringsOnly(packet.evidence_summary[key])) errors.push(`Evidence summary ${key} must contain only text.`);
  }
  for (const field of ['critical_unknowns', 'conditions_to_watch']) {
    if (!stringsOnly(packet[field])) errors.push(`${field} must contain only text.`);
  }
  for (const field of ['candidate_pathways', 'shared_failure_domains', 'proof_requests']) {
    if (!objectsOnly(packet[field])) errors.push(`${field} must contain only objects.`);
  }
  if (!Array.isArray(packet.false_redundancy_pairs) || packet.false_redundancy_pairs.some((item) => !exactKeys(item, ['failure_domain_id', 'left_id', 'right_id']) || Object.values(item).some((value) => typeof value !== 'string'))) {
    errors.push('False-redundancy records are invalid.');
  }
  if (!Array.isArray(packet.attention_queue) || packet.attention_queue.some((item) => !isPlainObject(item) || typeof item.proof_request_id !== 'string' || typeof item.human_owner !== 'string' || !item.human_owner.trim() || typeof item.status !== 'string' || !item.status.trim() || !isPlainObject(item.attention))) {
    errors.push('Attention queue records are invalid.');
  }
  const provenance = packet.provenance;
  if (!isPlainObject(provenance)) {
    errors.push('Packet provenance is missing.');
  } else {
    for (const field of ['source_record_id', 'source_record_sha256', 'model_type', 'probability_model_used', 'values_are_analyst_assigned', 'fde_recorded_decision']) {
      if (!(field in provenance)) errors.push(`Packet provenance is missing ${field}.`);
    }
    if (typeof provenance.source_record_id !== 'string' || !provenance.source_record_id.trim()) errors.push('Source record identifier is invalid.');
    if (!SHA256_RE.test(provenance.source_record_sha256 || '')) errors.push('Source record digest is invalid.');
    if (provenance.probability_model_used !== false) errors.push('Packet claims an unsupported probability model.');
    if (provenance.values_are_analyst_assigned !== false) errors.push('Packet claims analyst-assigned values outside this contract.');
    if (provenance.fde_recorded_decision !== false) errors.push('A Mission Graph packet cannot claim an FDE recorded decision.');
  }
}

async function validateV02(packet, errors) {
  if (!exactKeys(packet, REQUIRED_V02)) {
    errors.push('Packet fields do not match the legacy Mission Graph Decision Context 0.2.0 contract.');
    return;
  }
  validateSharedFields(packet, errors);
  if (!isPlainObject(packet.handling) || packet.handling.release_eligible !== false || typeof packet.handling.instruction !== 'string' || !packet.handling.instruction.trim()) {
    errors.push('Packet handling instructions are invalid.');
  }
  if (!SHA256_RE.test(packet.content_sha256 || '')) errors.push('Packet content digest is invalid.');
  const provenance = packet.provenance;
  if (isPlainObject(provenance)) {
    if (typeof provenance.generated_at !== 'string' || !provenance.generated_at.trim()) errors.push('Packet generation time is invalid.');
    if (provenance.digest_scope !== LEGACY_DIGEST_SCOPE) errors.push('Packet digest scope is unsupported.');
  }
  if (!errors.length) {
    const actualDigest = await legacyDecisionContextDigest(packet);
    if (actualDigest !== packet.content_sha256) errors.push('Packet content digest does not match the governed payload.');
  }
}

function freshnessState(packet, now) {
  const freshness = packet.freshness;
  const issued = parseTimestamp(freshness?.issued_at);
  const sourceAsOf = parseTimestamp(freshness?.source_as_of);
  const reviewDue = freshness?.review_due_at === null ? null : parseTimestamp(freshness?.review_due_at);
  const validUntil = freshness?.valid_until === null ? null : parseTimestamp(freshness?.valid_until);
  if (!issued || !sourceAsOf) return { state: 'INVALID', error: 'Packet freshness timestamps are invalid.' };
  if (sourceAsOf > issued) return { state: 'INVALID', error: 'Packet source_as_of is later than issued_at.' };
  if (issued.getTime() > now.getTime() + CLOCK_SKEW_MS) return { state: 'INVALID', error: 'Packet issued_at is unacceptably future-dated.' };
  if (reviewDue && reviewDue < sourceAsOf) return { state: 'INVALID', error: 'Packet review_due_at is earlier than source_as_of.' };
  if (validUntil && validUntil < sourceAsOf) return { state: 'INVALID', error: 'Packet valid_until is earlier than source_as_of.' };
  if (reviewDue && validUntil && reviewDue > validUntil) return { state: 'INVALID', error: 'Packet review_due_at is later than valid_until.' };
  if (validUntil && now > validUntil) return { state: 'EXPIRED' };
  if (reviewDue && now > reviewDue) return { state: 'REVIEW_REQUIRED' };
  if (!reviewDue && !validUntil) return { state: 'NOT_ESTABLISHED' };
  return { state: 'CURRENT' };
}

async function validateV03(packet, errors, now) {
  if (!exactKeys(packet, REQUIRED_V03)) {
    errors.push('Packet fields do not match the Mission Graph Decision Context 0.3.0 contract.');
    return { freshness: 'INVALID', origin: 'UNAUTHENTICATED', evidence: 'NOT_ASSESSED' };
  }
  validateSharedFields(packet, errors);
  const expectedLabel = packet.classification === 'PROTECTED' ? 'BN7_PROTECTED' : 'BN7_PRIVATE';
  if (!exactKeys(packet.handling, ['government_classification', 'instruction', 'label', 'release_eligible']) || packet.handling.label !== expectedLabel || packet.handling.government_classification !== false || packet.handling.release_eligible !== false || typeof packet.handling.instruction !== 'string' || !packet.handling.instruction.trim()) {
    errors.push('Packet handling boundary is invalid.');
  }
  if (!exactKeys(packet.integrity, ['envelope_scope', 'envelope_sha256', 'payload_scope', 'payload_sha256']) || !SHA256_RE.test(packet.integrity?.payload_sha256 || '') || !SHA256_RE.test(packet.integrity?.envelope_sha256 || '') || packet.integrity?.payload_scope !== PAYLOAD_SCOPE || packet.integrity?.envelope_scope !== ENVELOPE_SCOPE) {
    errors.push('Packet integrity envelope is invalid.');
  }
  if (!exactKeys(packet.origin, ['attestation_ref', 'authentication_state', 'issuer_ref']) || typeof packet.origin?.issuer_ref !== 'string' || !packet.origin.issuer_ref.trim() || !['UNAUTHENTICATED', 'AUTHENTICATED'].includes(packet.origin?.authentication_state) || (packet.origin?.attestation_ref !== null && (typeof packet.origin.attestation_ref !== 'string' || !packet.origin.attestation_ref.trim()))) {
    errors.push('Packet origin metadata is invalid.');
  }
  if (packet.origin?.authentication_state === 'AUTHENTICATED') {
    errors.push('Public FDE cannot accept a self-asserted authenticated origin without an external trust-policy verification mechanism.');
  }
  if (!exactKeys(packet.evidence_assurance, ['limitations', 'state']) || !EVIDENCE_STATES.has(packet.evidence_assurance?.state) || !stringsOnly(packet.evidence_assurance?.limitations)) {
    errors.push('Packet evidence assurance metadata is invalid.');
  }
  if (!exactKeys(packet.freshness, ['issued_at', 'review_due_at', 'source_as_of', 'state', 'supersedes_packet_id', 'valid_until']) || !FRESHNESS_STATES.has(packet.freshness?.state) || (packet.freshness?.supersedes_packet_id !== null && !PACKET_ID_RE.test(packet.freshness.supersedes_packet_id || ''))) {
    errors.push('Packet freshness metadata is invalid.');
  }
  const computedFreshness = freshnessState(packet, now);
  if (computedFreshness.error) errors.push(computedFreshness.error);
  if (!errors.length) {
    const payload = await decisionContextPayloadDigest(packet);
    if (payload !== packet.integrity.payload_sha256) errors.push('Packet payload digest does not match decision-relevant content.');
    const envelope = await decisionContextEnvelopeDigest(packet);
    if (envelope !== packet.integrity.envelope_sha256) errors.push('Packet envelope digest does not match provenance and freshness metadata.');
  }
  return {
    freshness: computedFreshness.state,
    origin: packet.origin?.authentication_state || 'UNAUTHENTICATED',
    evidence: packet.evidence_assurance?.state || 'NOT_ASSESSED',
  };
}

export async function validateDecisionContextPacket(packet, options = {}) {
  const errors = [];
  const now = options.now instanceof Date ? options.now : new Date();
  if (!isPlainObject(packet)) return { valid: false, activeEligible: false, errors: ['Decision Context Packet must be an object.'], trust: null };
  if (packet.schema_version === '0.2.0') {
    try {
      await validateV02(packet, errors);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Legacy packet digest verification failed.');
    }
    return {
      valid: errors.length === 0,
      activeEligible: false,
      errors,
      trust: {
        integrity: errors.length ? 'FAILED' : 'VERIFIED',
        origin: 'UNAUTHENTICATED',
        evidence: 'LEGACY_NOT_ASSESSED',
        freshness: 'LEGACY_NOT_PROVEN',
        authority: 'HUMAN-OWNED',
      },
    };
  }
  if (packet.schema_version !== '0.3.0') {
    return { valid: false, activeEligible: false, errors: ['Unsupported Decision Context Packet version.'], trust: null };
  }
  let trust = null;
  try {
    const state = await validateV03(packet, errors, now);
    trust = {
      integrity: errors.some((message) => /digest|integrity envelope/i.test(message)) ? 'FAILED' : 'VERIFIED',
      origin: state.origin,
      evidence: state.evidence,
      freshness: state.freshness,
      authority: 'HUMAN-OWNED',
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Packet verification failed.');
  }
  const blockingFreshness = trust && trust.freshness !== 'CURRENT';
  return {
    valid: errors.length === 0,
    activeEligible: errors.length === 0 && !blockingFreshness,
    errors,
    trust,
  };
}

export function decisionContextView(packet) {
  const activeProofRequests = (packet.proof_requests || []).filter((item) => !['SATISFIED', 'CANCELLED'].includes(item.status));
  return {
    known: [...packet.evidence_summary.known],
    assumed: [...packet.evidence_summary.assumed],
    disputed: [...packet.evidence_summary.contradicted],
    unknown: [...new Set([...packet.evidence_summary.unknown, ...packet.critical_unknowns])],
    needsProof: activeProofRequests.map((item) => ({
      id: String(item.proof_request_id || 'PROOF_REQUEST'),
      question: String(item.question || 'Additional proof is required.'),
      owner: String(item.human_owner || ''),
      status: String(item.status || ''),
    })),
    expired: [...packet.evidence_summary.expired],
    conditionsToWatch: [...packet.conditions_to_watch],
  };
}

export function setGovernedContextHandoff(packet) {
  inMemoryHandoff = JSON.parse(JSON.stringify(packet));
}

export function consumeGovernedContextHandoff() {
  const packet = inMemoryHandoff;
  inMemoryHandoff = null;
  return packet;
}

export function clearGovernedContextHandoff() {
  inMemoryHandoff = null;
}

export function governedContextSummary(packet) {
  const view = decisionContextView(packet);
  const lines = [
    `Mission Graph context (${packet.classification}; ${packet.compatibility})`,
    `Decision question: ${packet.question}`,
    `Accountable owner: ${packet.decision_owner}`,
  ];
  const add = (label, values) => {
    if (values.length) lines.push(`${label}: ${values.join(' | ')}`);
  };
  add('Known', view.known);
  add('Assumed', view.assumed);
  add('Disputed', view.disputed);
  add('Unknown', view.unknown);
  add('Needs proof', view.needsProof.map((item) => `${item.id}: ${item.question}`));
  add('Expired', view.expired);
  add('Conditions to watch', view.conditionsToWatch);
  lines.push('Preparation context only. This is not evidence, a recommendation, approval, or a recorded FDE decision.');
  return lines.join('\n').slice(0, 12000);
}
