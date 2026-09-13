from pathlib import Path

p = Path('site/src/universal-ui.js')
s = p.read_text()
s = s.replace(
    "const informationPattern = /^(how much|what is|what's|when is|where is|who is|can you explain|what does|how does|tell me about)\\b/i;\n",
    "const informationPattern = /^(how much|what is|what's|when is|where is|who is|can you explain|what does|how does|tell me about)\\b/i;\nconst treatmentActionPattern = /\\b(?:stop|start|skip|discontinue|quit|change|increase|decrease|reduce|raise|lower)\\b/i;\nconst treatmentSubjectPattern = /\\b(?:medication|medicine|prescription|dose|treatment|therapy)\\b/i;\n",
)
anchor = "function extractChoices(text) {\n"
insertion = """function hasUnresolvedOptionList(text) {\n  const listish = /([^\\n.!?;:]{2,200}?,[^\\n.!?;:]{2,200}?)\\s*,?\\s*\\b(?:or|and)\\s+([^\\n.!?;:]{2,80})/i;\n  const match = listish.exec(text);\n  if (!match) return false;\n  return match[1].split(',').filter((value) => value.trim().length >= 2).length >= 2;\n}\n\nfunction hasTreatmentChangeRequest(text) {\n  const clean = normalize(text);\n  return treatmentActionPattern.test(clean) && treatmentSubjectPattern.test(clean);\n}\n\n"""
if 'function hasUnresolvedOptionList' not in s:
    s = s.replace(anchor, insertion + anchor)
s = s.replace(
    "  const choices = extractChoices(clean);\n  const goals = extractGoals(clean);",
    "  const optionListAmbiguous = hasUnresolvedOptionList(clean);\n  const choices = optionListAmbiguous ? [] : extractChoices(clean);\n  const goals = extractGoals(clean);",
)
s = s.replace(
    "    possibleDecision,\n    choices,",
    "    possibleDecision,\n    optionListAmbiguous,\n    choices,",
)
s = s.replace(
    "export function responseFor(state) {\n  const clean = normalize(state?.startingPoint);\n",
    "export function responseFor(state) {\n  const clean = normalize(state?.startingPoint);\n  if (hasTreatmentChangeRequest(clean)) {\n    return {\n      kind: 'boundary',\n      title: 'Treatment changes need qualified clinical guidance.',\n      body: 'FDE should not recommend starting, stopping, skipping, or changing prescribed treatment. A qualified clinician should guide treatment changes. FDE can still help structure cost, access, logistics, and questions to discuss with that clinician.',\n    };\n  }\n  if (state?.optionListAmbiguous) {\n    return { kind: 'question', question: 'What options should we compare?' };\n  }\n",
)
s = s.replace(
    '<p id="universal-help" class="help">Use your own words. Press Ctrl or Command + Enter to continue.</p>',
    '<p id="universal-help" class="help">Use your own words. Press Ctrl or Command + Enter to continue. Natural-language intake currently supports English.</p>',
)
s = s.replace(
    "    possibleDecision: restored.possibleDecision || '',\n    choices:",
    "    possibleDecision: restored.possibleDecision || '',\n    optionListAmbiguous: Boolean(restored.optionListAmbiguous),\n    choices:",
)
p.write_text(s)

