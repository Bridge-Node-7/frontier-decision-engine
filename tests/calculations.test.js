import test from 'node:test';
import assert from 'node:assert/strict';
import {
  angularExtentFromPixels,
  calculateEvidenceLevel,
  physicalExtentAtRange,
  pointDistance,
  scenarioTable,
} from '../site/src/lib/calculations.js';

test('workbook-compatible angular conversion', () => {
  assert.equal(angularExtentFromPixels(192, 40, 1920), 4);
});

test('symmetric physical extent scenario is deterministic', () => {
  const value = physicalExtentAtRange(4, 10);
  assert.ok(Math.abs(value - 0.6984) < 0.0002);
});

test('point distance uses image-plane Euclidean geometry', () => {
  assert.equal(pointDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('scenario table remains assumption-based', () => {
  const rows = scenarioTable(4, [5, 10]);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.status === 'assumption-based'));
});

test('evidence level stops at Level 2 for v0.1 inputs', () => {
  const data = {
    assets: [{ sha256: 'a'.repeat(64), asset_class: 'original', is_evidence: true }],
    calibration: { horizontal_field_of_view_deg: 40, horizontal_pixels: 1920, status: 'partially-calibrated' },
    measurements: [{ pixel_extent: 100 }],
  };
  assert.equal(calculateEvidenceLevel(data), 2);
});



test('estimated calibration cannot promote a case to Level 2', () => {
  const data = {
    assets: [{ sha256: 'a'.repeat(64), asset_class: 'original', is_evidence: true }],
    calibration: { horizontal_field_of_view_deg: 40, horizontal_pixels: 1920, status: 'estimated' },
    measurements: [{ pixel_extent: 100 }],
  };
  assert.equal(calculateEvidenceLevel(data), 1);
});

test('generated visualizations never raise the evidence level', () => {
  const data = {
    assets: [{ sha256: 'a'.repeat(64), asset_class: 'generated', is_evidence: false }],
    calibration: { horizontal_field_of_view_deg: 40, horizontal_pixels: 1920, status: 'calibrated' },
    measurements: [{ pixel_extent: 100 }],
  };
  assert.equal(calculateEvidenceLevel(data), 0);
});
