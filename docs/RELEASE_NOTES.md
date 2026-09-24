# v0.5.14

Application version is 0.5.14.

Compatible decision schema: 0.2.10. Semantic decision schema: 0.3.0. Mission Graph Decision Context Packet: 0.3.0. Decision Receipt format: 2. Pilot Proof Envelope: 1.

This corrective release replaces open-ended euphemism matching as the primary safety fallback with a bounded product-scope rule.

- High-confidence self-harm, immediate-safety, and personal-health boundaries remain specific and fail closed.
- First-person personal-life decisions that are not clearly technical, organizational, mission, or strategic are redirected by a neutral product-scope boundary before comparison and again at Receipt construction.
- The neutral personal-scope redirect explicitly states that it is not a clinical judgment and includes standing crisis-support signposting without classifying ordinary personal decisions as self-harm.
- Clearly organizational first-person decisions remain in scope based on organizational or decision-support context rather than a finite action-verb list.
- Previously demonstrated phrases such as geographic relocation and personal career choices are no longer mislabeled as self-harm; they receive the neutral personal-scope redirect instead.
- Receipt construction and import admission continue to enforce the same scope policy over the substantive decision, including the recorded human rationale.
- Regression and browser UAT distinguish specific crisis boundaries, neutral personal scope, and legitimate organizational language.

The Decision Case schemas, Mission Graph context contract, Decision Receipt v2 format, ranking semantics, reassessment behavior, and authority roles are unchanged. Human judgment remains authoritative.

Browser-local storage is not encrypted confidential storage. Public deployment is for public or sanitized decision material only.
