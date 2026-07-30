# Frontier Decision Engine v0.2.10 V&V Report

## Release classification

**GREEN** for controlled public source release, GitHub Pages methodology demonstration, education, and partner review after hosted CI and live deployment verification.

**AMBER** for expert-supported pilots.

**RED** as the sole authority for irreversible, safety-critical, medical, legal, financial, or national-security decisions.

## Verified release claims

- The application is static and local-first.
- Decision Lab implements decision framing, XLRM mapping, competing strategies, plural futures, threshold stress testing, vulnerability discovery, adaptive pathways, and human-owned decisions.
- Open Phenomenon Verification implements local hashing, calibration declaration, angular measurement, evidence-level controls, human verdicts, and portable exports.
- Scenario scores are analyst-assigned desirability inputs, not probabilities.
- Critical failures remain visible.
- Observation, experience, interpretation, mechanism mapping, and generated assets remain separate.
- Public-safe dataset counts and privacy transforms are validator-enforced.
- Release packaging is deterministic and excludes private or generated development content.
- The browser gate verifies semantic structure, reflow, forced colors, and PDF print generation.
- The Pages workflow executes the complete browser gate against the deployed HTTPS origin.
- The release workflow requires a GitHub-verified signed annotated tag and enabled release immutability before publishing deterministic artifacts.
- Release immutability is prechecked with a protected Administration: read token; both published assets are then downloaded into a clean directory, checksum-verified, and independently checked against release and build attestations.

## Required local gate

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
npm run check
npm run package:release
```

## Hosted gate

Before calling the release publicly complete:

1. merge through the required `verify` check
2. confirm the Pages deployment and automatic live HTTPS E2E gate
3. complete the remaining manual accessibility checklist
4. enable repository security settings and release immutability
5. create a GitHub-verified signed annotated tag
6. confirm the immutable GitHub Release contains the deterministic ZIP and checksum
7. verify release attestations and both downloaded assets

## Prohibited claims

Do not claim that the application predicts the future, provides a full RDM/MoRDM ensemble, proves UAP origin or mechanism, converts analyst scores into probabilities, or independently validates the included research datasets.


The conflicting prior audit result involving Playwright `wait_for_function` and the strict CSP is closed in v0.2.10. The release tooling contains no `wait_for_function` calls.
