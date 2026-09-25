# Accountable Decision Pilot Readiness

FDE pilots test whether accountable decision-makers find the decision architecture useful on real unresolved decisions. A pilot is not evidence that FDE makes the correct decision.

## Pilot acceptance gates

1. Authority: the participant establishes whether they are the accountable owner, delegated decider, advisor, or do not yet know the owner.
2. Integrity: new accountable Decision Receipts use SHA-256.
3. Human attestation: the accountable human explicitly owns the recorded decision.
4. Evidence: unknown, contested, stale, partial, or invalid evidence is not silently represented as established.
5. Proof request: required unresolved evidence can stop additional scoring and surface the human-declared next proof.
6. Privacy: public FDE is for public or sanitized information only; browser storage is not encrypted confidential storage.
7. No coaching dependency: a participant can complete the workflow without BN7 narrating the product.
8. Reconstruction: an independent reviewer can understand the receipt from the artifact alone.
9. Provenance: application version, schema version, and receipt digests are preserved.
10. Reuse intent: the pilot asks whether the participant would voluntarily use FDE on another real decision.

## Pilot Proof Envelope

The Pilot Proof Envelope is separate from the Decision Case and Decision Receipt. It records a bounded before/after/outcome study of usefulness. FDE has no hidden telemetry, analytics, automatic decision upload, or silent customer-evidence collection.

## Handling boundary

The public deployment is suitable only for public or sanitized decision material. A user cannot elevate the public deployment into a private, controlled, classified, or otherwise restricted environment through a UI selection.

## Closeout rule

After the pilot-readiness release is verified, freeze feature expansion. Let real accountable decision-makers determine which future capabilities earn additional engineering.

### Maintenance lane

The feature freeze applies to net-new capability expansion. It does not block bounded maintenance that preserves the published decision contracts, including security, safety, correctness, scope-boundary, accessibility, reliability, interoperability, compatibility, documentation, evidence-maintenance, or dependency work.

Maintenance should not create a new user workflow, expand decision authority, or silently change the meaning of an existing Decision Case, Decision Receipt, or Pilot Proof Envelope. Net-new capabilities should be earned by pilot evidence or accompanied by an explicit recorded exception explaining why the change is necessary before pilot evidence is available.

This clarification governs changes after publication of this note. It does not retroactively reclassify earlier releases.
