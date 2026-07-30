# UX Standard

The experience must remain calm, legible, evidence-first, and decision-centered.

- Show a complete sample before an empty workflow.
- Begin with the real decision, owner, horizon, urgency, and reversibility.
- Ask one meaningful decision question at a time.
- Place limitations, assumptions, and failure conditions beside findings.
- Display `Measured`, `Derived`, `Assumed`, `Reported`, and `Interpreted` badges consistently.
- Never use generated phenomenon art as if it were evidence.
- Never require an account to inspect or export a case.
- Let each plausible future affect each strategy differently.
- Do not present scenario plausibility as probability.
- Treat critical objectives as gates before broader performance comparisons.
- Describe a relative machine candidate as a `Leading candidate` when critical gaps remain.
- Require a human-selected strategy, written rationale, and single next action before export.
- Include assumptions, vulnerabilities, monitoring, triggers, contingencies, and reassessment in the exported brief.
- Present human judgment before the detailed evidence appendix in the Decision Brief.
- Allow evidence and pathway sections to be collapsed on smaller screens while preserving them for print.
- Move focus to the new step heading and scroll it into view after Decision Lab and phenomena-wizard navigation.
- Move focus to the first invalid field or validation summary when export is blocked.
- Preserve at least WCAG AA text contrast in light and dark modes.
- Respect reduced-motion preferences.
- Provide keyboard access, visible focus, semantic headings, responsive layouts, readable mobile controls, and no document-level horizontal overflow.
- Prefer `Insufficient evidence`, `Critical gaps remain`, or `No robust strategy yet` over a speculative or forced classification.

## Automated UX evidence

`npm run test:e2e` executes the exact site in Chromium and verifies:

- all eight public routes
- all six Decision Lab stages
- all five phenomena-case stages
- local SHA-256 hashing
- keyboard coordinate measurement
- Evidence Level 2 gating
- invalid-field focus and `aria-invalid`
- JSON and HTML exports for both workflows
- duplicate IDs, unnamed links/buttons, unlabeled form controls, and empty headings
- mobile and 320-pixel reflow overflow
- 44-pixel primary controls and light/dark contrast
- keyboard activation, visible step focus, print-media rules, and forced-colors rendering

The suite runs in desktop light, 390-pixel mobile light, desktop dark, 320-pixel reflow, and forced-colors modes. It prefers native localhost with browser Web Crypto and reports a sandbox fallback only when managed environments block localhost navigation.

## External accessibility gates

Before a public tag, the live GitHub Pages deployment still requires:

- keyboard walkthrough
- screen-reader review
- 200% and 400% zoom
- Windows high-contrast mode
- printed/PDF Decision Brief review
