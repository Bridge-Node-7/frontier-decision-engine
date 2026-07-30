# Frontier Decision Engine

**Open-source decision infrastructure for deep uncertainty.**

Frontier Decision Engine helps people and institutions make robust, adaptive, accountable decisions when evidence is incomplete, probabilities are disputed, models are uncertain, futures are unstable, and action is still required.

Its flagship profile is **Open Phenomenon Verification**, which preserves the local-first workflow for ambiguous sensor observations, UAP, UFO, anomalous experiences, and frontier phenomena.

> **Preserve the evidence. Expose assumptions. Explore many futures. Reveal vulnerabilities. Choose accountable action. Adapt as reality unfolds.**

## Product preview

![Frontier Decision Engine Decision Frame](docs/screenshots/v0.2.10/desktop-decision-frame.png)

Additional verified component renders:

- [Dark-mode stress test](docs/screenshots/v0.2.10/desktop-stress-test-dark.png)
- [Desktop Robust Decision Brief](docs/screenshots/v0.2.10/desktop-decision-brief.png)
- [Mobile Robust Decision Brief](docs/screenshots/v0.2.10/mobile-decision-brief.png)

These images were produced from the exact v0.2.10 source in Chromium after the end-to-end release gate. A live GitHub Pages capture remains a publication gate.

## What is real in v0.2.10

### Decision Lab

- Decision-first framing
- XLRM-style Decision Map
- Explicit stakeholders, uncertainties, strategies, relationships, and objectives
- Editable objective thresholds
- Editable strategy performance assumptions
- Editable strategy-specific plausible-future modifiers
- Transparent strategy × scenario × objective matrix
- Threshold-based robustness summaries
- Critical-objective gating, worst-case performance, and critical-failure visibility
- Strategy vulnerability map
- Human-owned strategy selection, rationale, and next action
- Adaptive action, monitoring, trigger, contingency, and reassessment fields
- Portable `.fde.json` export
- Human-readable Robust Decision Brief export

### Open Phenomenon Verification profile

- Local SHA-256 evidence hashing
- Original, derived, enhanced, reconstruction, and generated asset classes
- Local image-line measurement
- Declared camera calibration
- Angular-extent calculations
- Assumption-based physical-size scenarios
- Evidence Ladder through Level 2
- Human-reviewed verdicts
- Portable `.opv.json` and HTML case exports
- Three public-safe normalized research collections

### Repository assurance

- Static GitHub Pages application
- No backend, accounts, cookies, analytics, or default upload endpoint
- No external runtime dependencies
- JSON Schemas published with the site
- 49 automated Node tests
- Automated desktop-light, 390-pixel mobile-light, desktop-dark, 200%-equivalent reflow, 400%-equivalent reflow, and forced-colors browser end-to-end tests
- Public-boundary validation
- Deterministic release archive and SHA-256 checksum
- Semantic accessibility smoke, table captions, keyboard focus, reflow, forced-colors, and PDF print checks
- Live GitHub Pages end-to-end gate against the deployed HTTPS URL
- Verified signed-tag, immutable-release, deterministic artifact, and attestation gates
- Pinned GitHub Actions
- Release packaging excludes workbooks, private inputs, Python caches, and generated build directories

## The category

Most decision tools ask:

> What is most likely to happen?

Frontier Decision Engine asks:

> **What action remains defensible across plausible futures, where does each strategy fail, and how should the decision change as we learn?**

The reference implementation deliberately uses a small transparent scenario matrix. Scores are analyst-assigned desirability inputs, not probabilities or empirical forecasts. The app exposes every value and does not hide stakeholder priorities in one unexplained utility score.

## Reference vertical slice

The included case asks:

> **Should a synchronized second observation station be deployed, and under what trigger conditions?**

It compares:

1. Reanalyze existing evidence only
2. Deploy two stations immediately
3. Stage a conditional second-station deployment

across four plausible futures and four separate objectives:

- Evidence gain
- Affordability
- Privacy protection
- Reversibility

The machine identifies a **leading candidate** by first minimizing futures with critical-objective failures, then comparing worst-case critical performance, worst-case overall performance, and overall performance. The interface explicitly states when the leading candidate still has critical gaps. A human must select the strategy and record the rationale and single next action before export.

## Evidence profiles

