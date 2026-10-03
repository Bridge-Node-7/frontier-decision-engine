# Accountable Decision Pilot Readiness

FDE pilots test whether accountable decision-makers find the decision architecture useful on real unresolved decisions. A pilot is not evidence that FDE makes the correct decision.

## Pilot acceptance gates

1. Authority: the participant establishes whether they are the accountable owner, delegated decider, advisor, or do not yet know the owner.
2. Integrity: new accountable Decision Receipts use SHA-256.
3. Human attestation: the accountable human explicitly owns the recorded decision.
4. Evidence: unknown, contested, stale, partial, or invalid evidence is not silently represented as established.
5. Proof request: required unresolved evidence can stop additional scoring and surface the human-declared next proof.
6. Privacy: public FDE is for public or sanitized information only; browser storage is not encrypted confidential storage.
7. Decision surface: the final view leads with the supportable prepared bottom line and controlling issue before deeper detail, while making clear that the accountable human still decides.
8. Human burden: the first Continue action produces a useful Decision Brief for ordinary in-scope text, the brief is a valid stopping point, and formal comparison is entered only when the participant chooses deeper analysis.
9. Reconstruction: an independent reviewer can understand the receipt from the artifact alone.
10. Provenance: application version, schema version, and receipt digests are preserved.
11. Reuse intent: the pilot asks whether the participant would voluntarily use FDE on another real decision.

## Pilot Proof Envelope

The Pilot Proof Envelope is separate from the Decision Case and Decision Receipt. It records a bounded before/after/outcome study of usefulness. FDE has no hidden telemetry, analytics, automatic decision upload, or silent customer-evidence collection.

## Handling boundary

The public deployment is suitable only for public or sanitized decision material. A user cannot elevate the public deployment into a private, controlled, classified, or otherwise restricted environment through a UI selection.
