import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DECISION_FILE_BYTES,
  clearSavedDecision,
  getBrowserStorage,
  loadSavedDecision,
  parseDecisionFile,
  parseDecisionText,
  saveDecision,
} from '../site/src/lib/persistence.js';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
const valid = (value) => ({ valid: value?.schema_version === '0.2.10', errors: ['schema mismatch'] });

test('decision autosave round-trips through browser storage', () => {
  const local = storage();
  const decision = { schema_version: '0.2.10', title: 'Example' };
  assert.equal(saveDecision(local, decision).ok, true);
  assert.deepEqual(loadSavedDecision(local, valid).decision, decision);
});

test('invalid saved decisions fail closed', () => {
  const local = storage();
  saveDecision(local, { schema_version: 'wrong' });
  assert.equal(loadSavedDecision(local, valid).decision, null);
});

test('decision files are parsed and validated before opening', () => {
  assert.equal(parseDecisionText('{"schema_version":"0.2.10"}', valid).ok, true);
  assert.equal(parseDecisionText('{"schema_version":"wrong"}', valid).ok, false);
  assert.equal(parseDecisionText('not json', valid).ok, false);
});

test('reset removes the local autosave', () => {
  const local = storage();
  saveDecision(local, { schema_version: '0.2.10' });
  clearSavedDecision(local);
  assert.equal(loadSavedDecision(local, valid).decision, null);
});

test('storage access fails safely when the browser blocks local storage', () => {
  const scope = {};
  Object.defineProperty(scope, 'localStorage', { get() { throw new Error('blocked'); } });
  assert.equal(getBrowserStorage(scope), null);
});

test('oversized decision text is rejected', () => {
  const oversized = 'x'.repeat(MAX_DECISION_FILE_BYTES + 1);
  const result = parseDecisionText(oversized, valid);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /larger than 1 MB/i);
});

test('prototype-related keys are rejected', () => {
  const result = parseDecisionText('{"schema_version":"0.2.10","__proto__":{"polluted":true}}', valid);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /not allowed/i);
});

test('deeply nested decision files are rejected', () => {
  let value = '"end"';
  for (let index = 0; index < 45; index += 1) value = `{"level":${value}}`;
  const result = parseDecisionText(value, () => ({ valid: true, errors: [] }));
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /deeply nested/i);
});

test('file size is checked before file text is read', async () => {
  let read = false;
  const file = {
    size: MAX_DECISION_FILE_BYTES + 1,
    async text() { read = true; return '{}'; },
  };
  const result = await parseDecisionFile(file, valid);
  assert.equal(result.ok, false);
  assert.equal(read, false);
});
