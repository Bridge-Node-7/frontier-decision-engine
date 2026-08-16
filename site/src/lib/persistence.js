export const DECISION_STORAGE_KEY = 'fde.decision.autosave.v0.2.11';
export const DECISION_RECORD_STORAGE_KEY = 'fde.decision.record.v0.3.1';
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

export function getBrowserStorage(scope = globalThis) {
  try { return scope?.localStorage || null; } catch { return null; }
}

export function saveDecision(storage, decision, record = null) {
  if (!storage || !decision) return { ok: false, status: 'Autosave unavailable in this browser.' };
  try {
    const serialized = JSON.stringify(decision);
    const backup = createDraftBackup(decision, record);
    const backupSerialized = JSON.stringify(backup);
    if (byteLength(backupSerialized) > MAX_DECISION_FILE_BYTES || !inspectStructure(backup).ok) {
      return { ok: false, status: 'This decision is too large for browser autosave or draft backup. Remove some content and try again.' };
    }
    storage.setItem(DECISION_STORAGE_KEY, serialized);
    if (record) storage.setItem(DECISION_RECORD_STORAGE_KEY, JSON.stringify(record));
    else storage.removeItem(DECISION_RECORD_STORAGE_KEY);
    return { ok: true, status: 'Saved in this browser.' };
  } catch (error) {
    return { ok: false, status: `Autosave unavailable: ${error?.message || 'storage error'}` };
  }
}

export function loadSavedDecision(storage, validateDecision) {
  if (!storage) return { decision: null, status: 'Autosave unavailable in this browser.' };
  try {
    const raw = storage.getItem(DECISION_STORAGE_KEY);
    if (!raw) return { decision: null, record: null, status: 'Ready. Changes will save in this browser.' };
    const parsed = parseDecisionText(raw, validateDecision);
    if (!parsed.ok) {
      return { decision: null, record: null, status: 'A saved decision needs attention and was not opened automatically.' };
    }
    let record = null;
    try { record = parseJsonSafely(storage.getItem(DECISION_RECORD_STORAGE_KEY) || 'null'); } catch { record = null; }
    return { decision: parsed.decision, record, status: 'Restored from this browser.' };
  } catch {
    return { decision: null, record: null, status: 'A saved decision could not be opened. The ready example was restored.' };
  }
}

export function clearSavedDecision(storage) {
  if (!storage) return;
  try { storage.removeItem(DECISION_STORAGE_KEY); } catch { /* no-op */ }
  try { storage.removeItem(DECISION_RECORD_STORAGE_KEY); } catch { /* no-op */ }
}

export function createDraftBackup(decision, record = null) {
  return {
    file_type: DRAFT_BACKUP_TYPE,
    format_version: DRAFT_BACKUP_VERSION,
    decision,
    ...(record ? { record } : {}),
  };
}

export function canDownloadDraftBackup(decision, record = null) {
  const backup = createDraftBackup(decision, record);
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
    ? { ok: true, decision: parsed.decision.decision, record: parsed.decision.record || null, kind: 'draft-backup', errors: [] }
    : { ...parsed, kind: null };
}

export async function parseDecisionFile(file, validateDecision, validateDraftDecision = null) {
  if (!file) return { ok: false, decision: null, errors: ['Choose an FDE decision file to open.'] };
  if (typeof file.size === 'number' && file.size > MAX_DECISION_FILE_BYTES) {
    return { ok: false, decision: null, errors: ['The decision file is larger than 1 MB. Open a smaller FDE decision file.'] };
  }
  try {
    const text = await file.text();
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
