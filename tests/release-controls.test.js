import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function classify(tag) {
  const result = spawnSync('python3', [
    fileURLToPath(new URL('../scripts/verify_release_tag.py', import.meta.url)),
    tag,
    '--classify-only',
    '--json',
  ], { encoding: 'utf8' });
  return result;
}

test('release classifier accepts stable and prerelease tags and rejects malformed tags', () => {
  const stable = classify('v0.3.0');
  assert.equal(stable.status, 0, stable.stderr);
  assert.equal(JSON.parse(stable.stdout).release_kind, 'stable');
  const rc = classify('v0.3.0-rc.1');
  assert.equal(rc.status, 0, rc.stderr);
  const identity = JSON.parse(rc.stdout);
  assert.equal(identity.release_kind, 'prerelease');
  assert.equal(identity.base_version, '0.3.0');
  assert.equal(identity.notes_file, 'docs/releases/v0.3.0-rc.1.md');
  const malformed = classify('v0.3');
  assert.notEqual(malformed.status, 0);
});

test('production release workflow remains tag-only and classifies RC publication explicitly', async () => {
  const workflow = await read('.github/workflows/release.yml');
  assert.match(workflow, /tags:/);
  assert.equal(workflow.includes('workflow_dispatch'), false);
  assert.match(workflow, /--prerelease --latest=false/);
  assert.match(workflow, /release_flags\+=\(--latest\)/);
  assert.match(workflow, /Verify required release notes/);
  assert.ok(workflow.indexOf('Verify required release notes') < workflow.indexOf('Verify npm lockfile'));
  assert.match(workflow, /group: release-\$\{\{ github\.ref \}\}/);
});

test('release preflight is minimally privileged and never publishes', async () => {
  const workflow = await read('.github/workflows/release-preflight.yml');
  assert.match(workflow, /contents: read/);
  assert.equal(workflow.includes('contents: write'), false);
  assert.equal(workflow.includes('gh release create'), false);
  assert.match(workflow, /npm run facts:check/);
  assert.match(workflow, /npm run package:release/);
});

test('historical release note keeps the execution boundary concise', async () => {
  const notes = await read('docs/releases/v0.2.10.md');
  assert.match(notes, /not exercised for\s+this historical release/i);
  assert.ok(notes.split(/\r?\n/).length <= 12);
});
