import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('release identity is synchronized at v0.2.10', async () => {
  const packageData = JSON.parse(await read('package.json'));
  const citation = await read('CITATION.cff');
  const schema = JSON.parse(await read('schemas/decision.schema.json'));
  const example = JSON.parse(await read('examples/phenomena-second-station/decision.fde.json'));
  assert.equal(packageData.version, '0.2.10');
  assert.match(citation, /^version:\s*0\.2\.10\s*$/m);
  assert.equal(schema.properties.schema_version.const, '0.2.10');
  assert.equal(example.schema_version, '0.2.10');
  const readme = await read('README.md');
  assert.match(readme, /49 automated Node tests/);
  assert.equal(readme.includes('48 automated Node tests'), false);
  assert.equal(readme.includes('46 automated Node tests'), false);
  assert.equal(readme.includes('41 automated Node tests'), false);
  assert.equal(readme.includes('39 automated Node tests'), false);
});

test('affordability is modeled as an at-least desirability objective', async () => {
  const example = JSON.parse(await read('examples/phenomena-second-station/decision.fde.json'));
  const objective = example.objectives.find((item) => item.objective_id === 'OBJ-002');
  assert.equal(objective.label, 'Affordability');
  assert.equal(objective.direction, 'at-least');
  assert.equal(objective.unit, 'desirability score');
});

test('canonical release documents do not cite superseded archives or hashes', async () => {
  const text = (await Promise.all([
    read('COMPREHENSIVE_VV_UX_AUDIT.md'),
    read('V_AND_V_REPORT.md'),
    read('RELEASE_PROVENANCE.md'),
  ])).join('\n');
  for (const stale of [
    '88006d9f4ead8cf7c62141f4c2b5711bd320b362c35e2e12bd7f562c211bdfc2',
    'd0afa8f61473b8915d5d6393ae08abab9ba0683af48aef0c428f93df32893af7',
    'frontier-decision-engine-v0.2.1(1).zip',
    'frontier-decision-engine-v0.2.1-final.zip',
  ]) assert.equal(text.includes(stale), false);
});

