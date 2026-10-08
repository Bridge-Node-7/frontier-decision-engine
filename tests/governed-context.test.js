import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson,
  clearGovernedContextHandoff,
  consumeGovernedContextHandoff,
  decisionContextEnvelopeDigest,
  decisionContextPayloadDigest,
  decisionContextView,
  governedContextSummary,
  setGovernedContextHandoff,
  validateDecisionContextPacket,
} from '../site/src/lib/governed-context.js';

const NOW = new Date('2026-09-14T00:00:00Z');

async function packetFixture(overrides = {}) {
  const packet = {
    schema_version: '0.3.0',
    packet_id: 'DCP-SYNTHETIC-001',
    compatibility: 'FDE_PREPARATION_ONLY',
    classification: 'PRIVATE',
    handling: {
      label: 'BN7_PRIVATE',
      government_classification: false,
      release_eligible: false,
      instruction: 'BN7 internal preparation context only; not a government classification marking.',
    },
    freshness: {
      issued_at: '2026-09-13T17:00:00Z',
      source_as_of: '2026-09-13T16:00:00Z',
      review_due_at: '2026-09-15T00:00:00Z',
      valid_until: '2026-09-16T00:00:00Z',
      supersedes_packet_id: null,
      state: 'CURRENT',
    },
    integrity: {
      payload_sha256: '0'.repeat(64),
      envelope_sha256: '0'.repeat(64),
      payload_scope: 'decision-relevant packet content excluding integrity, origin, freshness, and provenance',
      envelope_scope: 'packet excluding the envelope digest field and origin.attestation_ref',
    },
    origin: {
      authentication_state: 'UNAUTHENTICATED',
      issuer_ref: 'mission-graph:MG-SYNTHETIC-001',
      attestation_ref: null,
    },
    evidence_assurance: {
      state: 'REVIEW_REQUIRED',
      limitations: ['synthetic unknowns remain'],
    },
    source_graph_id: 'MG-SYNTHETIC-001',
    question: 'Which bounded pathway should the accountable human review?',
    decision_owner: 'Human Owner',
    evidence_summary: {
      known: ['E-1: Direct observation'],
      assumed: ['E-2: Planning assumption'],
      unknown: ['E-3: Capacity remains unknown'],
      contradicted: ['E-4: Conflicting source statements'],
      expired: ['E-5: Prior observation is stale'],
    },
    critical_unknowns: ['PR-1: Verify current capacity'],
    candidate_pathways: [],
    shared_failure_domains: [],
    false_redundancy_pairs: [],
    proof_requests: [
      {
        proof_request_id: 'PR-1',
        question: 'Verify current capacity',
        human_owner: 'Human Owner',
        status: 'DRAFT',
      },
    ],
    attention_queue: [
      {
        proof_request_id: 'PR-1',
        human_owner: 'Human Owner',
        status: 'DRAFT',
        attention: {
          mission_consequence: 'HIGH',
          uncertainty: 'HIGH',
          evidence_age: 'STALE',
          change_velocity: 'MODERATE',
          shared_failure_exposure: 'LOW',
          decision_imminence: 'NEAR_TERM',
          human_priority: 'IMMEDIATE',
        },
      },
    ],
    conditions_to_watch: ['Supplier status changes'],
    provenance: {
      source_record_id: 'CLM-SYNTHETIC-001',
      source_record_sha256: 'a'.repeat(64),
      model_type: 'evidence-bound interoperability context',
      probability_model_used: false,
      values_are_analyst_assigned: false,
      fde_recorded_decision: false,
    },
  };
  Object.assign(packet, overrides);
  packet.integrity.payload_sha256 = await decisionContextPayloadDigest(packet);
  packet.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(packet);
  return packet;
}

test('canonical JSON sorts object keys without reordering arrays', () => {
  assert.equal(canonicalJson({ z: 1, a: ['b', { y: 2, x: 1 }] }), '{"a":["b",{"x":1,"y":2}],"z":1}');
});

