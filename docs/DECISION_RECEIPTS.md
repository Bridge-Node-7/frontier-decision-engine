# Decision Receipts

Frontier Decision Engine Decision Receipts preserve an accountable human decision without claiming that the decision was objectively correct, organizationally approved, or execution-authorized.

## Receipt v2

New accountable Decision Receipts use SHA-256 over canonical JSON.

- `decision_content_sha256` binds the substantive Decision Case the human reviewed.
- `receipt_sha256` binds the complete receipt envelope, including authority, evidence disposition, and human attestation, while excluding only the `receipt_sha256` field itself.
- Legacy v1 FNV-1a records remain readable and verifiable as change-detection records. They are never relabeled as cryptographic receipts.

## Human authority

Only an accountable owner or delegated decider can record a v2 Decision Receipt. Advisors may frame, compare, and prepare a brief for the owner, but cannot create an accountable-owner receipt.

The attestation states:

> I confirm that this records my decision, rationale, and next action. FDE informed the process but did not authorize this decision.

This is a human attestation, not a digital signature, identity-verification service, corporate approval, legal authorization, or PKI certificate.

## Evidence disposition

A receipt records whether required evidence was ready or whether the accountable owner explicitly proceeded under residual uncertainty. Missing evidence is never silently upgraded into verified evidence.

## Historical integrity

Recorded decisions are historical artifacts. New evidence or changed reasoning creates a new recording or reassessment; it does not rewrite the prior receipt.
