import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = async (name) => JSON.parse(await readFile(new URL(`../site/data/${name}.json`, import.meta.url), 'utf8'));

test('morphology dataset preserves source counts', async () => {
  const data = await load('morphology');
  assert.equal(data.objects.length, 41);
  assert.equal(data.sequences.length, 40);
  assert.equal(data.track_points.filter((item) => item.use_in_summary).length, 169);
  assert.equal(data.summary.orb_objects, 20);
  assert.equal(data.summary.rod_objects, 21);
});

test('experience dataset preserves hierarchy and privacy boundary', async () => {
  const data = await load('experiences');
  assert.equal(data.primary_events.length, 41);
  assert.equal(data.subphases.length, 22);
  assert.ok(data.subphases.every((item) => item.parent_event_id));
  assert.ok(data.primary_events.every((item) => !('location' in item) && !('brief_description' in item)));
  assert.equal(data.summary.all_subphases_share_one_category_template, true);
});

test('reference dataset remains a mapping, not verified evidence', async () => {
  const data = await load('references');
  assert.equal(data.references.length, 53);
  assert.ok(data.references.every((item) => item.verification_status === 'workbook_mapping_only'));
});
