import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DECISION_FILE_BYTES,
  clearSavedDecision,
  canDownloadDraftBackup,
  createDraftBackup,
  getBrowserStorage,
  loadSavedDecision,
  parseDecisionFile,
  parseDecisionText,
  parseDraftBackupText,
  saveDecision,
} from '../site/src/lib/persistence.js';
import {
  createBlankDecisionCase,
  createDecisionCase,
  validateCompletedDecisionCase,
  validateDraftDecisionCase,
} from '../site/src/lib/decision.js';

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

test('partial blank autosave reload preserves exact missing state', () => {
  const local = storage();
  const blank = createBlankDecisionCase();
  blank.title = 'Only a title so far';
  blank.decision_owner = 'Review lead';
  saveDecision(local, blank);
  const restored = loadSavedDecision(local, validateDraftDecisionCase);
  assert.deepEqual(restored.decision, blank);
  assert.equal(restored.decision.question, '');
  assert.equal(restored.decision.objectives[0].threshold, null);
  assert.equal(restored.decision.human_decision.selected_strategy_id, '');
  assert.equal(validateCompletedDecisionCase(restored.decision).valid, false);
});

test('in-progress draft backup round-trips outside the completed portable contract', async () => {
  const blank = createBlankDecisionCase();
  blank.title = 'Backed up partial work';
  blank.question = 'What should change?';
  const backup = createDraftBackup(blank);
  assert.equal(canDownloadDraftBackup(blank), true);
  assert.equal(backup.file_type, 'fde-in-progress-draft-backup');
  assert.equal(backup.decision.schema_version, '0.2.10');
  assert.notEqual(backup.schema_version, '0.2.10');
  const text = JSON.stringify(backup);
  const parsedText = parseDraftBackupText(text, validateDraftDecisionCase);
  assert.equal(parsedText.ok, true);
  assert.deepEqual(parsedText.decision, blank);
  const file = { size: text.length, async text() { return text; } };
  const reopened = await parseDecisionFile(file, validateCompletedDecisionCase, validateDraftDecisionCase);
  assert.equal(reopened.ok, true);
  assert.equal(reopened.kind, 'draft-backup');
  assert.deepEqual(reopened.decision, blank);
  assert.equal(reopened.decision.human_decision.selected_strategy_id, '');
  assert.equal(validateCompletedDecisionCase(reopened.decision).valid, false);
});

test('completed schema 0.2.10 decision file still opens as portable decision', async () => {
  const decision = createDecisionCase();
  decision.human_decision.selected_strategy_id = 'STR-002';
  decision.human_decision.rationale = 'Human rationale.';
  decision.human_decision.next_action = 'Human next action.';
  const text = JSON.stringify(decision);
  const file = { size: text.length, async text() { return text; } };
  const reopened = await parseDecisionFile(file, validateCompletedDecisionCase, validateDraftDecisionCase);
  assert.equal(reopened.ok, true);
  assert.equal(reopened.kind, 'completed-decision');
  assert.deepEqual(reopened.decision, decision);
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