test('valid Decision Context Packet 0.3 verifies locally with separate trust facets', async () => {
  const packet = await packetFixture();
  const result = await validateDecisionContextPacket(packet, { now: NOW });
  assert.equal(result.valid, true);
  assert.equal(result.activeEligible, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.trust, {
    integrity: 'VERIFIED',
    origin: 'UNAUTHENTICATED',
    evidence: 'REVIEW_REQUIRED',
    freshness: 'CURRENT',
    authority: 'HUMAN-OWNED',
  });
});

test('payload tamper fails closed', async () => {
  const packet = await packetFixture();
  packet.question += ' changed';
  const result = await validateDecisionContextPacket(packet, { now: NOW });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => /payload digest/i.test(message)));
});

test('freshness tamper fails envelope integrity', async () => {
  const packet = await packetFixture();
  packet.freshness.source_as_of = '2026-09-13T16:30:00Z';
  const result = await validateDecisionContextPacket(packet, { now: NOW });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => /envelope digest/i.test(message)));
});

test('future-dated packet fails closed even with recomputed hashes', async () => {
  const packet = await packetFixture();
  packet.freshness.issued_at = '2026-09-15T00:00:00Z';
  packet.freshness.source_as_of = '2026-09-14T23:59:00Z';
  packet.integrity.payload_sha256 = await decisionContextPayloadDigest(packet);
  packet.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(packet);
  const result = await validateDecisionContextPacket(packet, { now: NOW });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => /future-dated/i.test(message)));
});

test('review-due and expired packets remain inspectable but cannot enter active decision preparation', async () => {
  const review = await packetFixture();
  review.freshness.review_due_at = '2026-09-13T20:00:00Z';
  review.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(review);
  let result = await validateDecisionContextPacket(review, { now: NOW });
  assert.equal(result.valid, true);
  assert.equal(result.activeEligible, false);
  assert.equal(result.trust.freshness, 'REVIEW_REQUIRED');

  const expired = await packetFixture();
  expired.freshness.valid_until = '2026-09-13T23:00:00Z';
  expired.freshness.review_due_at = '2026-09-13T22:00:00Z';
  expired.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(expired);
  result = await validateDecisionContextPacket(expired, { now: NOW });
  assert.equal(result.valid, true);
  assert.equal(result.activeEligible, false);
  assert.equal(result.trust.freshness, 'EXPIRED');
});

test('missing freshness boundaries are not active-eligible', async () => {
  const packet = await packetFixture();
  packet.freshness.review_due_at = null;
  packet.freshness.valid_until = null;
  packet.freshness.state = 'NOT_ESTABLISHED';
  packet.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(packet);
  const result = await validateDecisionContextPacket(packet, { now: NOW });
  assert.equal(result.valid, true);
  assert.equal(result.activeEligible, false);
  assert.equal(result.trust.freshness, 'NOT_ESTABLISHED');
});

test('freshness timestamps reject malformed formats, types, and impossible dates with recomputed integrity', async () => {
  const invalid = [
    '', ' ', 'not-a-date', 42, false, {}, [],
    'September 16, 2026', '2026-09-16', '2026-09-16 00:00:00Z',
    '2026-09-16T00:00:00', '2026-09-16T00:00Z',
    '2026-09-16T00:00:00Z\n', '2026-09-16T00:00:00.Z',
    '2026-02-29T00:00:00Z', '1900-02-29T00:00:00Z', '2100-02-29T00:00:00Z',
    '2026-04-31T00:00:00Z', '2026-13-01T00:00:00Z', '2026-09-00T00:00:00Z',
    '2026-09-32T00:00:00Z', '2026-09-16T24:00:00Z', '2026-09-16T00:60:00Z',
    '2026-09-16T00:00:61Z', '2026-09-16T00:00:00+24:00', '2026-09-16T00:00:00+01:60',
  ];
  for (const field of ['issued_at', 'source_as_of', 'review_due_at', 'valid_until']) {
    for (const value of invalid) {
      const packet = await packetFixture();
      packet.freshness[field] = value;
      packet.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(packet);
      const result = await validateDecisionContextPacket(packet, { now: NOW });
      assert.equal(result.valid, false, `${field}: ${JSON.stringify(value)}`);
      assert.equal(result.activeEligible, false);
      assert.equal(result.trust.freshness, 'INVALID');
      assert.ok(result.errors.some((message) => message.includes(field)));
    }
  }
});