```text
Frontier Decision Engine
└── Open Phenomenon Verification
    ├── Physical observations
    ├── Reported experiences
    ├── Candidate mechanisms
    ├── Analyst interpretations
    └── Generated visualizations
```

The profile prevents these evidence classes from being silently merged.

## Included public-safe datasets

| Collection | Records | Evidence class | Critical boundary |
|---|---:|---|---|
| Karijini morphology and motion | 41 objects, 40 sequences, 169 valid intervals | Measured / derived | True range, physical size, velocity, and identity are not established |
| Longitudinal experience registry | 41 primary encounters, 22 nested subphases | Reported / coded | Subphases are not independent encounters; sensitive details are excluded |
| Thematic research map | 53 reference clusters across 9 themes | Referenced / interpreted | Scores and signatures are analyst mappings, not scientific confirmation |

Original workbooks and original observation media are not committed. Source hashes are preserved in the normalized dataset envelopes.

## Run locally

```bash
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000`.

## Verify

Requires Node.js 22 or newer, Python 3.11 or newer, and Chromium or Google Chrome for the browser end-to-end gate.
The browser gate prefers a native localhost origin and native Web Crypto. In managed sandboxes that block localhost navigation, it reports `sandbox-fallback` and runs the exact static modules with a test-only SHA-256 bridge; live GitHub Pages remains the final native-origin gate.

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
npm run check
```

Expected current result:

```text
48 tests pass
REPOSITORY VALIDATION PASS
desktop-light: PASS
mobile-light: PASS
desktop-dark: PASS
reflow-200-equivalent: PASS
reflow-400-equivalent: PASS
forced-colors: PASS
```

## Verification evidence

- `COMPREHENSIVE_VV_UX_AUDIT.md` documents the current repository, method, security, data, release, and UX audit.
- `RELEASE_PROVENANCE.md` identifies the controlling release and checksum rule.
- `docs/RELEASE_CHECKLIST.md` defines the local, artifact, GitHub, and public-release gates.
- `docs/ACCESSIBILITY_TEST_PLAN.md` defines automated and live assistive-technology checks.
- `docs/GITHUB_RELEASE_RUNBOOK.md` defines repository, Pages, security, tag, and release actions.
- `V_AND_V_REPORT.md` provides the controlling release-gate summary.
- `docs/screenshots/v0.2.10/` contains current isolated-browser evidence.

## Build a release

```bash
npm run package:release
```

The deterministic ZIP and checksum are written to `dist/`.

## Deploy to GitHub Pages

1. Create `Bridge-Node-7/frontier-decision-engine`.
2. Push this repository through a reviewed branch or pull request.
3. Open **Settings → Pages**.
4. Set **Source** to **GitHub Actions**.
5. The included workflow verifies and publishes `site/`.
6. The workflow automatically exercises the deployed HTTPS site; complete NVDA/VoiceOver, physical zoom, Windows High Contrast, and real-device checks before tagging.
7. Enable release immutability and repository security controls before pushing the signed tag.

## Public and private boundary

Public:

- Methods and schemas
- Static browser application
- Synthetic and sanitized examples
- Synthetic calibration controls; real known-object controls remain pending
- Validation tools
- Public decision briefs

Private by default:

- Sensitive raw evidence
- Personal experience narratives
- Exact locations
- Medical or identifying information
- Client and institutional incidents
- Proprietary models
- Credentials and operational infrastructure

Read `PUBLIC_SAFE_BOUNDARY.md` before adding data.

## Human-governed AI boundary

AI may organize evidence, suggest scenarios, identify missing information, expose contradictions, and draft a decision brief.

AI may not independently define stakeholder values, publish a consequential verdict, declare extraordinary origin, or make an irreversible high-impact decision.

## Current maturity

**v0.2.10 is a working, principle-faithful reference implementation. It is not yet a validated world-leading institutional platform.**

Leadership must be demonstrated through independent review, known-object controls, benchmark cases, accessibility and security audits, real pilots, and measurable improvement in decision quality.

## Roadmap principle

Build one complete, understandable decision workflow before adding advanced simulation, centralized evidence hosting, or automated decision authority.

## Doctrine

> **Bridge Node 7 transforms frontier uncertainty into evidence, robust choices, adaptive pathways, and accountable action.**
