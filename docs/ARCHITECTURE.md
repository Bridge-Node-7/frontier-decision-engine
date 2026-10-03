# Architecture

Frontier Decision Engine is the human-governed decision layer of Bridge Node 7's Frontier Mission Assurance architecture. It is a static browser application served from `site/`; there is no backend or account service.

## Human-first runtime

The public root is a one-input decision experience for technical, organizational, mission, and strategic decisions. A person can start in ordinary language without learning decision-science vocabulary first.

After **Continue**, ordinary in-scope text resolves to a working **Decision Brief**. The brief is a valid stopping point. It presents only supportable structure: the decision or focus, what matters, what remains unclear, and the next useful move. Sparse, ambiguous, or multi-decision input remains useful as a partial brief rather than forcing a question-by-question completion path.

A pre-interpretation scope boundary still runs before brief generation. High-confidence personal safety language receives the established safety boundary; otherwise first-person personal-life decisions are redirected neutrally unless explicit organizational or decision-support context makes the work in scope. Information-only requests receive the established no-retrieval boundary. These are product-scope decisions, not clinical judgments.

The first-run layer preserves the original source text and candidate decisions, choices, criteria, conditions, and provisional decision hinge. Candidate capture can be broader than the formal comparison. The Decision Brief is working context, not a Decision Receipt and not evidence by itself.

A Decision Map remains an internal architecture/export concept where it improves technical precision. It is not the pre-input first-run surface.

## Minimum necessary human contribution

FDE follows this interaction rule:

> Produce useful structure before asking the person to operate the formal model.

**Refine** returns to the same freeform source context. It does not open another structured questionnaire. Formal depth is voluntary through **Compare options**.

The optional comparison setup shows the complete bounded formal setup on one surface. The person selects one decision when needed, 2–3 strategies, 2–4 objectives, and 2–4 scenarios. Additional source candidates remain preserved outside the active formal set. A provisional decision hinge may enter a formal criterion or modeled future only after explicit human handling.

## Formal Decision Lab

After the person deliberately opens a valid bounded comparison, FDE creates the existing guided Decision Case and hands it into the existing deterministic Decision Lab. Guided comparison remains 2–4 objectives, 2–3 strategies, and 2–4 scenarios. The minimum comparison remains a true 2 × 2 × 2 model.

The comparison core is isolated from the first-run layer so UX changes do not silently alter ranking semantics. Missing analytical values are not fabricated. Saved formal work is not silently overwritten by a new first-run brief.

## Epistemic boundaries

The public experience separates:

1. **You said** — the original human input.
2. **FDE organized** — provisional structure derived from bounded explicit textual patterns.
3. **You confirmed** — information promoted into the formal model by a human.
4. **FDE calculated** — deterministic output from confirmed model inputs.
5. **You decided** — the human-owned choice, rationale, and next action.

The default runtime does not use a remote AI provider, retrieve external facts, infer evidence, assign probabilities, or make the final decision.

## Browser storage

The first-run experience uses bounded tab-scoped session storage for accidental-refresh recovery. Decision Lab uses bounded browser autosave for structured work plus a separate bounded **Local Decision Receipt Archive** for prior valid Decision Receipt v2 records created during reassessment. Current-draft reset does not erase that archive. The archive does not claim cryptographic continuity, completeness, or protection from browser/profile deletion. Browser-local storage is not encrypted confidential storage.

## Privacy and security

The public application has no backend, account system, analytics, telemetry, cookies, remote AI provider, or default upload endpoint. User input is rendered as text, not executable markup. Local files remain in the browser unless the person explicitly downloads or shares them.


## Accountable decision authority

FDE distinguishes the accountable owner, a delegated decider, an advisor, and unknown ownership. Analysis capability does not imply decision authority. Advisors may frame and compare and may prepare a brief for the owner; they cannot create an accountable Decision Receipt. Unknown ownership preserves the frame but gates comparison until an accountable owner is established.

## Evidence readiness

Decision evidence can be ready or require proof before additional confidence is warranted. Required criteria with partial, unknown, contested, stale, invalid, or otherwise not-assessable evidence surface a proof-first gate. An accountable owner may explicitly proceed under residual uncertainty only when that unresolved evidence and the reason for proceeding are preserved in the receipt.

## Recordability boundary

The scope policy is enforced as a receipt-construction invariant over the same substantive Decision Case that is canonicalized and hashed. The UI performs the same check early for clear feedback, but `createDecisionRecord()` remains the fail-closed boundary for all callers. Imported decisions and receipts are checked after structural/integrity validation and before active state or browser persistence.

The hard gate covers decision- and action-bearing fields rather than recursively treating every evidence or explanatory string as an operative decision. This preserves the distinction between describing sensitive subject matter and asking FDE to compare or record an out-of-scope personal action.

## Decision Receipts

Decision Receipt v2 is separate from the Decision Case. It binds the substantive decision state, decision authority, evidence disposition, and human attestation with SHA-256 over canonical JSON. Legacy v1 FNV-1a records remain readable as historical change-detection records.

Recording a human decision is not the same as organizational approval, legal authorization, certification, qualification, consent, investment authority, or execution authority.

## Lifecycle and historical truth

The application-facing lifecycle is Draft -> Ready for owner review -> Human decision recorded -> Reassessment -> new human decision when warranted -> Superseded/Closed. Recorded historical decisions are not rewritten after outcomes become known. When a recorded decision changes, FDE deterministically identifies changed field families, preserves the prior valid Receipt v2 in the bounded Local Decision Receipt Archive, and requires the accountable human to explicitly record any replacement Receipt.

## Deployment handling boundary

The public deployment is for public or sanitized decision material only. Handling authority is a deployment property, not a user-selectable privilege. A public build cannot elevate itself into an approved confidential, controlled, classified, or otherwise restricted environment.

## Pilot proof instrumentation

Pilot usefulness measurements are kept in the separate Pilot Proof Envelope contract. They do not expand the Decision Case schema and are not collected through hidden telemetry or analytics.
