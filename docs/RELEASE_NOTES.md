# v0.5.10

Application version is 0.5.10.

Compatible decision schema: 0.2.10. Semantic decision schema: 0.3.0. Mission Graph Decision Context Packet: 0.3.0. Decision Receipt format: 2. Pilot Proof Envelope: 1.

This patch keeps the result-first `Next Proof` surface and the Decision Brief aligned with the formal evidence-readiness state. When a required criterion remains unresolved before its evidence need has been named, FDE now says that required proof remains unresolved instead of incorrectly stating that no required proof blocks the gate.

Named proof requests continue to render from the existing deterministic evidence-readiness model. A ready evidence state still states that no required proof blocks the formal gate. The same shared presentation rule is used by the live result surface and the Decision Brief so the two views cannot diverge on this condition.

The Decision Case schemas, Mission Graph context contract, Decision Receipt v2 format, evidence semantics, ranking model, reassessment behavior, and authority roles are unchanged. Human judgment remains authoritative.

Browser-local storage is not encrypted confidential storage. Public deployment is for public or sanitized decision material only.
