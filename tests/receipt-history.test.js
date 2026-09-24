import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionCase } from '../site/src/lib/decision.js';
import { createDecisionRecord, validDecisionRecord } from '../site/src/lib/recording.js';
import {
  DECISION_RECORD_HISTORY_STORAGE_KEY, MAX_DECISION_RECORD_HISTORY_ITEMS,
  archiveDecisionRecord, loadDecisionRecordHistory,
} from '../site/src/lib/persistence.js';

function storage({ failSet = false } = {}) {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => { if (failSet && key === DECISION_RECORD_HISTORY_STORAGE_KEY) throw new Error('quota'); values.set(key, value); },
    removeItem: (key) => values.delete(key),
    raw: values,
  };
}

function receipt(recordedAt = '2026-08-15T12:00:00.000Z') {
  const decision = createDecisionCase();
  decision.human_decision.selected_strategy_id = 'STR-002';
  decision.human_decision.rationale = `Human rationale ${recordedAt}`;
  decision.human_decision.next_action = 'Review next milestone.';
  return createDecisionRecord(decision, {
    authority: { role: 'accountable_owner', owner: decision.decision_owner, basis: 'Test authority.' },
    evidenceDisposition: { state: 'ready', unresolved_evidence: [], rationale: '' },
    attestation: { confirmed: true, attested_by: 'Test Owner', attested_role: 'Decision owner' },
    recordedAt,
  });
}

test('valid Receipt v2 is archived and remains independently verifiable', () => {
  const local = storage(); const record = receipt();
  const result = archiveDecisionRecord(local, record);
  assert.equal(result.ok, true); assert.equal(result.archived, true);
  const loaded = loadDecisionRecordHistory(local, record.decision_id);
  assert.equal(loaded.records.length, 1); assert.equal(validDecisionRecord(loaded.records[0]), true);
  assert.equal(loaded.records[0].receipt_sha256, record.receipt_sha256);
});

test('receipt history deduplicates by receipt SHA-256', () => {
  const local = storage(); const record = receipt();
  archiveDecisionRecord(local, record); const second = archiveDecisionRecord(local, record);
  assert.equal(second.ok, true); assert.equal(second.archived, false);
  assert.equal(loadDecisionRecordHistory(local).records.length, 1);
});

test('receipt history is ordered by recorded timestamp', () => {
  const local = storage();
  const later = receipt('2026-08-16T12:00:00.000Z'); const earlier = receipt('2026-08-15T12:00:00.000Z');
  archiveDecisionRecord(local, later); archiveDecisionRecord(local, earlier);
  assert.deepEqual(loadDecisionRecordHistory(local).records.map((r) => r.recorded_at), [earlier.recorded_at, later.recorded_at]);
});

test('corrupted history fails closed instead of being overwritten', () => {
  const local = storage(); local.raw.set(DECISION_RECORD_HISTORY_STORAGE_KEY, '{"format_version":"1","records":[{"bad":true}]}');
  const loaded = loadDecisionRecordHistory(local); assert.equal(loaded.ok, false);
  const result = archiveDecisionRecord(local, receipt()); assert.equal(result.ok, false);
  assert.match(result.status, /invalid|verified/i);
});

test('history storage failure prevents archival', () => {
  const local = storage({ failSet: true });
  const result = archiveDecisionRecord(local, receipt());
  assert.equal(result.ok, false); assert.match(result.status, /No new decision was recorded/i);
});

test('history never evicts prior receipts when the item bound is reached', () => {
  const local = storage();
  const records = [];
  for (let index = 0; index < MAX_DECISION_RECORD_HISTORY_ITEMS; index += 1) {
    const day = String(index + 1).padStart(2, '0');
    const record = receipt(`2026-08-${day}T12:00:00.000Z`); records.push(record);
    assert.equal(archiveDecisionRecord(local, record).ok, true);
  }
  const overflow = receipt('2026-09-01T12:00:00.000Z');
  const result = archiveDecisionRecord(local, overflow);
  assert.equal(result.ok, false); assert.match(result.status, /history is full/i);
  const loaded = loadDecisionRecordHistory(local);
  assert.equal(loaded.records.length, MAX_DECISION_RECORD_HISTORY_ITEMS);
  assert.equal(loaded.records[0].receipt_sha256, records[0].receipt_sha256);
});
