# Frontier Decision Engine v0.2.10 V&V Report

## Release classification

**GREEN** as a public, inspectable, principle-faithful reference implementation for methodology review, education, collaboration, and controlled partner demonstration.

**RED** as a general-purpose external-user pilot until users can preserve, import, revise, and define decisions of their own structure.

**RED** as the sole authority for irreversible, safety-critical, medical, legal, financial, or national-security decisions.

## Verified application claims

- The application is static and processes the included workflows in the browser without a backend or default upload endpoint.
- Decision Lab implements decision framing, XLRM mapping, competing strategies, plural futures, threshold stress testing, vulnerability discovery, adaptive pathways, and human-owned decisions.
- Open Phenomenon Verification implements local hashing, calibration declaration, angular measurement, evidence-level controls, human verdicts, and portable exports.
- Scenario scores are analyst-assigned desirability inputs, not probabilities.
- Critical failures remain visible.
- Observation, experience, interpretation, mechanism mapping, and generated assets remain separate.
- Public-safe dataset counts and privacy transforms are validator-enforced.
- Release packaging excludes private or generated development content.
- The browser gate checks semantic structure, reflow, forced colors, and PDF print generation.
- The Pages workflow is designed to execute the browser gate against the deployed HTTPS origin.
## Release-workflow evidence boundary

The repository implements a production workflow that requires a GitHub-verified signed annotated tag, enabled release immutability, deterministic artifacts, attestations, and hosted-asset verification. Public workflow history shows that the Release workflow was not exercised for v0.2.10. Do not present those implemented controls as completed delivery evidence for the historical release.

## Required local gate

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
npm run check
npm run package:release
```

## v0.3.0 hosted gate

Before calling v0.3.0 publicly complete:

1. merge through the required `verify` check
2. confirm Pages deployment and the live HTTPS E2E gate
3. complete the manual accessibility checklist
4. verify repository security settings and release immutability
5. create a GitHub-verified signed annotated release tag
6. confirm the immutable GitHub Release contains the canonical ZIP and checksum
7. verify attestations and both downloaded assets

## Prohibited claims

Do not claim that the application predicts the future, provides a full RDM/MoRDM ensemble, proves UAP origin or mechanism, converts analyst scores into probabilities, independently validates the included research datasets, or is already a dependable general-purpose institutional platform.


The conflicting prior audit result involving Playwright `wait_for_function` and the strict CSP is closed in v0.2.10. The release tooling contains no `wait_for_function` calls.
