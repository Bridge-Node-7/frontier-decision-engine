import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('application version retains the compatible v0.2.10 decision schema', async () => {
  const packageData = JSON.parse(await read('package.json'));
  const citation = await read('CITATION.cff');
  const schema = JSON.parse(await read('schemas/decision.schema.json'));
  const example = JSON.parse(await read('examples/phenomena-second-station/decision.fde.json'));
  const facts = JSON.parse(await read('project-facts.json'));
  assert.match(packageData.version, /^\d+\.\d+\.\d+$/);
  const versionPattern = packageData.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(citation, new RegExp(`^version:\\s*${versionPattern}\\s*$`, 'm'));
  assert.match(citation, /^date-released:\s*\d{4}-\d{2}-\d{2}\s*$/m);
  assert.equal(schema.properties.schema_version.const, '0.2.10');
  assert.equal(example.schema_version, '0.2.10');
  assert.equal(facts.applicationVersion, packageData.version);
  assert.equal(facts.schemaVersions.decision, schema.properties.schema_version.const);
  assert.ok(Number.isInteger(facts.testCount) && facts.testCount > 0);
  const readme = await read('README.md');
  assert.match(readme, /project-facts\.json/);
  for (const stale of ['49 automated Node tests', '48 automated Node tests', '46 automated Node tests']) {
    assert.equal(readme.includes(stale), false);
  }
});
test('release identity supports a compatible schema and complete current notes', async () => {
  const packageData = JSON.parse(await read('package.json'));
  const citation = await read('CITATION.cff');
  const verifier = await read('scripts/verify_release_tag.py');
  const notes = await read(`docs/releases/v${packageData.version}.md`);
  const releasing = await read('docs/RELEASING.md');
  const packager = await read('scripts/package_release.py');
  const versionPattern = packageData.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(verifier, /project-facts\.json/);
  assert.match(verifier, /release notes file is missing or empty/);
  assert.match(verifier, /reference decision example schema version/);
  assert.equal(verifier.includes('decision schema version must match the release base version'), false);
  assert.match(notes, new RegExp(`^# v${versionPattern}$`, 'm'));
  assert.match(notes, new RegExp(`application version is ${versionPattern}`, 'i'));
  assert.match(notes, /compatible decision schema[\s\S]*0\.2\.10/i);
  assert.match(releasing, /compatible schema may[\s\S]*earlier version/i);
  const releaseDate = citation.match(/^date-released:\s*(\d{4})-(\d{2})-(\d{2})\s*$/m);
  assert.ok(releaseDate, 'citation release date is required');
  const fixedTime = `FIXED_TIME = (${Number(releaseDate[1])}, ${Number(releaseDate[2])}, ${Number(releaseDate[3])}, 0, 0, 0)`;
  assert.equal(packager.includes(fixedTime), true);
});

