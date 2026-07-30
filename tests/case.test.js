import test from 'node:test';
import assert from 'node:assert/strict';
import { createCase, hashFile, validateCase } from '../site/src/lib/case.js';

test('new case begins at evidence level zero', () => {
  const value = createCase();
  assert.equal(value.schema_version, '0.1.0');
  assert.equal(value.evidence_level, 0);
  assert.equal(value.verdict, 'insufficient-evidence');
});

test('browser-compatible SHA-256 hashing is stable', async () => {
  const digest = await hashFile(new Blob(['opv']));
  assert.equal(digest, '4db655bed6b9ed17f91d93c8b9de0a1d615c7e40c8018fd7b39defe187039d95');
});

test('generated assets cannot be evidence', () => {
  const value = createCase();
  value.assets.push({ name: 'concept.png', asset_class: 'generated', is_evidence: true, sha256: 'a'.repeat(64) });
  const result = validateCase(value);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Generated assets')));
});

test('synthetic control case is structurally valid but remains Level 0', async () => {
  const { readFile } = await import('node:fs/promises');
  const value = JSON.parse(await readFile(new URL('../examples/synthetic-calibration-control/case.opv.json', import.meta.url), 'utf8'));
  const result = validateCase(value);
  assert.equal(result.valid, true);
  assert.equal(value.evidence_level, 0);
});