test('null is permitted only for nullable freshness boundaries', async () => {
  for (const field of ['issued_at', 'source_as_of']) {
    const packet = await packetFixture();
    packet.freshness[field] = null;
    packet.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(packet);
    const result = await validateDecisionContextPacket(packet, { now: NOW });
    assert.equal(result.valid, false);
    assert.equal(result.activeEligible, false);
    assert.equal(result.trust.freshness, 'INVALID');
    assert.ok(result.errors.some((message) => message.includes(field)));
  }
  for (const field of ['review_due_at', 'valid_until']) {
    const packet = await packetFixture();
    packet.freshness[field] = null;
    packet.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(packet);
    const result = await validateDecisionContextPacket(packet, { now: NOW });
    assert.equal(result.valid, true);
    assert.equal(result.activeEligible, true);
    assert.equal(result.trust.freshness, 'CURRENT');
  }
});

test('RFC 3339 offsets, lower-case separators, fractions, and leap-year dates remain valid', async () => {
  const fields = ['issued_at', 'source_as_of', 'review_due_at', 'valid_until'];
  for (const value of [
    '2026-09-14T00:00:00Z', '2026-09-14t00:00:00z',
    '2026-09-14T00:00:00+00:00', '2026-09-14T00:00:00-00:00',
    '2026-09-14T05:30:00+05:30', '2026-09-13T16:00:00-08:00',
    '2026-09-14T23:59:00+23:59', '2026-09-14T00:00:00.123456Z',
    '2000-02-29T00:00:00Z', '2024-02-29T00:00:00Z',
  ]) {
    const packet = await packetFixture();
    for (const field of fields) packet.freshness[field] = value;
    packet.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(packet);
    const result = await validateDecisionContextPacket(packet, { now: new Date(value) });
    assert.equal(result.valid, true, value);
    assert.equal(result.activeEligible, true);
    assert.equal(result.trust.freshness, 'CURRENT');
    assert.deepEqual(result.errors, []);
  }
});

test('self-asserted authenticated origin is rejected without an external trust verifier', async () => {
  const packet = await packetFixture();
  packet.origin.authentication_state = 'AUTHENTICATED';
  packet.origin.attestation_ref = 'synthetic://attestation/1';
  packet.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(packet);
  const result = await validateDecisionContextPacket(packet, { now: NOW });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => /self-asserted authenticated origin/i.test(message)));
});

test('unsupported compatibility cannot enter FDE preparation', async () => {
  const packet = await packetFixture();
  packet.compatibility = 'AUTONOMOUS_DECISION';
  packet.integrity.payload_sha256 = await decisionContextPayloadDigest(packet);
  packet.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(packet);
  const result = await validateDecisionContextPacket(packet, { now: NOW });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => /not authorized/i.test(message)));
});

test('packet cannot claim release eligibility or government classification', async () => {
  const packet = await packetFixture();
  packet.handling.release_eligible = true;
  packet.handling.government_classification = true;
  packet.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(packet);
  const result = await validateDecisionContextPacket(packet, { now: NOW });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => /handling boundary/i.test(message)));
});

test('only PRIVATE and PROTECTED packets are accepted', async () => {
  const packet = await packetFixture();
  packet.classification = 'PUBLIC';
  packet.integrity.payload_sha256 = await decisionContextPayloadDigest(packet);
  packet.integrity.envelope_sha256 = await decisionContextEnvelopeDigest(packet);
  const result = await validateDecisionContextPacket(packet, { now: NOW });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => /unsupported packet classification/i.test(message)));
});

