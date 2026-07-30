# Accessibility Verification Plan

Frontier Decision Engine includes automated accessibility smoke checks and a required live manual gate.

## Automated gate

`npm run check` verifies:

- one main landmark and one page-level heading per route
- accessible navigation labels
- accessible names for buttons and links
- labels for form controls
- legends for fieldsets
- summaries for disclosure widgets
- alternative text for images
- captions for data tables
- no duplicate IDs or empty headings
- primary control contrast and minimum target height
- keyboard activation
- focus and visible scrolling on wizard transitions
- invalid-field focus and `aria-invalid`
- 200% and 400% reflow-equivalent layouts
- forced-colors rendering
- print media and generated PDF output

These tests are a baseline, not a certification.

## Live pre-tag walkthrough

Complete on the deployed GitHub Pages URL:

1. NVDA with Firefox or Chrome on Windows
2. VoiceOver with Safari on macOS or iOS
3. Keyboard-only navigation through every route and both wizards
4. Browser zoom at 200% and 400%
5. Windows High Contrast
6. Printed and PDF Robust Decision Brief
7. Error recovery from missing rationale and next action

Record the browser, assistive technology, version, result, and any corrective action in the release issue.
