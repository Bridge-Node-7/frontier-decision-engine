# v0.5.12

Application version is 0.5.12.

Compatible decision schema: 0.2.10. Semantic decision schema: 0.3.0. Mission Graph Decision Context Packet: 0.3.0. Decision Receipt format: 2. Pilot Proof Envelope: 1.

This corrective release hardens FDE's accountable recording boundary without changing its published decision or receipt contracts.

- Scope policy is re-evaluated inside Receipt v2 construction against the substantive decision/action state that is subsequently canonicalized and hashed.
- Opened decisions and verified receipts are checked before they can become active browser work.
- Ambiguous crisis-language handling better distinguishes personal intent from ordinary supplier and organizational language while retaining existing personal-health and immediate-safety boundaries.
- Receipt-shaped files that fail integrity verification now receive a specific bounded integrity error.
- Decision authority is visible in the first decision stage instead of being hidden under optional context.
- Prior receipts are described as a **Local Decision Receipt Archive**, matching the actual bounded browser-local guarantee rather than implying a cryptographic chain.
- Decision Briefs surface normalized-score provenance coverage and explicitly caution against unsupported precision.
- Deterministic intake better identifies the actual decision sentence after leading context and produces clearer labels for institutional "Should the ..." choices.
- Recorded HTML export markup was refactored for reviewability without changing the Receipt v2 format or decision authority model.

The Decision Case schemas, Mission Graph context contract, Decision Receipt v2 format, ranking semantics, reassessment behavior, and authority roles are unchanged. Human judgment remains authoritative.

Browser-local storage is not encrypted confidential storage. Public deployment is for public or sanitized decision material only.