p = Path('tests/universal-response.test.js')
s = p.read_text()
if "generated multi-option corpus never exposes" not in s:
    s += r'''

test('multi-option lists never silently truncate into a partial option set', () => {
  const examples = [
    'Choose between vendor A, vendor B, vendor C, vendor D or build in-house.',
    'Should we pick option A, option B, or option C?',
    'We can lease, buy, or refurbish. Which should we choose?',
    'Should we use titanium, aluminium, or composite?',
  ];
  for (const input of examples) {
    const draft = draftFromInput(input);
    assert.equal(draft.optionListAmbiguous, true, input);
    assert.deepEqual(draft.choices, [], input);
    const response = responseFor(draft);
    assert.equal(response.kind, 'question', input);
    assert.equal(response.question, 'What options should we compare?', input);
  }
});

test('binary option extraction remains deterministic', () => {
  const draft = draftFromInput('Should we build internally or partner externally?');
  assert.equal(draft.optionListAmbiguous, false);
  assert.deepEqual(draft.choices, ['build internally', 'partner externally']);
  assert.equal(responseFor(draft).kind, 'structure');
});

test('generated multi-option corpus never exposes a strict partial option set', () => {
  const connectors = ['or', 'or', 'or'];
  let cases = 0;
  for (let count = 3; count <= 7; count += 1) {
    for (let variant = 0; variant < 60; variant += 1) {
      const options = Array.from({ length: count }, (_, index) => `option-${variant}-${index + 1}`);
      const prefix = variant % 2 === 0 ? 'Should we choose ' : 'Choose between ';
      const separator = variant % 3 === 0 ? ', ' : variant % 3 === 1 ? ',  ' : ', ';
      const input = `${prefix}${options.slice(0, -1).join(separator)}, ${connectors[variant % connectors.length]} ${options.at(-1)}?`;
      const draft = draftFromInput(input);
      assert.equal(draft.optionListAmbiguous, true, input);
      assert.equal(draft.choices.length, 0, input);
      assert.equal(responseFor(draft).question, 'What options should we compare?', input);
      cases += 1;
    }
  }
  assert.ok(cases >= 250);
});

test('prescribed treatment changes use a bounded safety response', () => {
  const response = responseFor(draftFromInput('Should I stop taking my heart medication to save money?'));
  assert.equal(response.kind, 'boundary');
  assert.match(response.title, /qualified clinical guidance/i);
  assert.match(response.body, /should not recommend/i);
  assert.match(response.body, /cost, access, logistics/i);
});

test('ordinary non-medical cost decisions are not caught by the treatment boundary', () => {
  const response = responseFor(draftFromInput('Should we build internally or partner externally to save money?'));
  assert.equal(response.kind, 'structure');
});
'''
p.write_text(s)

p = Path('README.md')
s = p.read_text()
s = s.replace(
    'Share a situation, decision, question, options, constraints, notes, or other context in your own words. FDE then does one of three things:',
    'Share a situation, decision, question, options, constraints, notes, or other context in your own words. **Natural-language intake currently supports English.** FDE then does one of three things:',
)
old = '''Requirements: Node.js 22+, Python 3.11+, and Chromium or Google Chrome.\n\n```bash\nnode scripts/run-python.mjs -m pip install -r requirements-dev.txt\nnode scripts/run-python.mjs -m playwright install chromium\nnpm ci --ignore-scripts --no-audit --no-fund\nnpm run check\n```'''
new = '''Requirements: Node.js 22+, Python 3.11+, and Chromium or Google Chrome.\n\nmacOS / Linux:\n\n```bash\nnode scripts/run-python.mjs -m venv .venv\nsource .venv/bin/activate\nnode scripts/run-python.mjs -m pip install -r requirements-dev.txt\nnode scripts/run-python.mjs -m playwright install chromium\nnpm ci --ignore-scripts --no-audit --no-fund\nnpm run check\n```\n\nWindows PowerShell:\n\n```powershell\nnode scripts/run-python.mjs -m venv .venv\n.\\.venv\\Scripts\\Activate.ps1\nnode scripts/run-python.mjs -m pip install -r requirements-dev.txt\nnode scripts/run-python.mjs -m playwright install chromium\nnpm ci --ignore-scripts --no-audit --no-fund\nnpm run check\n```'''
if old not in s:
    raise SystemExit('README verification block did not match expected v0.3.3 source')
p.write_text(s.replace(old, new))

p = Path('docs/RELEASE_NOTES.md')
s = p.read_text()
if not s.startswith('# v0.3.4'):
    block = '''# v0.3.4\n\n## First-Run Boundary Hardening\n\nApplication version is 0.3.4. The compatible decision schema 0.2.10 and semantic decision schema 0.3.0 remain unchanged.\n\nThis maintenance release hardens clean-adopter setup and first-run truthfulness without changing deterministic Decision Lab ranking semantics or human final decision authority.\n\n### Changes\n\n- Documents an isolated Python virtualenv before development-package installation for PEP 668-safe onboarding.\n- Refuses to present a partial subset when a natural-language input contains an unresolved list of three or more alternatives; the UI asks explicitly for the options instead.\n- Adds deterministic corpus regression coverage across more than 250 multi-option phrasings while preserving binary extraction.\n- Adds a narrow safety boundary for explicit requests to start, stop, skip, or change prescribed treatment; FDE does not recommend a treatment change and can instead structure cost, access, logistics, and questions for a qualified clinician.\n- Makes the current English-only natural-language intake scope explicit.\n- Preserves browser-local privacy, saved-work protection, published schemas, deterministic formal comparison, and human decision authority.\n\n### Decision boundary\n\nFDE remains decision support, not a medical, safety, certification, qualification, authorization, or investment authority.\n\n### Release date\n\n2026-09-12\n\n'''
    p.write_text(block + s)

p = Path('CITATION.cff')
s = p.read_text().replace('version: 0.3.3', 'version: 0.3.4')
p.write_text(s)