test('context projection preserves epistemic categories and active ProofRequests', async () => {
  const packet = await packetFixture();
  const view = decisionContextView(packet);
  assert.deepEqual(view.known, ['E-1: Direct observation']);
  assert.deepEqual(view.assumed, ['E-2: Planning assumption']);
  assert.deepEqual(view.disputed, ['E-4: Conflicting source statements']);
  assert.ok(view.unknown.includes('E-3: Capacity remains unknown'));
  assert.ok(view.unknown.includes('PR-1: Verify current capacity'));
  assert.equal(view.needsProof[0].id, 'PR-1');
  assert.equal(view.nextProof.id, 'PR-1');
  assert.equal(view.nextProof.attention.human_priority, 'IMMEDIATE');
  assert.equal(view.nextProof.attention.decision_imminence, 'NEAR_TERM');
  assert.deepEqual(view.expired, ['E-5: Prior observation is stale']);
  assert.deepEqual(view.conditionsToWatch, ['Supplier status changes']);
});

test('next proof preserves Mission Graph attention order instead of calculating a local score', async () => {
  const proofRequests = [
    { proof_request_id: 'PR-1', question: 'First proof', human_owner: 'Human Owner', status: 'DRAFT' },
    { proof_request_id: 'PR-2', question: 'Second proof', human_owner: 'Human Owner', status: 'DRAFT' },
  ];
  const attention = {
    mission_consequence: 'HIGH',
    uncertainty: 'HIGH',
    evidence_age: 'FRESH',
    change_velocity: 'LOW',
    shared_failure_exposure: 'NONE',
    decision_imminence: 'NEAR_TERM',
    human_priority: 'ELEVATED',
  };
  const packet = await packetFixture({
    proof_requests: proofRequests,
    attention_queue: [
      { proof_request_id: 'PR-2', human_owner: 'Human Owner', status: 'DRAFT', attention },
      { proof_request_id: 'PR-1', human_owner: 'Human Owner', status: 'DRAFT', attention: { ...attention, human_priority: 'IMMEDIATE' } },
    ],
  });
  const view = decisionContextView(packet);
  assert.equal(view.nextProof.id, 'PR-2');
  assert.match(governedContextSummary(packet), /Next proof \(Mission Graph human-owned attention order\): PR-2: Second proof/);
});

test('next proof ignores queue entries whose ProofRequest is no longer active', async () => {
  const packet = await packetFixture({
    proof_requests: [
      { proof_request_id: 'PR-1', question: 'Closed proof', human_owner: 'Human Owner', status: 'SATISFIED' },
    ],
  });
  const view = decisionContextView(packet);
  assert.equal(view.nextProof, null);
});

test('governed context handoff is memory-only and single-use', async () => {
  clearGovernedContextHandoff();
  const packet = await packetFixture();
  setGovernedContextHandoff(packet);
  const first = consumeGovernedContextHandoff();
  assert.equal(first.packet_id, packet.packet_id);
  assert.equal(consumeGovernedContextHandoff(), null);
  assert.match(governedContextSummary(first), /Preparation context only/);
});

test('legacy 0.2 packet can be structurally verified but never enters active decision preparation', async () => {
  const packet = {
    schema_version: '0.2.0', packet_id: 'DCP-LEGACY-001', compatibility: 'FDE_PREPARATION_ONLY', classification: 'PRIVATE',
    handling: { release_eligible: false, instruction: 'Internal preparation context only.' },
    source_graph_id: 'MG-LEGACY', question: 'Legacy?', decision_owner: 'Human',
    evidence_summary: { known: [], assumed: [], unknown: [], contradicted: [], expired: [] },
    critical_unknowns: [], candidate_pathways: [], shared_failure_domains: [], false_redundancy_pairs: [], proof_requests: [], attention_queue: [], conditions_to_watch: [],
    content_sha256: '0'.repeat(64),
    provenance: { source_record_id: 'REC', source_record_sha256: 'a'.repeat(64), generated_at: '2026-09-13T00:00:00Z', digest_scope: 'packet excluding provenance.generated_at and content_sha256', model_type: 'legacy', probability_model_used: false, values_are_analyst_assigned: false, fde_recorded_decision: false },
  };
  const { decisionContextDigest } = await import('../site/src/lib/governed-context.js');
  packet.content_sha256 = await decisionContextDigest(packet);
  const result = await validateDecisionContextPacket(packet, { now: NOW });
  assert.equal(result.valid, true);
  assert.equal(result.activeEligible, false);
  assert.equal(result.trust.freshness, 'LEGACY_NOT_PROVEN');
});
