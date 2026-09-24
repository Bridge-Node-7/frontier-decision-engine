# v0.5.11

Application version is 0.5.11.

Compatible decision schema: 0.2.10. Semantic decision schema: 0.3.0. Mission Graph Decision Context Packet: 0.3.0. Decision Receipt format: 2. Pilot Proof Envelope: 1.

This patch preserves explicit prohibitive hard requirements such as `must not exceed` and `must never exceed` as provisional Decision Hinge candidates. These candidates remain suggestions with no formal influence until a person confirms them.

Ordinary negation remains fail-closed. Statements such as `not required`, `not mandatory`, `not a hard deadline`, and requirements appearing inside negated left context continue to produce no hinge rather than being inverted into a requirement.

The Decision Case schemas, Mission Graph context contract, Decision Receipt v2 format, evidence semantics, ranking model, reassessment behavior, and authority roles are unchanged. Human judgment remains authoritative.

Browser-local storage is not encrypted confidential storage. Public deployment is for public or sanitized decision material only.