test('browser end-to-end harness is wired into the application and package scripts', async () => {
  const runner = await read('scripts/browser_e2e.py');
  const requirements = await read('requirements-dev.txt');
  const capture = await read('scripts/capture_screenshots.py');
  const packageData = JSON.parse(await read('package.json'));
  assert.match(runner, /def decision_flow/);
  assert.match(runner, /def phenomena_flow/);
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
  assert.match(capture, /docs.*screenshots.*v0\.2\.10/s);
  assert.equal(runner.includes('wait_for_function'), false);
  assert.equal(capture.includes('wait_for_function'), false);
  assert.match(runner, /#decision-step-heading:focus/);
  assert.match(runner, /#case-step-heading:focus/);
  assert.match(packageData.scripts.check, /test:e2e/);
});

test('cross-platform manifest generation uses file URL conversion rather than URL pathname', async () => {
  const manifest = await read('scripts/build-manifest.mjs');
  assert.match(manifest, /fileURLToPath/);
  assert.equal(manifest.includes('.pathname'), false);
});

test('both decision and phenomena wizards provide focusable step headings', async () => {
  const decision = await read('site/src/decision-ui.js');
  const app = await read('site/src/app.js');
  assert.equal((decision.match(/id="decision-step-heading" tabindex="-1"/g) || []).length, 6);
  assert.equal((app.match(/id="case-step-heading" tabindex="-1"/g) || []).length, 5);
  assert.match(app, /renderCase\(\{ focusStep: true \}\)/);
  assert.match(decision, /scrollIntoView\(\{ block: 'start', behavior: 'auto' \}\)/);
  assert.match(app, /scrollIntoView\(\{ block: 'start', behavior: 'auto' \}\)/);
});

test('release packager excludes private inputs, source workbooks, caches, and dist', async () => {
  const packager = await read('scripts/package_release.py');
  for (const token of ['.private-input', 'node_modules', 'dist', 'hosted-verification', '__pycache__', '.xlsx', '.pyc']) {
    assert.match(packager, new RegExp(token.replace('.', '\\.')));
  }
});

test('public data tables have captions and scoped headers', async () => {
  const decision = await read('site/src/decision-ui.js');
  const app = await read('site/src/app.js');
  const combined = `${decision}\n${app}`;
  assert.ok((combined.match(/<table/g) || []).length >= 6);
  assert.equal((combined.match(/<caption>/g) || []).length, (combined.match(/<table/g) || []).length);
  assert.match(combined, /scope="col"/);
  assert.match(combined, /scope="row"/);
  assert.match(decision, /matrix-details/);
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

test('public release documentation includes accessibility and GitHub release runbooks', async () => {
  const accessibility = await read('docs/ACCESSIBILITY_TEST_PLAN.md');
  const runbook = await read('docs/GITHUB_RELEASE_RUNBOOK.md');
  const releaseNotes = await read('docs/releases/v0.2.10.md');
  assert.match(accessibility, /NVDA/);
  assert.match(accessibility, /400%/);
  assert.match(runbook, /private vulnerability reporting/);
  assert.match(runbook, /one initial bootstrap push to `main`/);
  assert.match(runbook, /Creating a public repository is an explicit public action/);
  assert.match(runbook, /git tag -s v0\.2\.10/);
  assert.match(releaseNotes, /reference implementation/);
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

test('README references only screenshot evidence included in the release tree', async () => {
  const readme = await read('README.md');
  assert.equal(readme.includes('docs/screenshots/v0.2.0/'), false);
  for (const name of [
    'desktop-decision-frame.png',
    'desktop-stress-test-dark.png',
    'desktop-decision-brief.png',
    'mobile-decision-brief.png',
  ]) {
    assert.equal(readme.includes(`docs/screenshots/v0.2.10/${name}`), true);
  }
});

test('cross-platform release inputs are normalized and binary-safe', async () => {
  const attributes = await read('.gitattributes');
  const nodeVersion = await read('.node-version');
  assert.match(attributes, /^\* text=auto eol=lf$/m);
  assert.match(attributes, /^\*\.png binary$/m);
  assert.match(attributes, /^\*\.zip binary$/m);
  assert.equal(nodeVersion.trim(), '22');
});

test('delivery automation includes dependency maintenance, PR review, and artifact attestations', async () => {
  const dependabot = await read('.github/dependabot.yml');
  const pullRequest = await read('.github/pull_request_template.md');
  const release = await read('.github/workflows/release.yml');
  const runbook = await read('docs/GITHUB_RELEASE_RUNBOOK.md');
  assert.match(dependabot, /package-ecosystem: pip/);
  assert.match(pullRequest, /## Public boundary/);
  assert.match(pullRequest, /npm run check/);
  assert.match(release, /id-token: write/);
  assert.match(release, /attestations: write/);
  assert.match(release, /actions\/attest@508db95dd578ae2727ebd6217d5ba78e4fbda05d # v4\.2\.1/);
  assert.match(release, /subject-path:[\s\S]*\.zip[\s\S]*\.zip\.sha256/);
  assert.match(runbook, /gh release verify v0\.2\.10/);
  assert.match(runbook, /gh attestation verify frontier-decision-engine-v0\.2\.10\.zip/);
});


test('Pages workflow runs the complete UX gate against the deployed HTTPS origin', async () => {
  const pages = await read('.github/workflows/pages.yml');
  const runner = await read('scripts/browser_e2e.py');
  assert.match(pages, /steps\.deployment\.outputs\.page_url/);
  assert.match(pages, /FDE_BASE_URL:/);
  assert.match(pages, /python3 scripts\/browser_e2e\.py/);
  assert.match(runner, /FDE_BASE_URL/);
  assert.match(runner, /Live Pages URL did not become ready/);
  assert.match(runner, /attempts=12/);
});

test('Release workflow requires a verified signature, protected immutable-release precheck, and hosted asset verification', async () => {
  const release = await read('.github/workflows/release.yml');
  assert.match(release, /environment:[\s\S]*name: release/);
  assert.match(release, /verification\.verified/);
  assert.match(release, /verification\.reason/);
  assert.match(release, /test "\$TAG_OBJECT_TYPE" = "tag"/);
  assert.match(release, /RELEASE_ADMIN_TOKEN: \$\{\{ secrets\.RELEASE_ADMIN_TOKEN \}\}/);
  assert.match(release, /GH_TOKEN="\$RELEASE_ADMIN_TOKEN" gh api/);
  assert.match(release, /immutable-releases/);
  assert.match(release, /test "\$IMMUTABLE_RELEASES" = "true"/);
  assert.match(release, /gh release download "\$GITHUB_REF_NAME"/);
  assert.match(release, /hosted-verification/);
  assert.match(release, /sha256sum --check/);
  assert.match(release, /gh release verify "\$GITHUB_REF_NAME"/);
  assert.equal((release.match(/gh release verify-asset/g) || []).length, 2);
  assert.equal((release.match(/gh attestation verify/g) || []).length, 2);
});

test('immutable-release API precheck does not rely on the default workflow token', async () => {
  const release = await read('.github/workflows/release.yml');
  const immutableStep = release.split('- name: Verify immutable releases are enabled')[1].split('- name: Run complete release gate')[0];
  assert.match(immutableStep, /RELEASE_ADMIN_TOKEN/);
  assert.match(immutableStep, /Administration: read/);
  assert.equal(immutableStep.includes('GH_TOKEN: ${{ github.token }}'), false);
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

test('Public release docs require immutable setup and independent verification of both hosted artifacts', async () => {
  const runbook = await read('docs/GITHUB_RELEASE_RUNBOOK.md');
  const checklist = await read('docs/RELEASE_CHECKLIST.md');
  const setup = await read('docs/GITHUB_SETUP.md');
  const text = `${runbook}\n${checklist}\n${setup}`;
  assert.match(text, /Enable release immutability/);
  assert.match(text, /RELEASE_ADMIN_TOKEN/);
  assert.match(text, /Administration: read/);
  assert.match(text, /immutable-releases/);
  assert.match(text, /X-GitHub-Api-Version: 2026-03-10/);
  assert.match(text, /git tag -s v0\.2\.10/);
  assert.equal(text.includes('Use `git tag -a`'), false);
  assert.match(runbook, /gh release download v0\.2\.10/);
  assert.match(runbook, /verify-asset v0\.2\.10 frontier-decision-engine-v0\.2\.10\.zip/);
  assert.match(runbook, /verify-asset v0\.2\.10 frontier-decision-engine-v0\.2\.10\.zip\.sha256/);
  assert.match(runbook, /attestation verify frontier-decision-engine-v0\.2\.10\.zip\.sha256/);
});
