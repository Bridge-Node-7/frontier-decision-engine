# v0.5.9

Application version is 0.5.9.

Compatible decision schema: 0.2.10. Semantic decision schema: 0.3.0. Mission Graph Decision Context Packet: 0.3.0. Decision Receipt format: 2. Pilot Proof Envelope: 1.

This release makes reassessment first-class without changing the deterministic comparison model, scoring semantics, or human-authority boundary. When the working decision differs from the currently recorded Receipt, FDE now shows a deterministic `What changed?` summary across framing, evidence, goals and thresholds, choices, futures and uncertainties, assurance conditions, human-decision fields, and adaptive reassessment controls.

`Reconsider when…` remains grounded in the human-declared reassessment condition already present in the decision model. FDE does not infer why a change occurred and does not rewrite the prior recorded decision.

Before a changed decision can be recorded again, the prior valid Decision Receipt v2 is preserved in a separate bounded browser-local history store. History is deduplicated by receipt SHA-256, never silently evicted, and fails closed if the history cannot be verified or safely persisted. Prior Receipts remain independently downloadable.

The Decision Case schemas, Mission Graph context contract, Decision Receipt v2 format, evidence semantics, ranking model, and authority roles are unchanged. Human judgment remains authoritative.

Browser-local storage is not encrypted confidential storage. Public deployment is for public or sanitized decision material only.
