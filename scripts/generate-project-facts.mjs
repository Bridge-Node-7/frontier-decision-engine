import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
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

async function collectRetainedReferenceArtifactItemCounts() {
  const candidates = [join(root, 'site', 'data'), join(root, 'profiles', 'phenomena')];
  const counts = {};
  for (const directory of candidates) {
    let files = [];
    try { files = await walk(directory); } catch { continue; }
    for (const path of files.filter((file) => file.endsWith('.json'))) {
      let value;
      try { value = await readJson(path); } catch { continue; }
      const arrays = [];
      if (Array.isArray(value)) arrays.push(value.length);
      else if (value && typeof value === 'object') {
        for (const item of Object.values(value)) if (Array.isArray(item)) arrays.push(item.length);
      }
      counts[relative(root, path).replaceAll('\\', '/')] = arrays.length ? Math.max(...arrays) : 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export async function collectProjectFacts() {
  const packageData = await readJson(join(root, 'package.json'));
  const decisionSchema = await readJson(join(root, 'schemas', 'decision.schema.json'));
  const caseSchema = await readJson(join(root, 'schemas', 'case.schema.json'));
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
      opvCase: schemaVersion(caseSchema),
    },
    testCount,
    discoveredHashRouteLiteralCount: routes.size,
    browserModes,
    manifestEntryCount,
    retainedReferenceArtifactItemCounts: await collectRetainedReferenceArtifactItemCounts(),
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
