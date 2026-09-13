# v0.4.0

## Governed Mission Context

Application version is 0.4.0. The compatible decision schema 0.2.10 and semantic decision schema 0.3.0 remain unchanged.

This release adds a bounded, browser-local consumer for Mission Graph Decision Context Packet 0.2.0 while preserving FDE's human decision authority and existing deterministic comparison semantics.

### Changes

- Adds a dedicated Governed context route for Mission Graph `FDE_PREPARATION_ONLY` packets.
- Accepts only Decision Context Packet 0.2.0 with PRIVATE or PROTECTED classification, explicit non-release handling, and no recorded-decision claim.
- Recomputes the Mission Graph canonical SHA-256 content digest locally before displaying a packet.
- Presents known, assumed, disputed, unknown, stale, ProofRequest, and reassessment-condition context without converting those categories into FDE evidence or scores.
- Adds a Show me why lineage view for packet, source graph, source record, and SHA-256 identifiers.
- Keeps accepted governed context in JavaScript module memory only; it is not written to normal FDE local/session storage and is discarded on refresh.
- Uses a one-shot handoff into Decision Lab as visible preparation context only. It is not autosaved, scored, promoted to evidence, or recorded as the human decision.
- Vendors the Mission Graph Decision Context 0.2.0 consumer schema for offline verification and hibernation/reentry clarity.
- Adds adversarial regressions for digest mismatch, unsupported compatibility/classification, release escalation, recorded-decision escalation, epistemic category preservation, and one-shot memory handling.

### Decision boundary

Mission Graph context informs preparation. FDE still does not approve, authorize, certify, qualify, or autonomously make or record the consequential decision. A person remains accountable for what enters the canonical decision model and for the final decision.

### Release date

2026-09-13

# v0.3.4

## First-Run Boundary Hardening

Application version is 0.3.4. The compatible decision schema 0.2.10 and semantic decision schema 0.3.0 remain unchanged.

This maintenance release hardens clean-adopter setup and first-run truthfulness without changing deterministic Decision Lab ranking semantics or human final decision authority.

### Changes

- Documents an isolated Python virtualenv before development-package installation for PEP 668-safe onboarding.
- Refuses to present a partial subset when a natural-language input contains an unresolved list of three or more alternatives; the UI asks explicitly for the options instead.
- Adds deterministic corpus regression coverage across more than 250 multi-option phrasings while preserving binary extraction.
- Adds a narrow safety boundary for explicit requests to start, stop, skip, or change prescribed treatment; FDE does not recommend a treatment change and can instead structure cost, access, logistics, and questions for a qualified clinician.
- Makes the current English-only natural-language intake scope explicit.
- Preserves browser-local privacy, saved-work protection, published schemas, deterministic formal comparison, and human decision authority.

### Decision boundary

FDE remains decision support, not a medical, safety, certification, qualification, authorization, or investment authority.

### Release date

2026-09-12

# v0.3.3

## Frictionless First-Run Decision UX

Application version is 0.3.3. The compatible decision schema 0.2.10 remains available alongside the explicitly versioned 0.3.0 semantic decision schema.

This release completes the first-run FDE experience around one natural input while preserving the deterministic Decision Lab, browser-local architecture, saved-work protections, published schemas, and human final decision authority.

### Changes

- Starts with the single first-timer question: “What are you considering?”
- Uses one large natural-language input with a clear Continue action, Ctrl/Cmd + Enter support, a direct Decision Lab path, and a concise browser-local privacy statement.
- Removes the pre-input Decision Map, empty structural cards, conversational response bubble, workflow narration, readiness decoration, and working-header sales action.
- After Continue, produces exactly one of three truthful outcomes: supportable decision structure, one useful clarification question, or an explicit capability boundary with a useful next action.
- Shows only supportable first-run fields under the human-facing labels Decision, What matters, Options, and What may change.
- Keeps provisional structure separate from confirmed model inputs and asks for human confirmation before any handoff to the formal comparison.
- Requests only the next missing explicit input required for the bounded deterministic comparison; no hidden defaults or fabricated topology are introduced.
- Preserves saved Decision Lab work and refuses silent replacement when browser-local work already exists.
- Keeps the Appearance control stable by name while exposing current and next appearance state accessibly.
- Moves Strategic Inquiry out of the working application header and keeps it available in the footer.
- Strengthens first-run browser regression coverage for mobile layout, sparse input, clear input, capability boundaries, keyboard activation, saved-work collision protection, refresh recovery, appearance behavior, and absence of remote requests.
- Keeps the application browser-local with no backend, account system, analytics, telemetry, cookies, remote AI provider, or default upload endpoint.
- Keeps published decision schemas 0.2.10 and 0.3.0 unchanged and preserves deterministic ranking semantics and human final decision authority.

### Decision boundary

FDE does not turn arbitrary prose into verified facts, evidence, probabilities, scores, thresholds, scenario modifiers, or recommendations. It structures only what its deterministic browser-local intake can support from explicit words, and a person confirms what enters the canonical decision model.

FDE structures and calculates; it does not approve, authorize, certify, qualify, consent, or make an investment decision. Browser-local storage is a convenience, not encrypted confidential storage.

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
