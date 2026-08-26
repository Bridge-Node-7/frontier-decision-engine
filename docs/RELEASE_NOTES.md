# v0.3.3

## Human-first Decision Rescue

Application version is 0.3.3. The compatible decision schema 0.2.10 remains available alongside the explicitly versioned 0.3.0 semantic decision schema.

This release adds a low-friction public front door for people who arrive with a messy, unclear, or urgent situation. It preserves the deterministic Decision Lab underneath while reducing the amount of decision-science knowledge a visitor needs before FDE becomes useful.

### Changes

- Adds Decision Rescue as the canonical first step for ordinary-language problem intake.
- Builds incomplete or complete Decision Frames through bounded human-confirmed choices rather than silent semantic inference.
- Supports true 2 × 2 × 2 minimum guided comparisons while retaining bounded larger guided topologies.
- Recovers in-progress Rescue work after an accidental refresh using tab-scoped browser session storage.
- Protects existing browser-saved Decision Lab work from silent replacement and requires an explicit human choice before replacement.
- Carries the original starting context into the Decision Lab as context only; it is not scored or treated as evidence.
- Improves mobile question-first hierarchy, keyboard and screen-reader semantics, live status/help relationships, and Light/Dark/System appearance behavior.
- Keeps the application browser-local with no backend, account system, analytics, telemetry, remote AI provider, or default upload endpoint.
- Keeps published decision schemas 0.2.10 and 0.3.0 unchanged and preserves the deterministic ranking semantics.
- Strengthens generated-artifact integrity verification so stale manifests cannot silently pass release validation.

### What FDE does not do

FDE does not invent evidence, probabilities, thresholds, scores, modifiers, or recommendations from arbitrary prose. Software calculations do not establish that user-supplied evidence is true, complete, or sufficient. The comparison informs; a person decides.

### Demonstration boundary

The included ready example is synthetic. It does not certify a real supplier, material, capacity, compliance status, investment, or forecast.

### Release date

2026-08-26

# v0.3.2

## Verification, interface, and release integrity

Application version is 0.3.2. The compatible decision schema 0.2.10 remains available alongside the explicitly versioned 0.3.0 semantic decision schema.

This patch release improves cross-platform verification, focused progressive disclosure, and release commit identity while preserving the decision model, human authority, and published schema contracts.

### Changes

- Adds a portable Python launcher for npm verification on Windows and POSIX systems without adding dependencies.
- Reports both decision schema identities in generated project and release metadata.
- Places a mobile Overview action at the working-interface heading and keeps secondary Step 2 and Step 5 detail collapsed until requested.
- Verifies that a release tag resolves to the checked-out commit, that the commit is on `main`, and that GitHub Release publication targets that exact commit.
- Keeps schemas 0.2.10 and 0.3.0, ranking, thresholds, decision fingerprints, browser-local operation, and human decision authority unchanged.

### Evidence boundary

FDE provides transparent software decision support. Recording documents human judgment; it is not approval, authorization, certification, qualification, consent, or investment authority. Browser-local storage is not encrypted confidential storage.

### Release-candidate date

2026-08-20
