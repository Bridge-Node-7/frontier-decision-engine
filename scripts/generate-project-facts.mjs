import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files.sort();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function schemaVersion(schema) {
  return schema?.properties?.schema_version?.const ?? null;
}

function countTests(text) {
  return (text.match(/(?:^|\s)test\s*\(/gm) || []).length;
}

export async function collectProjectFacts() {
  const packageData = await readJson(join(root, 'package.json'));
  const decisionSchema = await readJson(join(root, 'schemas', 'decision.schema.json'));
  const semanticDecisionSchema = await readJson(join(root, 'schemas', 'decision-0.3.0.schema.json'));

  const testFiles = (await walk(join(root, 'tests'))).filter((path) => path.endsWith('.test.js'));
  let testCount = 0;
  for (const path of testFiles) testCount += countTests(await readFile(path, 'utf8'));

  const browserRunner = await readFile(join(root, 'scripts', 'browser_e2e.py'), 'utf8');
  const knownModes = [
    'desktop-light',
    'mobile-light',
    'mobile-375',
    'desktop-dark',
    'reflow-200-equivalent',
    'reflow-400-equivalent',
    'forced-colors',
  ];
  const browserModes = knownModes.filter((mode) => browserRunner.includes(mode));

  const siteFiles = (await walk(join(root, 'site'))).filter((path) => /\.(?:html|js)$/i.test(path));
  const routes = new Set();
  for (const path of siteFiles) {
    const text = await readFile(path, 'utf8');
    for (const match of text.matchAll(/#\/[a-z0-9/-]*/gi)) routes.add(match[0]);
  }

  let manifestEntryCount = null;
  try {
    const manifest = await readFile(join(root, 'site', 'manifest.sha256'), 'utf8');
    manifestEntryCount = manifest.split(/\r?\n/).filter(Boolean).length;
  } catch {}

  return {
    applicationVersion: packageData.version,
    schemaVersions: {
      decision: schemaVersion(decisionSchema),
      semanticDecision: schemaVersion(semanticDecisionSchema),
    },
    testCount,
    discoveredHashRouteLiteralCount: routes.size,
    browserModes,
    manifestEntryCount,
  };
}

async function main() {
  const facts = await collectProjectFacts();
  await writeFile(join(root, 'project-facts.json'), `${JSON.stringify(facts, null, 2)}\n`);
  await writeFile(
    join(root, 'site', 'src', 'version.js'),
    `export const APPLICATION_VERSION = '${facts.applicationVersion}';\n`,
  );
  console.log(`wrote project-facts.json and site/src/version.js with ${facts.testCount} discovered tests`);
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) await main();
