import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson,
  clearGovernedContextHandoff,
  consumeGovernedContextHandoff,
  decisionContextDigest,
  decisionContextView,
  governedContextSummary,
  setGovernedContextHandoff,
  validateDecisionContextPacket,
} from '../site/src/lib/governed-context.js';

async function packetFixture() {
  const packet = {
    schema_version: '0.2.0',
    packet_id: 'DCP-SYNTHETIC-001',
    compatibility: 'FDE_PREPARATION_ONLY',
    classification: 'PRIVATE',
    handling: {
      release_eligible: false,
      instruction: 'Internal preparation context only.',
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
    attention_queue: [],
    conditions_to_watch: ['Supplier status changes'],
    content_sha256: '0'.repeat(64),
    provenance: {
      source_record_id: 'CLM-SYNTHETIC-001',
      source_record_sha256: 'a'.repeat(64),
      generated_at: '2026-09-13T17:00:00+00:00',
      digest_scope: 'packet excluding provenance.generated_at and content_sha256',
      model_type: 'evidence-bound interoperability context',
      probability_model_used: false,
      values_are_analyst_assigned: false,
      fde_recorded_decision: false,
    },
  };
  packet.content_sha256 = await decisionContextDigest(packet);
  return packet;
}

test('canonical JSON sorts object keys without reordering arrays', () => {
  assert.equal(canonicalJson({ z: 1, a: ['b', { y: 2, x: 1 }] }), '{"a":["b",{"x":1,"y":2}],"z":1}');
});

test('valid Mission Graph Decision Context Packet verifies locally', async () => {
  const packet = await packetFixture();
  const result = await validateDecisionContextPacket(packet);
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('digest mismatch fails closed', async () => {
  const packet = await packetFixture();
  packet.question += ' changed';
  const result = await validateDecisionContextPacket(packet);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => /digest does not match/i.test(message)));
});

test('unsupported compatibility cannot enter FDE preparation', async () => {
  const packet = await packetFixture();
  packet.compatibility = 'AUTONOMOUS_DECISION';
  packet.content_sha256 = await decisionContextDigest(packet);
  const result = await validateDecisionContextPacket(packet);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => /not authorized/i.test(message)));
});

test('packet cannot claim release eligibility or a recorded FDE decision', async () => {
  const packet = await packetFixture();
  packet.handling.release_eligible = true;
  packet.provenance.fde_recorded_decision = true;
  packet.content_sha256 = await decisionContextDigest(packet);
  const result = await validateDecisionContextPacket(packet);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => /handling instructions/i.test(message)));
  assert.ok(result.errors.some((message) => /cannot claim an FDE recorded decision/i.test(message)));
});

test('only PRIVATE and PROTECTED packets are accepted', async () => {
  const packet = await packetFixture();
  packet.classification = 'PUBLIC';
  packet.content_sha256 = await decisionContextDigest(packet);
  const result = await validateDecisionContextPacket(packet);
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
  assert.deepEqual(view.expired, ['E-5: Prior observation is stale']);
  assert.deepEqual(view.conditionsToWatch, ['Supplier status changes']);
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
