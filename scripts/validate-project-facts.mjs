import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { collectProjectFacts } from './generate-project-facts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const committed = JSON.parse(await readFile(`${root}/project-facts.json`, 'utf8'));
const generated = await collectProjectFacts();
assert.deepEqual(committed, generated, 'project-facts.json is stale; run npm run facts');
console.log('project facts: PASS');