test('affordability is modeled as an at-least desirability objective', async () => {
  const example = JSON.parse(await read('examples/phenomena-second-station/decision.fde.json'));
  const objective = example.objectives.find((item) => item.objective_id === 'OBJ-002');
  assert.equal(objective.label, 'Affordability');
  assert.equal(objective.direction, 'at-least');
  assert.equal(objective.unit, 'desirability score');
});
test('browser end-to-end harness covers the retained Decision Lab surface', async () => {
  const runner = await read('scripts/browser_e2e.py');
  const requirements = await read('requirements-dev.txt');
  const capture = await read('scripts/capture_screenshots.py');
  const packageData = JSON.parse(await read('package.json'));
  assert.match(runner, /def decision_flow/);
  assert.equal(runner.includes('def phenomena_flow'), false);
  assert.match(runner, /desktop-light/);
  assert.match(runner, /mobile-light/);
  assert.match(runner, /desktop-dark/);
  assert.match(runner, /reflow-200-equivalent/);
  assert.match(runner, /reflow-400-equivalent/);
  assert.match(runner, /forced-colors/);
  assert.match(runner, /def print_flow/);
  assert.match(runner, /ThreadingHTTPServer/);
  assert.match(runner, /native-http/);
  assert.match(runner, /sandbox-fallback/);
  assert.match(runner, /page\.keyboard\.press\("Enter"\)/);
  assert.match(requirements, /playwright==1\.57\.0/);
  assert.equal(packageData.scripts['test:e2e'], 'python3 scripts/browser_e2e.py');
  assert.equal(packageData.scripts['capture:screenshots'], 'python3 scripts/capture_screenshots.py');
  assert.match(capture, /VERSION = json\.loads\(\(ROOT \/ "package\.json"\)\.read_text\(encoding="utf-8"\)\)\["version"\]/);
  assert.match(capture, /OUTPUT = ROOT \/ "docs" \/ "screenshots" \/ f"v\{VERSION\}"/);
  assert.equal(runner.includes('wait_for_function'), false);
  assert.equal(capture.includes('wait_for_function'), false);
  assert.match(runner, /#decision-step-heading:focus/);
  assert.equal(runner.includes('#case-step-heading:focus'), false);
  assert.match(packageData.scripts.check, /test:e2e/);
  assert.match(packageData.scripts.check, /test:closeout/);
});
test('cross-platform manifest generation uses file URL conversion rather than URL pathname', async () => {
  const manifest = await read('scripts/build-manifest.mjs');
  assert.match(manifest, /fileURLToPath/);
  assert.equal(manifest.includes('.pathname'), false);
});

test('Decision Lab steps and incomplete-analysis state provide focusable headings', async () => {
  const decision = await read('site/src/decision-ui.js');
  const app = await read('site/src/app.js');
  assert.equal((decision.match(/id="decision-step-heading" tabindex="-1"/g) || []).length, 7);
  assert.equal(app.includes('case-step-heading'), false);
  assert.match(decision, /scrollIntoView\(\{ block: 'start', behavior: 'auto' \}\)/);
});
test('release packager excludes private inputs, source workbooks, caches, and dist', async () => {
  const packager = await read('scripts/package_release.py');
  for (const token of ['.private-input', 'node_modules', 'dist', 'hosted-verification', '__pycache__', '.xlsx', '.pyc']) {
    assert.match(packager, new RegExp(token.replace('.', '\\.')));
  }
});

test('retained Decision Lab tables have captions and scoped headers', async () => {
  const decision = await read('site/src/decision-ui.js');
  const app = await read('site/src/app.js');
  const combined = `${decision}\n${app}`;
  const tables = (combined.match(/<table/g) || []).length;
  assert.ok(tables >= 2);
  assert.equal((combined.match(/<caption>/g) || []).length, tables);
  assert.match(combined, /scope="col"/);
  assert.match(combined, /scope="row"/);
  assert.match(decision, /matrix-details/);
  const publicSource = `${app}\n${decision}`;
  const hiddenFileInputs = publicSource.match(/<input\b(?=[^>]*\btype=["']file["'])(?=[^>]*\bhidden\b)[^>]*>/gi) || [];
  assert.ok(hiddenFileInputs.length >= 1);
  for (const input of hiddenFileInputs) {
    assert.match(input, /aria-(?:label|labelledby)=["'][^"']+["']/i);
  }
});
test('browser gate includes semantic accessibility, reflow, forced-colors, and PDF print checks', async () => {
  const runner = await read('scripts/browser_e2e.py');
  assert.match(runner, /tablesMissingCaption/);
  assert.match(runner, /aria_snapshot/);
  assert.match(runner, /reflow-200-equivalent/);
  assert.match(runner, /reflow-400-equivalent/);
  assert.match(runner, /forced-colors/);
  assert.match(runner, /page\.pdf/);
  assert.match(runner, /%PDF/);
});

test('tag-driven release workflow verifies identity and publishes deterministic artifacts', async () => {
  const workflow = await read('.github/workflows/release.yml');
  const verifier = await read('scripts/verify_release_tag.py');
  assert.match(workflow, /tags:/);
  assert.match(workflow, /git cat-file -t/);
  assert.match(workflow, /verify_release_tag\.py/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm run package:release/);
  assert.match(workflow, /cd dist[\s\S]*sha256sum --check/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /actions\/attest@508db95dd578ae2727ebd6217d5ba78e4fbda05d/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(verifier, /tag .* does not match package version/);
});
test('current public release uses verified browser tooling and current official immutable action pins', async () => {
  const requirements = await read('requirements-dev.txt');
  const ci = await read('.github/workflows/ci.yml');
  const pages = await read('.github/workflows/pages.yml');
  const release = await read('.github/workflows/release.yml');
  const workflows = `${ci}\n${pages}\n${release}`;
  assert.match(requirements, /^playwright==1\.57\.0$/m);
  assert.equal((workflows.match(/actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/g) || []).length, 3);
  assert.equal(workflows.includes('actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0'), false);
  assert.equal((workflows.match(/actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/g) || []).length, 3);
  assert.equal((workflows.match(/package-manager-cache: false/g) || []).length, 3);
  assert.equal((workflows.match(/npm ci --ignore-scripts --no-audit --no-fund/g) || []).length, 3);
  assert.match(ci, /timeout-minutes: 20/);
  assert.match(pages, /timeout-minutes: 20/);
  assert.match(release, /timeout-minutes: 25/);
  assert.equal(workflows.includes('actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e'), false);
  assert.match(pages, /actions\/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6\.0\.0/);
  assert.match(pages, /actions\/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5\.0\.0/);
  assert.match(pages, /actions\/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128 # v5\.0\.0/);
});
test('cross-platform release inputs are normalized and binary-safe', async () => {
  const attributes = await read('.gitattributes');
  const nodeVersion = await read('.node-version');
  assert.match(attributes, /^\* text=auto eol=lf$/m);
  assert.match(attributes, /^\*\.png binary$/m);
  assert.match(attributes, /^\*\.zip binary$/m);
  assert.equal(nodeVersion.trim(), '22');
});
test('Pages workflow runs the complete UX gate against the deployed HTTPS origin', async () => {
  const pages = await read('.github/workflows/pages.yml');
  const runner = await read('scripts/browser_e2e.py');
  assert.match(pages, /steps\.deployment\.outputs\.page_url/);
  assert.match(pages, /FDE_BASE_URL:/);
  assert.match(pages, /python3 scripts\/browser_e2e\.py/);
  assert.match(pages, /python3 scripts\/browser_closeout_regressions\.py/);
  assert.match(runner, /FDE_BASE_URL/);
  assert.match(runner, /Live Pages URL did not become ready/);
  assert.match(runner, /attempts=12/);
});

test('Release workflow requires a verified signature and hosted immutable verification', async () => {
  const release = await read('.github/workflows/release.yml');
  assert.match(release, /environment:[\s\S]*name: release/);
  assert.match(release, /verification\.verified/);
  assert.match(release, /verification\.reason/);
  assert.match(release, /test "\$TAG_OBJECT_TYPE" = "tag"/);
  assert.equal(release.includes('RELEASE_ADMIN_TOKEN'), false);
  assert.match(release, /gh release download "\$GITHUB_REF_NAME"/);
  assert.match(release, /hosted-verification/);
  assert.match(release, /sha256sum --check/);
  assert.match(release, /gh release verify "\$GITHUB_REF_NAME"/);
  assert.equal((release.match(/gh release verify-asset/g) || []).length, 2);
  assert.equal((release.match(/gh attestation verify/g) || []).length, 2);
});
test('release workflow never injects an operator credential', async () => {
  const release = await read('.github/workflows/release.yml');
  assert.equal(release.includes('RELEASE_ADMIN_TOKEN'), false);
  assert.equal(release.includes('secrets.RELEASE_ADMIN_TOKEN'), false);
  assert.match(release, /GH_TOKEN: \$\{\{ github\.token \}\}/);
});
test('post-publication verification operates on freshly downloaded hosted bytes', async () => {
  const release = await read('.github/workflows/release.yml');
  const hostedStep = release.split('- name: Download and verify hosted release assets')[1];
  assert.match(hostedStep, /gh release download/);
  assert.match(hostedStep, /--dir hosted-verification/);
  assert.match(hostedStep, /cd hosted-verification/);
  assert.match(hostedStep, /sha256sum --check/);
  assert.equal((hostedStep.match(/gh release verify-asset/g) || []).length, 2);
  assert.equal((hostedStep.match(/gh attestation verify/g) || []).length, 2);
});

test('public repository surface stays lean and user-focused', async () => {
  const { readdir } = await import('node:fs/promises');
  const rootEntries = await readdir(new URL('../', import.meta.url), { withFileTypes: true });
  const rootMarkdown = rootEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(rootMarkdown, [
    'CODE_OF_CONDUCT.md',
    'CONTRIBUTING.md',
    'README.md',
    'SECURITY.md',
  ]);
  const docs = await readdir(new URL('../docs/', import.meta.url), { withFileTypes: true });
  const docsMarkdown = docs
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(docsMarkdown, [
    'ARCHITECTURE.md',
    'DATA_DICTIONARY.md',
    'METHODOLOGY.md',
    'PRIVACY.md',
    'RELEASING.md',
    'STYLE_LAYERS.md',
  ]);
  const readme = await read('README.md');
  assert.ok(readme.split(/\r?\n/).length <= 100);
  assert.match(readme, /project-facts\.json/);
  assert.match(readme, /synthetic critical-material source-qualification case/i);
  assert.doesNotMatch(readme, /synthetic\s+event\s+registry/i);
});
test('public event registry is synthetic and contains no personal history', async () => {
  const data = JSON.parse(await read('site/data/experiences.json'));
  assert.equal(data.dataset_id, 'opv-experiences-synthetic-v1');
  assert.equal(data.evidence_class, 'synthetic-demonstration');
  assert.equal(data.privacy.status, 'synthetic-no-personal-source');
  assert.equal(data.source.included_in_public_repository, true);
  assert.equal(data.primary_events.length, 41);
  assert.equal(data.subphases.length, 22);

  const text = JSON.stringify(data);
  const privateSourceTokens = [
    '4D_' + 'Experiences_' + 'Integrated',
    'Longitudinal ' + 'Experience Registry',
    'Child' + 'hood',
    '2019' + '\u2013' + '2022',
    'OBEs over ' + 'Bribie',
    'Malevolent ' + 'wrinkled figure',
    'Approx_' + 'Age',
  ];
  for (const token of privateSourceTokens) {
    assert.equal(text.toLowerCase().includes(token.toLowerCase()), false);
  }
});

test('delivery automation retains dependency, review, and attestation controls', async () => {
  const dependabot = await read('.github/dependabot.yml');
  const pullRequest = await read('.github/pull_request_template.md');
  const release = await read('.github/workflows/release.yml');
  assert.match(dependabot, /package-ecosystem: pip/);
  assert.match(pullRequest, /## Public boundary/);
  assert.match(pullRequest, /npm run check/);
  assert.match(release, /id-token: write/);
  assert.match(release, /attestations: write/);
  assert.match(release, /actions\/attest@508db95dd578ae2727ebd6217d5ba78e4fbda05d/);
});

test('README references only the current retained product screenshot', async () => {
  const packageData = JSON.parse(await read('package.json'));
  const readme = await read('README.md');
  const expectedScreenshot = `docs/screenshots/v${packageData.version}/desktop-decision-frame.png`;
  assert.equal(readme.includes(expectedScreenshot), true);
  assert.equal(
    (readme.match(/docs\/screenshots\/v\d+\.\d+\.\d+\/desktop-decision-frame\.png/g) || []).length,
    1,
  );
  for (const removed of [
    'desktop-' + 'stress-test-dark.png',
    'desktop-' + 'decision-brief.png',
    'mobile-' + 'decision-brief.png',
  ]) {
    assert.equal(readme.includes(removed), false);
  }
});

test('screenshot helper generates only the retained public image', async () => {
  const capture = await read('scripts/capture_screenshots.py');
  assert.equal((capture.match(/page\.screenshot\(/g) || []).length, 1);
  assert.match(capture, /desktop-decision-frame\.png/);
  const removed = [
    'desktop-' + 'decision-brief.png',
    'desktop-' + 'stress-test-dark.png',
    'mobile-' + 'decision-brief.png',
  ];
  for (const name of removed) {
    assert.equal(capture.includes(name), false);
  }
});
