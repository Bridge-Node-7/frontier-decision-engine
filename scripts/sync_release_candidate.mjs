#!/usr/bin/env node
/**
 * After release-please bumps package.json / version authorities on a release PR,
 * rewrite docs/RELEASE_NOTES.md heading + application-version line and refresh
 * site/manifest.sha256 so version-integrity and Pages gates stay green.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid package.json version: ${version}`);
  process.exit(1);
}

const notesPath = join(root, 'docs', 'RELEASE_NOTES.md');
let notes = readFileSync(notesPath, 'utf8');
notes = notes.replace(/(?m)^#\s+v\d+\.\d+\.\d+\s*$/, `# v${version}`);
notes = notes.replace(
  /(?m)^Application version is \d+\.\d+\.\d+\.\s*$/,
  `Application version is ${version}.`,
);
if (!new RegExp(`(?m)^#\\s+v${version.replace(/\./g, '\\.')}\\s*$`).test(notes)) {
  console.error('RELEASE_NOTES.md heading sync failed');
  process.exit(1);
}
if (!new RegExp(`(?m)^Application version is ${version.replace(/\./g, '\\.')}\\.\\s*$`).test(notes)) {
  console.error('RELEASE_NOTES.md application-version line sync failed');
  process.exit(1);
}
writeFileSync(notesPath, notes);

const manifest = spawnSync(process.execPath, [join(root, 'scripts', 'build-manifest.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
if (manifest.status !== 0) {
  process.exit(manifest.status ?? 1);
}
console.log(`PASS: synced RELEASE_NOTES and site manifest for ${version}`);
