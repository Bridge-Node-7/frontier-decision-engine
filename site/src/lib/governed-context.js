const REQUIRED_TOP_LEVEL = [
  'attention_queue',
  'candidate_pathways',
  'classification',
  'compatibility',
  'conditions_to_watch',
  'content_sha256',
  'critical_unknowns',
  'decision_owner',
  'evidence_summary',
  'false_redundancy_pairs',
  'handling',
  'packet_id',
  'proof_requests',
  'provenance',
  'question',
  'schema_version',
  'shared_failure_domains',
  'source_graph_id',
];

const SUMMARY_KEYS = ['assumed', 'contradicted', 'expired', 'known', 'unknown'];
const SUPPORTED_CLASSIFICATIONS = new Set(['PRIVATE', 'PROTECTED']);
const SHA256_RE = /^[a-f0-9]{64}$/;
const PACKET_ID_RE = /^DCP-[A-Z0-9-]+$/;
const DIGEST_SCOPE = 'packet excluding provenance.generated_at and content_sha256';
let inMemoryHandoff = null;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, required) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === required.length && actual.every((key, index) => key === [...required].sort()[index]);
}

function stringsOnly(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function objectsOnly(value) {
  return Array.isArray(value) && value.every(isPlainObject);
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

export async function decisionContextDigest(packet) {
  if (!isPlainObject(packet)) throw new Error('Decision Context Packet must be an object.');
  const copy = JSON.parse(JSON.stringify(packet));
  delete copy.content_sha256;
  if (isPlainObject(copy.provenance)) delete copy.provenance.generated_at;
  return sha256Hex(canonicalJson(copy));
}

export async function validateDecisionContextPacket(packet) {
  const errors = [];
  if (!exactKeys(packet, REQUIRED_TOP_LEVEL)) {
    return { valid: false, errors: ['Packet fields do not match the supported Mission Graph Decision Context contract.'] };
  }
  if (packet.schema_version !== '0.2.0') errors.push('Unsupported Decision Context Packet version.');
  if (!PACKET_ID_RE.test(packet.packet_id || '')) errors.push('Packet identifier is invalid.');
  if (packet.compatibility !== 'FDE_PREPARATION_ONLY') errors.push('Packet is not authorized for FDE preparation use.');
  if (!SUPPORTED_CLASSIFICATIONS.has(packet.classification)) errors.push('Unsupported packet classification.');
  if (!isPlainObject(packet.handling) || packet.handling.release_eligible !== false || typeof packet.handling.instruction !== 'string' || !packet.handling.instruction.trim()) {
    errors.push('Packet handling instructions are invalid.');
  }
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
  if (!SHA256_RE.test(packet.content_sha256 || '')) errors.push('Packet content digest is invalid.');

  const provenance = packet.provenance;
  if (!isPlainObject(provenance)) {
    errors.push('Packet provenance is missing.');
  } else {
    const required = ['source_record_id', 'source_record_sha256', 'generated_at', 'digest_scope', 'model_type', 'probability_model_used', 'values_are_analyst_assigned', 'fde_recorded_decision'];
    for (const field of required) if (!(field in provenance)) errors.push(`Packet provenance is missing ${field}.`);
    if (typeof provenance.source_record_id !== 'string' || !provenance.source_record_id.trim()) errors.push('Source record identifier is invalid.');
    if (!SHA256_RE.test(provenance.source_record_sha256 || '')) errors.push('Source record digest is invalid.');
    if (typeof provenance.generated_at !== 'string' || !provenance.generated_at.trim()) errors.push('Packet generation time is invalid.');
    if (provenance.digest_scope !== DIGEST_SCOPE) errors.push('Packet digest scope is unsupported.');
    if (provenance.probability_model_used !== false) errors.push('Packet claims an unsupported probability model.');
    if (provenance.values_are_analyst_assigned !== false) errors.push('Packet claims analyst-assigned values outside this contract.');
    if (provenance.fde_recorded_decision !== false) errors.push('A Mission Graph packet cannot claim an FDE recorded decision.');
  }

  if (!errors.length) {
    try {
      const actualDigest = await decisionContextDigest(packet);
      if (actualDigest !== packet.content_sha256) errors.push('Packet content digest does not match the governed payload.');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Packet digest verification failed.');
    }
  }

  return { valid: errors.length === 0, errors };
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
