# Architecture

Frontier Decision Engine is the human-governed decision layer of Bridge Node 7's Frontier Mission Assurance architecture. It is a static browser application served from `site/`; there is no backend or account service.

## Human-first runtime

The public root is a one-input decision experience for technical, organizational, mission, and strategic decisions. A person can start in ordinary language without learning decision-science vocabulary first.

After Continue, the runtime must resolve to exactly one of three states:

1. supportable decision structure;
2. exactly one useful clarification question; or
3. an honest capability boundary plus a useful next action.

The first-run structure uses stable semantic concepts: `decision`, `what_matters`, `options`, `what_may_change`, `status`, and `next_required_input`. Human-facing labels are **Decision, What matters, Choices, What may change**. Only fields actually supported by explicit input are rendered.

A Decision Map remains an internal architecture/export concept where it improves technical precision. It is not the pre-input first-run surface.

## Minimum necessary human contribution

FDE follows this interaction rule:

> Continue without bothering the person when the system can proceed safely; otherwise ask for the smallest human contribution that materially advances the decision.

No ordinary in-scope input is treated as an error-only dead end. Sparse or ambiguous input receives one clarification question. A small pre-interpretation scope boundary fails closed on high-risk personal decisions before they can become comparison choices; that boundary is infrastructure, not FDE's product domain.

## Formal Decision Lab

Once enough explicit structure exists and the person confirms it, the information is handed into the existing deterministic Decision Lab. Guided comparison supports 2–4 objectives, 2–3 strategies, and 2–4 scenarios. The minimum comparison is a true 2 × 2 × 2 model.

The comparison core is isolated from the first-run layer so UX changes do not silently alter ranking semantics. Missing analytical values are not fabricated.

## Epistemic boundaries

The public experience separates:

1. **You said** — the original human input.
2. **FDE organized** — provisional structure derived from bounded explicit textual patterns.
3. **You confirmed** — information promoted into the formal model by a human.
4. **FDE calculated** — deterministic output from confirmed model inputs.
5. **You decided** — the human-owned choice, rationale, and next action.

The default runtime does not use a remote AI provider, retrieve external facts, infer evidence, assign probabilities, or make the final decision.

## Browser storage

The first-run experience uses bounded tab-scoped session storage for accidental-refresh recovery. Decision Lab uses bounded browser autosave for structured work. Browser storage is a convenience, not encrypted confidential storage.

## Privacy and security

The public application has no backend, account system, analytics, telemetry, cookies, remote AI provider, or default upload endpoint. User input is rendered as text, not executable markup. Local files remain in the browser unless the person explicitly downloads or shares them.


## Accountable decision authority

FDE distinguishes the accountable owner, a delegated decider, an advisor, and unknown ownership. Analysis capability does not imply decision authority. Advisors may frame and compare and may prepare a brief for the owner; they cannot create an accountable Decision Receipt. Unknown ownership preserves the frame but gates comparison until an accountable owner is established.

## Evidence readiness

Decision evidence can be ready or require proof before additional confidence is warranted. Required criteria with partial, unknown, contested, stale, invalid, or otherwise not-assessable evidence surface a proof-first gate. An accountable owner may explicitly proceed under residual uncertainty only when that unresolved evidence and the reason for proceeding are preserved in the receipt.

## Decision Receipts

Decision Receipt v2 is separate from the Decision Case. It binds the substantive decision state, decision authority, evidence disposition, and human attestation with SHA-256 over canonical JSON. Legacy v1 FNV-1a records remain readable as historical change-detection records.

Recording a human decision is not the same as organizational approval, legal authorization, certification, qualification, consent, investment authority, or execution authority.

## Lifecycle and historical truth

The application-facing lifecycle is Draft -> Ready for owner review -> Human decision recorded -> Superseded/Closed. Recorded historical decisions are not rewritten after outcomes become known; new evidence produces reassessment and, when needed, a new receipt.

## Deployment handling boundary

The public deployment is for public or sanitized decision material only. Handling authority is a deployment property, not a user-selectable privilege. A public build cannot elevate itself into an approved confidential, controlled, classified, or otherwise restricted environment.

## Pilot proof instrumentation

Pilot usefulness measurements are kept in the separate Pilot Proof Envelope contract. They do not expand the Decision Case schema and are not collected through hidden telemetry or analytics.
