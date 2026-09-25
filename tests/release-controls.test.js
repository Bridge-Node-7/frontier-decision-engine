import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function classify(tag) {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('../scripts/run-python.mjs', import.meta.url)),
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
  assert.equal(identity.notes_file, 'docs/RELEASE_NOTES.md');
  const malformed = classify('v0.3');
  assert.notEqual(malformed.status, 0);
});

test('stable publication is explicit, follows successful Pages UAT, and uses a verified main commit anchor', async () => {
  const workflow = await read('.github/workflows/release.yml');
  assert.match(workflow, /workflow_dispatch:/);
  assert.equal(workflow.includes('workflow_run:'), false);
  assert.equal(/environment:[\s\S]*name: release/.test(workflow), false);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /actions\/workflows\/pages\.yml\/runs/);
  assert.match(workflow, /PAGES_RUN_ID/);
  assert.match(workflow, /\.head_sha ==/);
  assert.match(workflow, /git rev-parse origin\/main/);
  assert.match(workflow, /\.commit\.verification\.verified/);
  assert.match(workflow, /\.commit\.verification\.reason/);
  assert.match(workflow, /Create annotated release tag/);
  assert.match(workflow, /git\/tags/);
  assert.match(workflow, /refs\/tags\/\$TAG/);
  assert.match(workflow, /--verify-tag/);
  assert.match(workflow, /--target "\$RELEASE_COMMIT"/);
  assert.match(workflow, /--prerelease --latest=false/);
  assert.match(workflow, /release_flags\+=\(--latest\)/);
  assert.match(workflow, /Attest deterministic release artifacts/);
  assert.match(workflow, /Download and verify hosted release assets/);
});

test('Pages blocks site drift under an already-published application version', async () => {
  const workflow = await read('.github/workflows/pages.yml');
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /Enforce released-version site immutability/);
  assert.match(workflow, /gh release view "\$TAG"/);
  assert.match(workflow, /git diff --quiet "\$RELEASE_COMMIT" HEAD -- site/);
  assert.match(workflow, /Bump package version before deploying Pages/);
});

test('release preflight is minimally privileged and never publishes', async () => {
  const workflow = await read('.github/workflows/release-preflight.yml');
  assert.match(workflow, /contents: read/);
  assert.equal(workflow.includes('contents: write'), false);
  assert.equal(workflow.includes('gh release create'), false);
  assert.match(workflow, /npm run facts:check/);
  assert.match(workflow, /npm run package:release/);
});

test('stable current release notes keep the decision boundary explicit', async () => {
  const notes = await read('docs/RELEASE_NOTES.md');
  const packageData = JSON.parse(await read('package.json'));
  const version = packageData.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(notes, new RegExp(`^# v${version}$`, 'm'));
  assert.match(notes, /human judgment/i);
  assert.match(notes, /browser-local storage is not encrypted confidential storage/i);
});
