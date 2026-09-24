import { validDecisionRecord } from './recording.js';

export const DECISION_STORAGE_KEY = 'fde.decision.autosave.v0.2.11';
export const DECISION_RECORD_STORAGE_KEY = 'fde.decision.record.v0.3.1';
export const DECISION_AUTHORITY_STORAGE_KEY = 'fde.decision.authority.v1';
export const DECISION_RECORD_HISTORY_STORAGE_KEY = 'fde.decision.record-history.v1';
export const MAX_DECISION_RECORD_HISTORY_ITEMS = 20;
export const MAX_DECISION_RECORD_HISTORY_BYTES = 1_500_000;
export const MAX_DECISION_FILE_BYTES = 1_000_000;
export const MAX_DECISION_DEPTH = 40;
export const MAX_DECISION_NODES = 20_000;
export const DRAFT_BACKUP_TYPE = 'fde-in-progress-draft-backup';
export const DRAFT_BACKUP_VERSION = '1';

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function byteLength(text) {
  const value = String(text);
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
  return value.length * 2;
}

function parseJsonSafely(text) {
  return JSON.parse(text, (key, value) => {
    if (BLOCKED_KEYS.has(key)) throw new Error('blocked-key');
    return value;
  });
}

function inspectStructure(root) {
  const stack = [{ value: root, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const { value, depth } = stack.pop();
    nodes += 1;
    if (nodes > MAX_DECISION_NODES) return { ok: false, reason: 'too-many-nodes' };
    if (depth > MAX_DECISION_DEPTH) return { ok: false, reason: 'too-deep' };
    if (!value || typeof value !== 'object') continue;
    for (const key of Object.keys(value)) {
      if (BLOCKED_KEYS.has(key)) return { ok: false, reason: 'blocked-key' };
      stack.push({ value: value[key], depth: depth + 1 });
    }
  }
  return { ok: true };
}

function readDecisionRecordHistory(storage) {
  if (!storage) return { ok: false, records: [], status: 'Decision history is unavailable in this browser.' };
  try {
    const raw = storage.getItem(DECISION_RECORD_HISTORY_STORAGE_KEY);
    if (!raw) return { ok: true, records: [], status: 'No prior Decision Receipts are preserved in this browser.' };
    if (byteLength(raw) > MAX_DECISION_RECORD_HISTORY_BYTES) return { ok: false, records: [], status: 'Local Decision Receipt history exceeds its verified storage bound.' };
    const parsed = parseJsonSafely(raw);
    if (!parsed || parsed.format_version !== '1' || !Array.isArray(parsed.records)) return { ok: false, records: [], status: 'Local Decision Receipt history could not be verified.' };
    if (parsed.records.length > MAX_DECISION_RECORD_HISTORY_ITEMS) return { ok: false, records: [], status: 'Local Decision Receipt history exceeds its verified item bound.' };
    if (!parsed.records.every((record) => record?.format_version === '2' && validDecisionRecord(record))) return { ok: false, records: [], status: 'Local Decision Receipt history contains an invalid record.' };
    const records = [...parsed.records].sort((a, b) => String(a.recorded_at).localeCompare(String(b.recorded_at)));
    return { ok: true, records, status: `${records.length} prior Decision Receipt${records.length === 1 ? '' : 's'} preserved in this browser.` };
  } catch {
    return { ok: false, records: [], status: 'Local Decision Receipt history could not be verified.' };
  }
}

export function loadDecisionRecordHistory(storage, decisionId = '') {
  const result = readDecisionRecordHistory(storage);
  if (!result.ok || !decisionId) return result;
  const records = result.records.filter((record) => record.decision_id === decisionId);
  return { ...result, records, status: `${records.length} prior Decision Receipt${records.length === 1 ? '' : 's'} preserved for this decision.` };
}

export function archiveDecisionRecord(storage, record) {
  if (!storage) return { ok: false, archived: false, status: 'Decision history is unavailable in this browser.' };
  if (!record || record.format_version !== '2' || !validDecisionRecord(record)) return { ok: false, archived: false, status: 'Only a valid Decision Receipt v2 can be added to local decision history.' };
  const current = readDecisionRecordHistory(storage);
  if (!current.ok) return { ok: false, archived: false, status: current.status };
  if (current.records.some((item) => item.receipt_sha256 === record.receipt_sha256)) return { ok: true, archived: false, status: 'This prior Decision Receipt is already preserved in this browser.' };
  if (current.records.length >= MAX_DECISION_RECORD_HISTORY_ITEMS) return { ok: false, archived: false, status: 'Local Decision Receipt history is full. No new decision was recorded.' };
  const records = [...current.records, structuredClone(record)].sort((a, b) => String(a.recorded_at).localeCompare(String(b.recorded_at)));
  const serialized = JSON.stringify({ format_version: '1', records });
  if (byteLength(serialized) > MAX_DECISION_RECORD_HISTORY_BYTES || !inspectStructure({ format_version: '1', records }).ok) return { ok: false, archived: false, status: 'Local Decision Receipt history reached its safe storage bound. No new decision was recorded.' };
  try {
    storage.setItem(DECISION_RECORD_HISTORY_STORAGE_KEY, serialized);
    return { ok: true, archived: true, status: 'Prior Decision Receipt preserved in this browser.' };
  } catch {
    return { ok: false, archived: false, status: 'The prior Decision Receipt could not be preserved in browser storage. No new decision was recorded.' };
  }
}
export function getBrowserStorage(scope = globalThis) {
  try { return scope?.localStorage || null; } catch { return null; }
}

export function saveDecision(storage, decision, record = null, authority = null) {
  if (!storage || !decision) return { ok: false, status: 'Autosave unavailable in this browser.' };
  try {
    const serialized = JSON.stringify(decision);
    const backup = createDraftBackup(decision, record, authority);
    const backupSerialized = JSON.stringify(backup);
    if (byteLength(backupSerialized) > MAX_DECISION_FILE_BYTES || !inspectStructure(backup).ok) {
      return { ok: false, status: 'This decision is too large for browser autosave or draft backup. Remove some content and try again.' };
    }
    storage.setItem(DECISION_STORAGE_KEY, serialized);
    if (record) storage.setItem(DECISION_RECORD_STORAGE_KEY, JSON.stringify(record));
    else storage.removeItem(DECISION_RECORD_STORAGE_KEY);
    if (authority) storage.setItem(DECISION_AUTHORITY_STORAGE_KEY, JSON.stringify(authority));
    else storage.removeItem(DECISION_AUTHORITY_STORAGE_KEY);
    return { ok: true, status: 'Saved in this browser.' };
  } catch (error) {
    return { ok: false, status: `Autosave unavailable: ${error?.message || 'storage error'}` };
  }
}

export function loadSavedDecision(storage, validateDecision) {
  if (!storage) return { decision: null, record: null, authority: null, status: 'Autosave unavailable in this browser.' };
  try {
    const raw = storage.getItem(DECISION_STORAGE_KEY);
    if (!raw) return { decision: null, record: null, authority: null, status: 'Ready. Changes will save in this browser.' };
    const parsed = parseDecisionText(raw, validateDecision);
    if (!parsed.ok) {
      return { decision: null, record: null, authority: null, status: 'A saved decision needs attention and was not opened automatically.' };
    }
    let record = null;
    let authority = null;
    try { record = parseJsonSafely(storage.getItem(DECISION_RECORD_STORAGE_KEY) || 'null'); } catch { record = null; }
    try { authority = parseJsonSafely(storage.getItem(DECISION_AUTHORITY_STORAGE_KEY) || 'null'); } catch { authority = null; }
    return { decision: parsed.decision, record, authority, status: 'Restored from this browser.' };
  } catch {
    return { decision: null, record: null, authority: null, status: 'A saved decision could not be opened. The ready example was restored.' };
  }
}

export function clearSavedDecision(storage) {
  if (!storage) return;
  try { storage.removeItem(DECISION_STORAGE_KEY); } catch { /* no-op */ }
  try { storage.removeItem(DECISION_RECORD_STORAGE_KEY); } catch { /* no-op */ }
  try { storage.removeItem(DECISION_AUTHORITY_STORAGE_KEY); } catch { /* no-op */ }
}

export function createDraftBackup(decision, record = null, authority = null) {
  return {
    file_type: DRAFT_BACKUP_TYPE,
    format_version: DRAFT_BACKUP_VERSION,
    decision,
    ...(record ? { record } : {}),
    ...(authority ? { authority } : {}),
  };
}

export function canDownloadDraftBackup(decision, record = null, authority = null) {
  const backup = createDraftBackup(decision, record, authority);
  return byteLength(JSON.stringify(backup)) <= MAX_DECISION_FILE_BYTES && inspectStructure(backup).ok;
}

export function parseDecisionText(text, validateDecision) {
  const raw = String(text);
  if (byteLength(raw) > MAX_DECISION_FILE_BYTES) {
    return { ok: false, decision: null, errors: ['The decision file is larger than 1 MB. Open a smaller FDE decision file.'] };
  }
  try {
    const decision = parseJsonSafely(raw);
    const structure = inspectStructure(decision);
    if (!structure.ok) {
      const message = structure.reason === 'too-deep'
        ? 'The decision file structure is too deeply nested.'
        : structure.reason === 'too-many-nodes'
          ? 'The decision file contains too many nested items.'
          : 'The decision file contains a key that is not allowed.';
      return { ok: false, decision: null, errors: [message] };
    }
    const result = validateDecision(decision);
    return result?.valid
      ? { ok: true, decision, errors: [] }
      : { ok: false, decision: null, errors: result?.errors || ['The decision file is not valid.'] };
  } catch (error) {
    const message = error?.message === 'blocked-key'
      ? 'The decision file contains a key that is not allowed.'
      : 'The selected file is not valid JSON.';
    return { ok: false, decision: null, errors: [message] };
  }
}

export function parseDraftBackupText(text, validateDraftDecision) {
  const parsed = parseDecisionText(text, (value) => {
    if (value?.file_type !== DRAFT_BACKUP_TYPE || value?.format_version !== DRAFT_BACKUP_VERSION) {
      return { valid: false, errors: ['The file is not an FDE in-progress draft backup.'] };
    }
    return validateDraftDecision(value.decision);
  });
  return parsed.ok
    ? { ok: true, decision: parsed.decision.decision, record: parsed.decision.record || null, authority: parsed.decision.authority || null, kind: 'draft-backup', errors: [] }
    : { ...parsed, kind: null };
}

export async function parseDecisionFile(file, validateDecision, validateDraftDecision = null) {
  if (!file) return { ok: false, decision: null, errors: ['Choose an FDE decision file to open.'] };
  if (typeof file.size === 'number' && file.size > MAX_DECISION_FILE_BYTES) {
    return { ok: false, decision: null, errors: ['The decision file is larger than 1 MB. Open a smaller FDE decision file.'] };
  }
  try {
    const text = await file.text();
    const raw = String(text);
    if (byteLength(raw) <= MAX_DECISION_FILE_BYTES) {
      try {
        const candidateRecord = parseJsonSafely(raw);
        const structure = inspectStructure(candidateRecord);
        if (structure.ok && validDecisionRecord(candidateRecord)) {
          const validated = validateDecision(candidateRecord.snapshot);
          if (validated?.valid) {
            return {
              ok: true,
              decision: candidateRecord.snapshot,
              record: candidateRecord,
              authority: candidateRecord.authority || null,
              kind: 'completed-record',
              errors: [],
            };
          }
        }
      } catch { /* continue with portable decision parsing */ }
    }
    const portable = parseDecisionText(text, validateDecision);
    if (portable.ok) return { ...portable, kind: 'completed-decision' };
    if (validateDraftDecision) {
      const draft = parseDraftBackupText(text, validateDraftDecision);
      if (draft.ok) return draft;
    }
    return {
      ok: false,
      decision: null,
      kind: null,
      errors: ['The file is neither a completed FDE decision nor a valid in-progress draft backup.'],
    };
  } catch {
    return { ok: false, decision: null, errors: ['The selected decision file could not be read.'] };
  }
}
