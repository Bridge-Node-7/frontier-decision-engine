# v0.3.3

## Human-first Universal Response and Decision Map

Application version is 0.3.3. The compatible decision schema 0.2.10 remains available alongside the explicitly versioned 0.3.0 semantic decision schema.

This release completes a low-friction public front door for people who arrive with a messy, unclear, urgent, or already-structured situation. A single free-form input now produces an immediate useful response and a provisional Decision Map before the person is asked for additional structure. Decision Rescue remains available as the bounded fallback when important structure is still missing, and the deterministic Decision Lab remains the formal comparison engine underneath.

### Changes

- Makes Universal Response plus the provisional Decision Map the canonical public front door.
- Accepts ordinary-language problems, questions, worries, ideas, decisions, and incomplete thoughts without requiring decision-science vocabulary first.
- Shows only conservative provisional structure from explicit input: a possible decision, choices mentioned, things that may matter, conditions that could change the answer, and the smallest useful next step.
- Keeps provisional organization visibly distinct from confirmed model inputs: possible is not confirmed; the comparison informs; a person decides.
- Adds Decision Map readiness states — Start anywhere, One useful step at a time, and Ready to compare — without using a misleading completion percentage.
- Adds contextual Why this matters guidance and explicitly permits stopping with a useful partial map rather than forcing unnecessary completion.
- Uses Decision Rescue as the bounded fallback when human judgment is still needed to shape missing pieces.
- Supports true 2 × 2 × 2 minimum guided comparisons while retaining bounded larger guided topologies.
- Recovers in-progress Universal Response and Rescue work after accidental refresh using bounded tab-scoped session storage.
- Protects existing browser-saved Decision Lab work from silent replacement and requires an explicit human choice before replacement.
- Carries original starting context forward as context only; it is not scored or treated as evidence.
- Improves mobile hierarchy, keyboard and screen-reader semantics, live status/help relationships, reflow, forced-colors handling, and Light/Dark/System appearance behavior.
- Keeps the application browser-local with no backend, account system, analytics, telemetry, cookies, remote AI provider, or default upload endpoint.
- Keeps published decision schemas 0.2.10 and 0.3.0 unchanged and preserves deterministic ranking semantics and human final decision authority.
- Hardens public repository naming so user-facing implementation paths do not expose internal design terminology unnecessarily.
- Strengthens generated-artifact integrity verification so stale or malformed manifests cannot silently pass release validation.

### What FDE does not do

FDE does not invent evidence, probabilities, thresholds, scores, modifiers, or recommendations from arbitrary prose. Software calculations do not establish that user-supplied evidence is true, complete, or sufficient. The comparison informs; a person decides.

### Demonstration boundary

The included ready example is synthetic. It does not certify a real supplier, material, capacity, compliance status, investment, or forecast.

### Release date

2026-09-12

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
